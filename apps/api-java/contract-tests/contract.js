/*
 * Black-box contract tests: plain HTTP against a running backend, so the same file proves the NestJS API
 * and the Spring Boot API behave identically.
 *
 *   BASE=http://localhost:4000 DATABASE_URL=... SMTP_PORT=2525 node contract.js
 *
 * The backend under test must be started with:
 *   SMTP_HOST=localhost SMTP_PORT=<same SMTP_PORT>   (this script runs the mail sink)
 * and, for the payment checks (PAYMENTS=1, Spring Boot only because the Node SDK talks to Razorpay directly):
 *   RAZORPAY_BASE_URL=http://localhost:<RZP_PORT> RAZORPAY_KEY_ID=rzp_test_x RAZORPAY_KEY_SECRET=<secret> RAZORPAY_WEBHOOK_SECRET=<whsec>
 * This script then plays the part of Razorpay. It creates throw-away accounts and deletes them at the end.
 */
const http = require('http');
const crypto = require('crypto');
const { SMTPServer } = require('smtp-server');
const { Client } = require('pg');

const BASE = (process.env.BASE || 'http://localhost:4000').replace(/\/$/, '');
const DATABASE_URL = (process.env.DATABASE_URL || 'postgresql://decors:decors@localhost:5432/decors').replace(/\?.*$/, '');
const SMTP_PORT = Number(process.env.SMTP_PORT || 2525);
const RZP_PORT = Number(process.env.RZP_PORT || 4545);
const PAYMENTS = process.env.PAYMENTS === '1';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_key_secret';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret';
const RUN = crypto.randomBytes(4).toString('hex');

let passed = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) passed++;
  else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? '' : ' → ' + JSON.stringify(detail)}`);
  }
};
const section = (s) => console.log(`\n${s}`);

// ───── tiny HTTP client with a cookie jar per "browser" ─────
class Browser {
  constructor() { this.cookie = ''; }
  async req(method, path, body, headers = {}) {
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    let payload = body;
    if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string' && !Buffer.isBuffer(body)) {
      payload = JSON.stringify(body);
      h['content-type'] = 'application/json';
    }
    const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: 'manual' });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const [pair] = c.split(';');
      const [name, ...v] = pair.split('=');
      const value = v.join('=');
      if (/max-age=0/i.test(c) || value === '') this.cookie = this.cookie.split('; ').filter((x) => x && !x.startsWith(name + '=')).join('; ');
      else this.cookie = [...this.cookie.split('; ').filter((x) => x && !x.startsWith(name + '=')), pair].join('; ');
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, json, text, headers: res.headers, setCookie };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b ?? {}); }
  put(p, b) { return this.req('PUT', p, b ?? {}); }
  patch(p, b) { return this.req('PATCH', p, b ?? {}); }
  del(p) { return this.req('DELETE', p); }
}

// ───── mail sink ─────
const mails = [];
const mailServer = new SMTPServer({
  authOptional: true, disabledCommands: ['STARTTLS'],
  onData(stream, _s, cb) {
    let raw = '';
    stream.on('data', (c) => (raw += c));
    stream.on('end', () => { mails.push(raw); cb(); });
  },
});
const decodeQp = (s) => s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
async function mailTo(addr, kind, afterCount = 0) {
  for (let i = 0; i < 80; i++) {
    const hit = mails.slice(afterCount).map(decodeQp).find((m) => m.toLowerCase().includes(`to: ${addr}`) && m.includes(kind));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
const tokenFrom = (mail, path) => (mail.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`)) || [])[1];

// ───── fake Razorpay ─────
let rzpOrders = 0;
const rzpCalls = [];
const rzpServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    rzpCalls.push({ url: req.url, auth: req.headers.authorization, body: body && JSON.parse(body) });
    if (req.url === '/v1/orders' && req.method === 'POST') {
      if (process.env.__RZP_FAIL) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { description: 'Boom' } })); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id: `order_${RUN}_${++rzpOrders}`, amount: JSON.parse(body).amount }));
    }
    res.writeHead(404); res.end();
  });
});

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
// 1x1 transparent PNG and minimal JPEG / WebP headers
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x20, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(32)]);
const upload = (id, buf, name = 'a.png', alt) => {
  const f = new FormData();
  f.append('file', new Blob([buf], { type: 'image/png' }), name);
  if (alt !== undefined) f.append('alt', alt);
  return f;
};

const db = new Client({ connectionString: DATABASE_URL });
const emails = [];
const newEmail = (tag) => { const e = `contract-${RUN}-${tag}@example.test`; emails.push(e); return e; };
const PASSWORD = 'correct-horse-9';

async function main() {
  await db.connect();
  await new Promise((r) => mailServer.listen(SMTP_PORT, '127.0.0.1', r));
  if (PAYMENTS) await new Promise((r) => rzpServer.listen(RZP_PORT, '127.0.0.1', r));

  const anon = new Browser();

  // ───────────────────────── public catalogue ─────────────────────────
  section('catalogue');
  let r = await anon.get('/products');
  const total = r.json?.total;
  check('products shape', r.status === 200 && Array.isArray(r.json.items) && typeof total === 'number' && typeof r.json.hasMore === 'boolean', r.text.slice(0, 200));
  const first = r.json.items[0];
  check('summary fields', first && ['id', 'name', 'category', 'price', 'color', 'colorName', 'tags', 'rating', 'description', 'image'].every((k) => k in first), first && Object.keys(first));
  check('no createdAt leak', !('createdAt' in (first || {})));
  check('default page <= 24', r.json.items.length <= 24);

  r = await anon.get('/products?limit=5&offset=0');
  const p1 = r.json.items.map((i) => i.id);
  r = await anon.get('/products?limit=5&offset=5');
  const p2 = r.json.items.map((i) => i.id);
  check('pages do not overlap', p1.length === 5 && p2.every((id) => !p1.includes(id)));
  r = await anon.get('/products?limit=5&offset=2');
  check('offset need not be a multiple of limit', r.json.items[0]?.id === p1[2], r.json.items.map((i) => i.id));

  r = await anon.get('/products?sort=price-asc&limit=60');
  const prices = r.json.items.map((i) => i.price);
  check('sort price-asc', prices.every((p, i) => i === 0 || prices[i - 1] <= p), prices);
  r = await anon.get('/products?sort=price-desc&limit=60');
  const pd = r.json.items.map((i) => i.price);
  check('sort price-desc', pd.every((p, i) => i === 0 || pd[i - 1] >= p));
  r = await anon.get('/products?sort=rating&limit=60');
  const rt = r.json.items.map((i) => i.rating);
  check('sort rating', rt.every((p, i) => i === 0 || rt[i - 1] >= p));

  r = await anon.get('/products?categories=paints&limit=60');
  check('category filter', r.json.items.length > 0 && r.json.items.every((i) => i.category === 'paints'));
  r = await anon.get('/products?categories=nope');
  check('unknown category matches nothing', r.status === 200 && r.json.total === 0, r.text.slice(0, 100));
  r = await anon.get('/products?q=card&limit=60');
  check('text search', r.json.items.length > 0 && r.json.items.every((i) => /card/i.test(i.name + i.description + i.tags.join(' '))));
  r = await anon.get('/products?minPrice=100&maxPrice=150&limit=60');
  check('price range', r.json.items.every((i) => i.price >= 100 && i.price <= 150));
  r = await anon.get('/products?tags=wedding&limit=60');
  check('tag filter', r.json.items.length > 0 && r.json.items.every((i) => i.tags.includes('wedding')));
  r = await anon.get('/products?limit=0');
  check('limit=0 rejected', r.status === 400 && JSON.stringify(r.json.message).includes('limit must not be less than 1'), r.text);
  r = await anon.get('/products?limit=61');
  check('limit=61 rejected', r.status === 400, r.text);

  r = await anon.get('/products/facets');
  check('facets', r.status === 200 && r.json.categories.length === 4 && r.json.colors.length > 0 && typeof r.json.maxPrice === 'number', r.text.slice(0, 200));
  r = await anon.get('/products/overview');
  check('overview', r.status === 200 && r.json.halls.length === 4 && r.json.featured.length <= 6 && Array.isArray(r.json.popularTags), r.text.slice(0, 200));

  r = await anon.get(`/products/${first.id}`);
  check('detail', r.status === 200 && r.json.id === first.id && Array.isArray(r.json.images) && Array.isArray(r.json.related) && r.json.related.every((x) => x.id !== first.id), r.text.slice(0, 200));
  r = await anon.get('/products/does-not-exist');
  check('detail 404', r.status === 404 && r.json.message === 'Product not found', r.text);
  r = await anon.get('/nope');
  check('unknown route 404', r.status === 404 && r.json.message === 'Cannot GET /nope', r.text);

  // ───────────────────────── auth ─────────────────────────
  section('auth');
  const aliceEmail = newEmail('alice');
  const alice = new Browser();
  r = await alice.post('/auth/register', { name: 'A', email: 'not-an-email', password: 'x' });
  check('register validation', r.status === 400 && Array.isArray(r.json.message) && r.json.message.includes('email must be an email') && r.json.message.some((m) => m.startsWith('password must be longer')), r.text);
  r = await alice.post('/auth/register', { name: 'A', email: aliceEmail, password: PASSWORD, admin: true, role: 'ADMIN' });
  check('register 201', r.status === 201 && r.json.email === aliceEmail && r.json.role === 'USER' && r.json.emailVerified === false, r.text);
  check('register body hides secrets', !('passwordHash' in r.json) && !('tokenVersion' in r.json));
  check('register createdAt is ISO', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.json.createdAt), r.json.createdAt);
  const sc = r.setCookie.join(' | ');
  check('cookie flags', /decors_token=/.test(sc) && /httponly/i.test(sc) && /samesite=lax/i.test(sc) && /path=\//i.test(sc), sc);
  const aliceId = r.json.id;
  r = await anon.post('/auth/register', { name: 'A', email: aliceEmail.toUpperCase(), password: PASSWORD });
  check('duplicate (case-insensitive) → 409', r.status === 409 && r.json.message === 'An account with this email already exists', r.text);

  r = await alice.get('/auth/me');
  check('me', r.status === 200 && r.json.id === aliceId);
  r = await anon.get('/auth/me');
  check('me without cookie → 401', r.status === 401);
  const forged = new Browser(); forged.cookie = 'decors_token=abc.def.ghi';
  r = await forged.get('/auth/me');
  check('me with forged cookie → 401', r.status === 401);
  r = await alice.patch('/auth/me', { name: '  New Name  ' });
  check('rename trims', r.status === 200 && r.json.name === 'New Name', r.text);
  r = await alice.patch('/auth/me', { name: '   ' });
  check('rename blank rejected', r.status === 400, r.text);

  const login = new Browser();
  r = await login.post('/auth/login', { email: aliceEmail, password: 'wrong-password' });
  check('login wrong password → 401', r.status === 401 && r.json.message === 'Invalid email or password', r.text);
  r = await login.post('/auth/login', { email: newEmail('nobody'), password: PASSWORD });
  check('login unknown email → same 401', r.status === 401 && r.json.message === 'Invalid email or password', r.text);
  r = await login.post('/auth/login', { email: `  ${aliceEmail.toUpperCase()} `, password: PASSWORD });
  check('login trims/lowercases email → 200', r.status === 200 && r.json.id === aliceId, r.text);

  r = await login.post('/auth/change-password', { currentPassword: 'nope', newPassword: 'another-pass-1' });
  check('change-password wrong current → 400', r.status === 400 && r.json.message === 'Your current password is incorrect', r.text);
  r = await login.post('/auth/change-password', { currentPassword: PASSWORD, newPassword: PASSWORD });
  check('change-password same → 400', r.status === 400 && /different/.test(r.json.message), r.text);
  const NEW1 = 'another-pass-1';
  r = await login.post('/auth/change-password', { currentPassword: PASSWORD, newPassword: NEW1 });
  check('change-password ok', r.status === 200 && r.json.id === aliceId, r.text);
  r = await alice.get('/auth/me');
  check('other session signed out after password change', r.status === 401, r.status);
  r = await login.get('/auth/me');
  check('current session stays signed in', r.status === 200, r.status);
  r = await login.post('/auth/logout');
  check('logout 204', r.status === 204 && /decors_token=;|max-age=0/i.test(r.setCookie.join(' ')), r.setCookie);
  r = await login.get('/auth/me');
  check('after logout → 401', r.status === 401);

  // ───────────────────────── email verification ─────────────────────────
  section('email verification');
  const verifyMail = await mailTo(aliceEmail, 'verify-email');
  check('verification email sent on signup', !!verifyMail);
  const vToken = verifyMail && tokenFrom(verifyMail, 'verify-email');
  check('verification link points at the website', verifyMail && /http:\/\/localhost:3000\/verify-email\?token=/.test(verifyMail));
  const a2 = new Browser();
  await a2.post('/auth/login', { email: aliceEmail, password: NEW1 });
  r = await a2.post('/auth/resend-verification');
  check('resend right after signup → 429', r.status === 429 && /wait a minute/.test(r.json.message), r.text);
  r = await anon.post('/auth/resend-verification');
  check('resend needs login', r.status === 401);
  r = await anon.post('/auth/verify-email', { token: 'short' });
  check('verify token length validated', r.status === 400, r.text);
  r = await anon.post('/auth/verify-email', { token: 'x'.repeat(43) });
  check('verify unknown token → 400', r.status === 400 && /invalid or has expired/.test(r.json.message), r.text);
  r = await a2.post('/checkout', { name: 'A', phone: '9876543210', line1: 'x', city: 'c', state: 's', pincode: '560001' });
  check('checkout blocked until verified', r.status === 403 && r.json.code === 'EMAIL_NOT_VERIFIED', r.text);
  r = await anon.post('/auth/verify-email', { token: vToken });
  check('verify ok', r.status === 200 && r.json.verified === true, r.text);
  r = await anon.post('/auth/verify-email', { token: vToken });
  check('verify twice is fine', r.status === 200 && r.json.verified === true, r.text);
  r = await a2.get('/auth/me');
  check('me.emailVerified true', r.json.emailVerified === true, r.text);
  r = await a2.post('/auth/resend-verification');
  check('resend when verified → alreadyVerified', r.status === 200 && r.json.alreadyVerified === true, r.text);

  // ───────────────────────── password reset ─────────────────────────
  section('password reset');
  const sink = mails.length;
  r = await anon.post('/auth/forgot-password', { email: 'garbage' });
  check('forgot validates email', r.status === 400);
  r = await anon.post('/auth/forgot-password', { email: newEmail('ghost') });
  check('forgot unknown email → generic ok', r.status === 200 && r.json.ok === true, r.text);
  r = await anon.post('/auth/forgot-password', { email: aliceEmail });
  check('forgot known email → same ok', r.status === 200 && r.json.ok === true, r.text);
  const resetMail = await mailTo(aliceEmail, 'reset-password', sink);
  check('reset email sent', !!resetMail);
  check('no email for unknown address', !mails.slice(sink).some((m) => m.includes('contract-' + RUN + '-ghost')));
  const rToken = resetMail && tokenFrom(resetMail, 'reset-password');
  r = await anon.post('/auth/reset-password', { token: rToken, newPassword: 'short' });
  check('reset weak password → 400', r.status === 400, r.text);
  r = await anon.post('/auth/reset-password', { token: 'y'.repeat(43), newPassword: 'brand-new-pass-1' });
  check('reset unknown token → 400', r.status === 400 && /invalid or has expired/.test(r.json.message), r.text);
  const NEW2 = 'brand-new-pass-1';
  r = await anon.post('/auth/reset-password', { token: rToken, newPassword: NEW2 });
  check('reset ok', r.status === 200 && r.json.ok === true, r.text);
  const noticeMail = await mailTo(aliceEmail, 'password', sink + 1);
  check('password-changed notice sent', !!noticeMail);
  r = await a2.get('/auth/me');
  check('reset signs out every device', r.status === 401);
  r = await anon.post('/auth/reset-password', { token: rToken, newPassword: 'yet-another-1' });
  check('reset link is single use', r.status === 400, r.text);
  r = await anon.post('/auth/login', { email: aliceEmail, password: NEW1 });
  check('old password rejected', r.status === 401);
  const alice2 = new Browser();
  r = await alice2.post('/auth/login', { email: aliceEmail, password: NEW2 });
  check('new password works', r.status === 200, r.text);

  // ───────────────────────── account (cart & wishlist) ─────────────────────────
  section('account');
  const all = (await anon.get('/products?limit=60')).json.items;
  const [pa, pb, pc] = all;
  r = await anon.get('/account/state');
  check('state needs login', r.status === 401);
  r = await alice2.get('/account/state');
  check('empty state', r.status === 200 && r.json.cart.length === 0 && r.json.wishlist.length === 0, r.text);
  r = await alice2.put(`/account/cart/${pa.id}`, { qty: 2 });
  check('cart PUT 204', r.status === 204, r.text);
  r = await alice2.put(`/account/cart/${pa.id}`, { qty: 3 });
  r = await alice2.put(`/account/cart/${pb.id}`, { qty: 1 });
  r = await alice2.put('/account/cart/nope', { qty: 1 });
  check('cart unknown product → 404', r.status === 404 && r.json.message === 'Product not found', r.text);
  r = await alice2.put(`/account/cart/${pa.id}`, { qty: 100 });
  check('qty > 99 → 400', r.status === 400, r.text);
  r = await alice2.put(`/account/cart/${pa.id}`, { qty: 1.5 });
  check('fractional qty → 400', r.status === 400, r.text);
  r = await alice2.put(`/account/cart/${pa.id}`, { qty: '2' });
  check('string qty → 400', r.status === 400, r.text);
  r = await alice2.put(`/account/wishlist/${pc.id}`);
  check('wishlist PUT 204', r.status === 204);
  r = await alice2.put(`/account/wishlist/${pc.id}`);
  check('wishlist PUT twice 204', r.status === 204);
  r = await alice2.put('/account/wishlist/nope');
  check('wishlist unknown → 404', r.status === 404);
  r = await alice2.get('/account/state');
  check('state reflects cart', r.json.cart.length === 2 && r.json.cart[0].product.id === pa.id && r.json.cart[0].qty === 3 && r.json.cart[1].qty === 1 && r.json.wishlist.length === 1 && 'image' in r.json.cart[0].product, r.text.slice(0, 300));
  r = await alice2.post('/account/merge', { cart: [{ productId: pa.id, qty: 98 }, { productId: pc.id, qty: 2 }, { productId: 'ghost', qty: 1 }], wishlist: [pc.id, pb.id, 'ghost'] });
  const mergedQty = Object.fromEntries((r.json?.cart || []).map((l) => [l.product.id, l.qty]));
  check('merge adds quantities (capped at 99), ignores unknown', r.status === 200 && mergedQty[pa.id] === 99 && mergedQty[pb.id] === 1 && mergedQty[pc.id] === 2 && !('ghost' in mergedQty), mergedQty);
  check('merge unions wishlist', r.json.wishlist.map((p) => p.id).sort().join() === [pb.id, pc.id].sort().join(), r.json.wishlist.map((p) => p.id));
  r = await alice2.post('/account/merge', { cart: 'x', wishlist: [] });
  check('merge validates body', r.status === 400, r.text);
  r = await alice2.put(`/account/cart/${pb.id}`, { qty: 0 });
  r = await alice2.del(`/account/wishlist/${pb.id}`);
  check('wishlist DELETE 204', r.status === 204);
  r = await alice2.get('/account/state');
  check('qty 0 removes line', !r.json.cart.some((l) => l.product.id === pb.id) && r.json.wishlist.length === 1);
  r = await alice2.del('/account/cart');
  check('clear cart 204', r.status === 204);
  r = await alice2.get('/account/state');
  check('cart empty after clear', r.json.cart.length === 0);

  // ───────────────────────── admin ─────────────────────────
  section('admin');
  r = await anon.get('/admin/products');
  check('admin list needs login', r.status === 401);
  r = await alice2.get('/admin/products');
  check('regular user → 403', r.status === 403 && r.json.message === 'Admin access required', r.text);
  await db.query(`update "User" set role = 'ADMIN' where email = $1`, [aliceEmail]);
  r = await alice2.get('/admin/products?limit=2');
  check('admin sees list (role is read live)', r.status === 200 && r.json.items.length === 2 && r.json.total === total && 'colorHex' in r.json.items[0], r.text.slice(0, 200));
  r = await alice2.get('/admin/products?limit=101');
  check('admin limit > 100 → 400', r.status === 400);
  r = await alice2.get('/admin/products?q=paint');
  check('admin search finds category by name', r.status === 200 && r.json.items.length > 0 && r.json.items.every((p) => p.category === 'paints' || /paint/i.test(p.name)), r.text.slice(0, 200));

  const body = { name: `  Contract Card ${RUN} `, category: 'gift-cards', price: 77, description: ' A test card ', rating: 4.5, colorName: `Contract Teal ${RUN}`, colorHex: '#0d9488', tags: ['  Test ', 'test', 'Contract-Tag', ''] };
  r = await alice2.post('/admin/products', { ...body, category: 'nope' });
  check('create invalid category → 400', r.status === 400, r.text);
  r = await alice2.post('/admin/products', { ...body, rating: 4.55 });
  check('create rating with 2 decimals → 400', r.status === 400, r.text);
  r = await alice2.post('/admin/products', { ...body, price: 0 });
  check('create price 0 → 400', r.status === 400);
  r = await alice2.post('/admin/products', { ...body, colorHex: 'teal' });
  check('create bad hex → 400', r.status === 400 && JSON.stringify(r.json.message).includes('colorHex must look like #RRGGBB'), r.text);
  r = await alice2.post('/admin/products', { ...body, tags: [1] });
  check('create non-string tag → 400', r.status === 400);
  r = await alice2.post('/admin/products', body);
  check('create 201', r.status === 201 && r.json.name === `Contract Card ${RUN}` && r.json.colorHex === '#0D9488' && r.json.tags.join() === 'contract-tag,test' && r.json.images.length === 0, r.text);
  const pid = r.json.id;
  r = await anon.get(`/products/${pid}`);
  check('new product is public', r.status === 200 && r.json.color === '#0D9488');
  r = await alice2.post('/admin/products', { ...body, name: 'Clash', colorHex: '#000000' });
  check('colour name reused with other hex → 409', r.status === 409 && /already exists as #0D9488/.test(r.json.message), r.text);
  r = await alice2.put(`/admin/products/${pid}`, { ...body, name: 'Renamed', price: 88, tags: ['only'] });
  check('update', r.status === 200 && r.json.name === 'Renamed' && r.json.price === 88 && r.json.tags.join() === 'only', r.text);
  r = await alice2.put('/admin/products/nope', body);
  check('update unknown → 404', r.status === 404);
  r = await alice2.put(`/admin/products/${pid}`, { ...body, colorHex: '#111111' });
  check('colour used by this product only: still 409', r.status === 409, r.text);

  r = await alice2.req('POST', `/admin/products/${pid}/images`, upload(pid, Buffer.from('<svg onload=alert(1)>'), 'x.jpg'));
  check('non-image renamed .jpg → 415', r.status === 415, r.text);
  r = await alice2.req('POST', `/admin/products/${pid}/images`, new FormData());
  check('missing file → 400', r.status === 400, r.text);
  r = await alice2.req('POST', `/admin/products/${pid}/images`, upload(pid, PNG, 'a.png', ' First '));
  check('upload png 201', r.status === 201 && r.json.images.length === 1 && r.json.images[0].alt === 'First' && /^https?:\/\/.+\/uploads\/[0-9a-f-]{36}\.png$/.test(r.json.images[0].url), r.text);
  const img1 = r.json.images[0];
  r = await alice2.req('POST', `/admin/products/${pid}/images`, upload(pid, JPG, 'b.png'));
  check('upload jpeg (type from bytes, not name)', r.status === 201 && /\.jpg$/.test(r.json.images[1].url), r.text);
  check('default alt text', r.json.images[1].alt === 'Renamed – photo 2', r.json?.images?.[1]?.alt);
  r = await alice2.req('POST', `/admin/products/${pid}/images`, upload(pid, WEBP, 'c.png'));
  check('upload webp', r.status === 201 && /\.webp$/.test(r.json.images[2].url), r.text);
  const imgs = r.json.images;
  const served = await fetch(imgs[0].url);
  check('uploaded file is served', served.status === 200 && served.headers.get('x-content-type-options') === 'nosniff' && served.headers.get('cross-origin-resource-policy') === 'cross-origin' && /immutable/.test(served.headers.get('cache-control') || ''), [served.status, [...served.headers]]);
  const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
  r = await alice2.req('POST', `/admin/products/${pid}/images`, upload(pid, big));
  check('file over 5MB → 413', r.status === 413, r.status);
  r = await alice2.put(`/admin/products/${pid}/images/order`, { ids: [imgs[2].id, imgs[0].id] });
  check('reorder needs every id → 400', r.status === 400, r.text);
  r = await alice2.put(`/admin/products/${pid}/images/order`, { ids: [imgs[2].id, imgs[0].id, imgs[1].id] });
  check('reorder', r.status === 200 && r.json.images.map((i) => i.id).join() === [imgs[2].id, imgs[0].id, imgs[1].id].join(), r.text);
  r = await anon.get(`/products/${pid}`);
  check('main photo follows order', r.json.image.url === imgs[2].url);
  r = await alice2.del(`/admin/products/${pid}/images/${imgs[0].id}`);
  check('delete image returns product', r.status === 200 && r.json.images.length === 2, r.text);
  const gone = await fetch(imgs[0].url);
  check('deleted image file is removed', gone.status === 404, gone.status);
  r = await alice2.del(`/admin/products/${pid}/images/${imgs[0].id}`);
  check('delete image twice → 404', r.status === 404);
  r = await alice2.del(`/admin/products/${pid}/images/abc`);
  check('image id must be numeric → 400', r.status === 400);
  for (let i = 0; i < 7; i++) r = await alice2.req('POST', `/admin/products/${pid}/images`, upload(pid, PNG));
  check('at most 8 images', r.status === 400 && /at most 8/.test(r.json.message), r.text);

  await alice2.put(`/account/cart/${pid}`, { qty: 1 });
  r = await alice2.del(`/admin/products/${pid}`);
  check('delete product 204', r.status === 204);
  r = await anon.get(`/products/${pid}`);
  check('deleted product is gone', r.status === 404);
  r = await alice2.get('/account/state');
  check('deleted product leaves the cart', !r.json.cart.some((l) => l.product.id === pid));
  r = await alice2.del(`/admin/products/${pid}`);
  check('delete twice → 404', r.status === 404);
  await db.query(`delete from "Color" where name = $1`, [`Contract Teal ${RUN}`]);

  // ───────────────────────── payments ─────────────────────────
  if (PAYMENTS) {
    section('payments');
    const addr = { name: ' Asha ', phone: '9876543210', line1: ' 12 MG Road ', line2: '', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' };
    const buyer = new Browser();
    const buyerEmail = newEmail('buyer');
    const sinkN = mails.length;
    await buyer.post('/auth/register', { name: 'Buyer', email: buyerEmail, password: PASSWORD });
    const vm = await mailTo(buyerEmail, 'verify-email', sinkN);
    await anon.post('/auth/verify-email', { token: tokenFrom(vm, 'verify-email') });

    r = await buyer.post('/checkout', addr);
    check('checkout with empty cart → 400', r.status === 400 && r.json.message === 'Your cart is empty', r.text);
    await buyer.put(`/account/cart/${pa.id}`, { qty: 2 });
    await buyer.put(`/account/cart/${pb.id}`, { qty: 1 });
    r = await buyer.post('/checkout', { ...addr, phone: '12345' });
    check('checkout validates phone', r.status === 400 && JSON.stringify(r.json.message).includes('phone must be a 10-digit Indian mobile number'), r.text);
    r = await buyer.post('/checkout', { ...addr, pincode: '012345' });
    check('checkout validates pincode', r.status === 400 && JSON.stringify(r.json.message).includes('pincode must be 6 digits'), r.text);
    r = await anon.post('/checkout', addr);
    check('checkout needs login', r.status === 401);

    process.env.__RZP_FAIL = '1';
    r = await buyer.post('/checkout', addr);
    check('Razorpay failure → 502', r.status === 502 && r.json.message === 'Could not start the payment. Please try again.', r.text);
    delete process.env.__RZP_FAIL;

    r = await buyer.post('/checkout', addr);
    const expected = (pa.price * 2 + pb.price) * 100;
    check('checkout prices from the database', r.status === 200 && r.json.amount === expected && r.json.currency === 'INR' && /^order_/.test(r.json.razorpayOrderId) && !!r.json.keyId, r.text);
    const lastCall = rzpCalls[rzpCalls.length - 1];
    check('Razorpay got amount, currency, receipt and Basic auth', lastCall.body.amount === expected && lastCall.body.currency === 'INR' && lastCall.body.receipt === r.json.orderId && /^Basic /.test(lastCall.auth || ''), lastCall);
    const co = r.json;
    r = await buyer.get(`/orders/${co.orderId}`);
    check('order is pending with a snapshot of the lines', r.status === 200 && r.json.status === 'PENDING' && r.json.shipName === 'Asha' && r.json.shipLine1 === '12 MG Road' && r.json.shipLine2 === null && r.json.paidAt === null && r.json.items.length === 2 && r.json.items[0].unitPricePaise === pa.price * 100 && r.json.items[0].name === pa.name, r.text);

    const verifyBody = (sig) => ({ orderId: co.orderId, razorpay_order_id: co.razorpayOrderId, razorpay_payment_id: `pay_${RUN}`, razorpay_signature: sig });
    r = await buyer.post('/checkout/verify', verifyBody('0'.repeat(64)));
    check('bad payment signature → 400', r.status === 400 && r.json.message === 'Payment verification failed', r.text);
    r = await buyer.post('/checkout/verify', { ...verifyBody(hmac(KEY_SECRET, `${co.razorpayOrderId}|pay_${RUN}`)), razorpay_order_id: 'order_other' });
    check('mismatched razorpay order → 404', r.status === 404, r.text);
    const stranger = new Browser();
    await stranger.post('/auth/register', { name: 'S', email: newEmail('stranger'), password: PASSWORD });
    r = await stranger.post('/checkout/verify', verifyBody(hmac(KEY_SECRET, `${co.razorpayOrderId}|pay_${RUN}`)));
    check("cannot pay someone else's order", r.status === 404, r.text);
    r = await stranger.get(`/orders/${co.orderId}`);
    check("cannot read someone else's order", r.status === 404 && r.json.message === 'Order not found', r.text);

    r = await buyer.post('/checkout/verify', verifyBody(hmac(KEY_SECRET, `${co.razorpayOrderId}|pay_${RUN}`)));
    check('good signature → PAID', r.status === 200 && r.json.status === 'PAID' && r.json.razorpayPaymentId === `pay_${RUN}` && /^\d{4}-/.test(r.json.paidAt), r.text);
    r = await buyer.get('/account/state');
    check('purchased lines leave the cart', r.json.cart.length === 0, r.text.slice(0, 200));
    r = await buyer.post('/checkout/verify', verifyBody(hmac(KEY_SECRET, `${co.razorpayOrderId}|pay_${RUN}`)));
    check('verify is idempotent', r.status === 200 && r.json.status === 'PAID');

    const event = (type, orderId, payId, amount) => JSON.stringify({ event: type, payload: { payment: { entity: { id: payId, order_id: orderId, amount } } } });
    const hook = (raw, sig) => anon.req('POST', '/webhooks/razorpay', raw, { 'content-type': 'application/json', ...(sig ? { 'x-razorpay-signature': sig } : {}) });
    r = await hook(event('order.paid', co.razorpayOrderId, 'p', expected));
    check('webhook without signature → 401', r.status === 401, r.text);
    r = await hook(event('order.paid', co.razorpayOrderId, 'p', expected), '0'.repeat(64));
    check('webhook with bad signature → 401', r.status === 401);

    // second order, paid only through the webhook
    await buyer.put(`/account/cart/${pa.id}`, { qty: 1 });
    r = await buyer.post('/checkout', addr);
    const co2 = r.json;
    await buyer.put(`/account/cart/${pc.id}`, { qty: 1 }); // added after checkout started: must survive
    let raw = event('order.paid', co2.razorpayOrderId, `pay2_${RUN}`, co2.amount + 100);
    r = await hook(raw, hmac(WEBHOOK_SECRET, raw));
    check('webhook with wrong amount is acknowledged but ignored', r.status === 200 && r.json.received === true);
    r = await buyer.get(`/orders/${co2.orderId}`);
    check('wrong amount leaves order PENDING', r.json.status === 'PENDING', r.json.status);
    raw = event('payment.failed', co2.razorpayOrderId, `pay2_${RUN}`, co2.amount);
    r = await hook(raw, hmac(WEBHOOK_SECRET, raw));
    check('other events are acknowledged', r.status === 200 && r.json.received === true);
    raw = '{"event":"order.paid","payload":{}}';
    r = await hook(raw, hmac(WEBHOOK_SECRET, raw));
    check('malformed event → 400', r.status === 400, r.text);
    raw = event('order.paid', co2.razorpayOrderId, `pay2_${RUN}`, co2.amount);
    r = await hook(raw, hmac(WEBHOOK_SECRET, raw));
    check('webhook marks paid', r.status === 200, r.text);
    r = await hook(raw, hmac(WEBHOOK_SECRET, raw));
    check('webhook replay is harmless', r.status === 200);
    r = await buyer.get(`/orders/${co2.orderId}`);
    check('order PAID via webhook', r.json.status === 'PAID' && r.json.razorpayPaymentId === `pay2_${RUN}`, r.text);
    r = await buyer.get('/account/state');
    check('only purchased lines removed from cart', r.json.cart.length === 1 && r.json.cart[0].product.id === pc.id, r.text.slice(0, 200));
    r = await buyer.get('/orders');
    check('orders list newest first (incl. the abandoned one)', r.status === 200 && r.json.length === 3 && r.json[0].id === co2.orderId && r.json[1].id === co.orderId && r.json[0].items.length === 1, Array.isArray(r.json) ? r.json.map((o) => [o.id, o.createdAt, o.items.length]) : r.text);
    r = await anon.get('/orders');
    check('orders need login', r.status === 401);
    r = await buyer.get('/orders/nope');
    check('unknown order → 404', r.status === 404);

    // ───── order tracking & admin order management ─────
    section('order tracking');
    r = await buyer.get(`/orders/${co.orderId}`);
    check('timeline starts with placed → paid', r.json.events?.map((e) => e.status).join() === 'PENDING,PAID' && r.json.events[0].note === 'Order placed' && r.json.carrier === null, r.json.events);
    r = await buyer.get('/admin/orders');
    check('admin orders need admin', r.status === 403);
    r = await anon.get('/admin/orders');
    check('admin orders need login', r.status === 401);
    r = await alice2.get('/admin/orders?status=NOPE');
    check('bad status filter → 400', r.status === 400, r.text);
    r = await alice2.get(`/admin/orders?q=${encodeURIComponent(buyerEmail)}`);
    check('admin search by customer email', r.status === 200 && r.json.total === 3 && r.json.items[0].customerEmail === buyerEmail && r.json.items[0].id === co2.orderId, r.text.slice(0, 300));
    r = await alice2.get(`/admin/orders?status=PAID&q=${encodeURIComponent(buyerEmail)}`);
    check('admin filter by status', r.json.total === 2 && r.json.items.every((o) => o.status === 'PAID'), r.text.slice(0, 200));
    check('status counts', typeof r.json.counts.PAID === 'number' && r.json.counts.PAID >= 2 && 'DELIVERED' in r.json.counts, r.json.counts);
    r = await alice2.get(`/admin/orders?q=${co.orderId}`);
    check('admin search by order id', r.json.total === 1 && r.json.items[0].id === co.orderId);
    r = await alice2.get(`/admin/orders/${co.orderId}`);
    check('admin detail has customer and next step', r.status === 200 && r.json.customer.email === buyerEmail && r.json.nextStatus === 'PACKED' && r.json.events.length === 2, r.text.slice(0, 300));
    r = await alice2.get('/admin/orders/nope');
    check('admin detail unknown → 404', r.status === 404);

    const pending = (await alice2.get(`/admin/orders?status=PENDING&q=${encodeURIComponent(buyerEmail)}`)).json.items[0];
    r = await alice2.post(`/admin/orders/${pending.id}/status`, { status: 'PACKED' });
    check('cannot pack an unpaid order', r.status === 409 && /not been paid/.test(r.json.message), r.text);
    r = await alice2.post(`/admin/orders/${co.orderId}/status`, { status: 'SHIPPED' });
    check('cannot skip a step', r.status === 409 && /next step .* packed/.test(r.json.message), r.text);
    r = await alice2.post(`/admin/orders/${co.orderId}/status`, { status: 'sideways' });
    check('unknown step → 400', r.status === 400, r.text);
    r = await buyer.post(`/admin/orders/${co.orderId}/status`, { status: 'PACKED' });
    check('customers cannot change status', r.status === 403);
    r = await alice2.post(`/admin/orders/${co.orderId}/status`, { status: 'PACKED' });
    check('pack', r.status === 200 && r.json.status === 'PACKED' && r.json.nextStatus === 'SHIPPED' && r.json.events.at(-1).note === 'Packed and ready to ship', r.text.slice(0, 300));
    r = await alice2.post(`/admin/orders/${co.orderId}/status`, { status: 'PACKED' });
    check('same step twice → 409', r.status === 409);
    const mailsBefore = mails.length;
    r = await alice2.post(`/admin/orders/${co.orderId}/status`, { status: 'SHIPPED', carrier: ' Delhivery ', trackingNumber: ' DL123456 ' });
    check('ship with tracking', r.status === 200 && r.json.status === 'SHIPPED' && r.json.carrier === 'Delhivery' && r.json.trackingNumber === 'DL123456' && /Delhivery.*DL123456/.test(r.json.events.at(-1).note), r.text.slice(0, 300));
    const shipMail = await mailTo(buyerEmail, 'has shipped', mailsBefore);
    check('shipping email sent with tracking', !!shipMail && /DL123456/.test(shipMail) && new RegExp(`/orders/${co.orderId}`).test(shipMail));
    r = await buyer.get(`/orders/${co.orderId}`);
    check('customer sees shipment and timeline', r.json.status === 'SHIPPED' && r.json.carrier === 'Delhivery' && r.json.events.map((e) => e.status).join() === 'PENDING,PAID,PACKED,SHIPPED', r.json.events);
    raw = event('order.paid', co.razorpayOrderId, `pay_${RUN}`, co.amount);
    r = await hook(raw, hmac(WEBHOOK_SECRET, raw));
    check('late webhook replay does not move a shipped order back', r.status === 200);
    r = await buyer.get(`/orders/${co.orderId}`);
    check('still shipped after replay', r.json.status === 'SHIPPED' && r.json.events.length === 4, r.json.status);
    const mailsBefore2 = mails.length;
    r = await alice2.post(`/admin/orders/${co.orderId}/status`, { status: 'DELIVERED', carrier: 'ignored' });
    check('deliver', r.status === 200 && r.json.status === 'DELIVERED' && r.json.nextStatus === null && r.json.carrier === 'Delhivery', r.text.slice(0, 200));
    check('delivery email sent', !!(await mailTo(buyerEmail, 'has been delivered', mailsBefore2)));
    r = await alice2.post(`/admin/orders/${co.orderId}/status`, { status: 'DELIVERED' });
    check('delivered is final', r.status === 409 && /already delivered/.test(r.json.message), r.text);
    r = await alice2.get(`/admin/orders?status=DELIVERED&q=${co.orderId}`);
    check('delivered filter', r.json.total === 1);
  }

  // ───────────────────────── rate limits ─────────────────────────
  section('rate limits');
  const flood = new Browser();
  let last;
  const statuses = [];
  for (let i = 0; i < 7; i++) { last = await flood.post('/auth/forgot-password', { email: aliceEmail }); statuses.push(last.status); }
  // earlier calls in this run already used part of the window, so only the end state is asserted
  check('forgot-password is limited to 5/min', statuses.includes(429) && statuses[statuses.length - 1] === 429, statuses);
  check('429 body', last.json?.statusCode === 429 && /Too Many Requests/.test(last.json.message), last.text);
}

main()
  .catch((e) => { console.log('\nCRASH', e); failures.push('crash'); })
  .finally(async () => {
    try {
      await db.query(`delete from "Order" where "userId" in (select id from "User" where email = any($1))`, [emails]);
      await db.query(`delete from "User" where email = any($1)`, [emails]);
    } catch (e) { console.log('cleanup failed:', e.message); }
    await db.end().catch(() => {});
    console.log(`\n${passed} checks passed, ${failures.length} failed${failures.length ? ': ' + failures.join('; ') : ''}`);
    process.exit(failures.length ? 1 : 0);
  });
