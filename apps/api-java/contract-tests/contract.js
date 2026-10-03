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
let savedStock = [];
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
let rzpRefunds = 0;
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
    if (/^\/v1\/payments\/[^/]+\/refund$/.test(req.url) && req.method === 'POST') {
      if (process.env.__RZP_REFUND_FAIL) { res.writeHead(500, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { description: 'Refund boom' } })); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id: `rfnd_${RUN}_${++rzpRefunds}` }));
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
  check('summary fields', first && ['id', 'name', 'category', 'price', 'color', 'colorName', 'tags', 'rating', 'description', 'image', 'stock'].every((k) => k in first), first && Object.keys(first));
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
  // plenty of stock for the products the cart tests use; the real counts are put back at the end
  savedStock = (await db.query('select id, stock, personalizable from "Product" where id = any($1)', [[pa.id, pb.id, pc.id]])).rows;
  await db.query('update "Product" set stock = 1000, personalizable = false where id = any($1)', [[pa.id, pb.id, pc.id]]);
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

  // ───────────────────────── address book ─────────────────────────
  section('address book');
  const A1 = { name: ' Asha Rao ', phone: '9876543210', line1: ' 12 MG Road ', line2: '', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' };
  r = await anon.get('/account/addresses');
  check('addresses need login', r.status === 401);
  r = await alice2.get('/account/addresses');
  check('address book starts empty', r.status === 200 && Array.isArray(r.json) && r.json.length === 0, r.text);
  r = await alice2.post('/account/addresses', { ...A1, phone: '123' });
  check('address validated like checkout', r.status === 400 && JSON.stringify(r.json.message).includes('phone must be a 10-digit Indian mobile number'), r.text);
  r = await alice2.post('/account/addresses', A1);
  check('first address is saved, trimmed, and the default', r.status === 201 && r.json.name === 'Asha Rao' && r.json.line1 === '12 MG Road' && r.json.line2 === null && r.json.isDefault === true, r.text);
  const ad1 = r.json;
  r = await alice2.post('/account/addresses', { ...A1, name: 'Office', city: 'Pune', state: 'Maharashtra', pincode: '411001', line2: ' Floor 2 ' });
  check('second address is not the default', r.status === 201 && r.json.isDefault === false && r.json.line2 === 'Floor 2', r.text);
  const ad2 = r.json;
  r = await alice2.post('/account/addresses', { ...A1, name: 'Parents', city: 'Mysuru', isDefault: true });
  check('new address can take over as default', r.status === 201 && r.json.isDefault === true, r.text);
  const ad3 = r.json;
  r = await alice2.get('/account/addresses');
  check('default listed first, only one default', r.json.length === 3 && r.json[0].id === ad3.id && r.json.filter((a) => a.isDefault).length === 1, r.json.map((a) => [a.name, a.isDefault]));
  r = await alice2.put(`/account/addresses/${ad2.id}`, { ...A1, name: 'Work', city: 'Hyderabad', state: 'Telangana', pincode: '500001', isDefault: true });
  check('update changes fields and can make it the default', r.status === 200 && r.json.name === 'Work' && r.json.city === 'Hyderabad' && r.json.isDefault === true, r.text);
  r = await alice2.get('/account/addresses');
  check('previous default is no longer default', r.json[0].id === ad2.id && r.json.filter((a) => a.isDefault).length === 1);
  r = await alice2.post(`/account/addresses/${ad1.id}/default`);
  check('set default returns the list', r.status === 200 && r.json[0].id === ad1.id && r.json[0].isDefault === true && r.json.filter((a) => a.isDefault).length === 1, r.text);
  r = await alice2.del(`/account/addresses/${ad1.id}`);
  check('delete 204', r.status === 204);
  r = await alice2.get('/account/addresses');
  check('deleting the default promotes the newest remaining', r.json.length === 2 && r.json[0].isDefault === true && r.json[0].id === ad3.id, r.json.map((a) => [a.name, a.isDefault]));
  r = await alice2.del(`/account/addresses/${ad1.id}`);
  check('delete twice → 404', r.status === 404 && r.json.message === 'Address not found');
  const bob = new Browser();
  await bob.post('/auth/register', { name: 'Bob', email: newEmail('bob'), password: PASSWORD });
  r = await bob.get('/account/addresses');
  check("another customer's book is separate", r.status === 200 && r.json.length === 0);
  r = await bob.put(`/account/addresses/${ad3.id}`, A1);
  check("cannot edit someone else's address", r.status === 404);
  r = await bob.del(`/account/addresses/${ad3.id}`);
  check("cannot delete someone else's address", r.status === 404);
  r = await bob.post(`/account/addresses/${ad3.id}/default`);
  check("cannot default someone else's address", r.status === 404);
  for (let i = 0; i < 8; i++) r = await alice2.post('/account/addresses', { ...A1, name: `Extra ${i}` });
  check('book holds up to 10', r.status === 201, r.text);
  r = await alice2.post('/account/addresses', { ...A1, name: 'Eleventh' });
  check('11th address refused', r.status === 400 && /up to 10 addresses/.test(r.json.message), r.text);
  for (const a of (await alice2.get('/account/addresses')).json) await alice2.del(`/account/addresses/${a.id}`);
  r = await alice2.get('/account/addresses');
  check('book can be emptied', r.json.length === 0);

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

  const body = { name: `  Contract Card ${RUN} `, category: 'gift-cards', price: 77, stock: 10, personalizable: false, description: ' A test card ', rating: 4.5, colorName: `Contract Teal ${RUN}`, colorHex: '#0d9488', tags: ['  Test ', 'test', 'Contract-Tag', ''] };
  r = await alice2.post('/admin/products', { ...body, category: 'nope' });
  check('create invalid category → 400', r.status === 400, r.text);
  r = await alice2.post('/admin/products', { ...body, rating: 4.55 });
  check('create rating with 2 decimals → 400', r.status === 400, r.text);
  r = await alice2.post('/admin/products', { ...body, stock: -1 });
  check('create negative stock → 400', r.status === 400 && JSON.stringify(r.json.message).includes('stock must not be less than 0'), r.text);
  r = await alice2.post('/admin/products', { ...body, personalizable: undefined });
  check('create without the personalizable flag → 400', r.status === 400, r.text);
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
    r = await alice2.put('/admin/shipping', { baseFeePaise: 0, freeAbovePaise: null, originPincode: '560001', handlingDays: 1, blockedPrefixes: [] });
    check('shipping switched to free for the order tests', r.status === 200 && r.json.baseFeePaise === 0, r.text);
    const buyer = new Browser();
    const buyerEmail = newEmail('buyer');
    const sinkN = mails.length;
    await buyer.post('/auth/register', { name: 'Buyer', email: buyerEmail, password: PASSWORD });
    const vm = await mailTo(buyerEmail, 'verify-email', sinkN);
    r = await anon.post('/auth/verify-email', { token: tokenFrom(vm, 'verify-email') });
    check('buyer email verified', r.status === 200, [r.status, r.text, vm && vm.slice(Math.max(0, vm.indexOf('verify-email') - 200), vm.indexOf('verify-email') + 300)]);

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
    r = await buyer.get('/account/addresses');
    check('checkout without the flag does not save the address', r.json.length === 0, r.json);
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

    // ───── cancellation and refunds ─────
    section('cancellation and refunds');
    r = await buyer.post('/checkout', { ...addr, saveAddress: true });
    check('checkout with saveAddress still works', r.status === 200, r.text);
    r = await buyer.get('/account/addresses');
    check('checkout saved the address as the default', r.json.length === 1 && r.json[0].name === 'Asha' && r.json[0].line1 === '12 MG Road' && r.json[0].line2 === null && r.json[0].isDefault === true, r.json);
    r = await buyer.post('/checkout', { ...addr, saveAddress: true });
    r = await buyer.get('/account/addresses');
    check('the same address is not saved twice', r.json.length === 1, r.json);
    let payN = 0;
    const checkoutNew = async () => {
      await buyer.put(`/account/cart/${pa.id}`, { qty: 1 });
      let res = await buyer.post('/checkout', addr);
      if (res.status === 429) {
        // checkout is limited to 10 a minute per client; wait for the window to reset
        await new Promise((r) => setTimeout(r, 61_000));
        res = await buyer.post('/checkout', addr);
      }
      return res.json;
    };
    const makePaid = async () => {
      const c = await checkoutNew();
      const pid = `pay_${RUN}_c${++payN}`;
      const v = await buyer.post('/checkout/verify', { orderId: c.orderId, razorpay_order_id: c.razorpayOrderId, razorpay_payment_id: pid, razorpay_signature: hmac(KEY_SECRET, `${c.razorpayOrderId}|${pid}`) });
      return { ...c, paymentId: pid, status: v.json.status };
    };
    const refundCalls = () => rzpCalls.filter((c) => /\/refund$/.test(c.url));

    // unpaid order
    const unpaid = await checkoutNew();
    r = await stranger.post(`/orders/${unpaid.orderId}/cancel`, {});
    check("cannot cancel someone else's order", r.status === 404, r.text);
    r = await anon.post(`/orders/${unpaid.orderId}/cancel`, {});
    check('cancel needs login', r.status === 401);
    r = await buyer.post(`/orders/${unpaid.orderId}/cancel`, { reason: 'x'.repeat(201) });
    check('reason length validated', r.status === 400, r.text);
    let mb = mails.length;
    r = await buyer.post(`/orders/${unpaid.orderId}/cancel`, { reason: '  changed my mind ' });
    check('cancel unpaid order', r.status === 200 && r.json.status === 'CANCELLED' && r.json.refundStatus === null && r.json.cancelReason === 'changed my mind' && r.json.events.at(-1).note === 'Cancelled by you: changed my mind', r.text.slice(0, 300));
    const cancelMail = await mailTo(buyerEmail, 'has been cancelled', mb);
    check('cancellation email says nothing was charged', !!cancelMail && /not charged/.test(cancelMail));
    r = await buyer.post(`/orders/${unpaid.orderId}/cancel`);
    check('cancel twice → 409', r.status === 409 && /already cancelled/.test(r.json.message), r.text);
    const before = refundCalls().length;
    r = await buyer.post('/checkout/verify', { orderId: unpaid.orderId, razorpay_order_id: unpaid.razorpayOrderId, razorpay_payment_id: `pay_${RUN}_late`, razorpay_signature: hmac(KEY_SECRET, `${unpaid.razorpayOrderId}|pay_${RUN}_late`) });
    check('payment after cancellation stays cancelled and is refunded', r.status === 200 && r.json.status === 'CANCELLED' && r.json.refundStatus === 'PROCESSED' && refundCalls().length === before + 1 && refundCalls().at(-1).body.amount === unpaid.amount, r.text.slice(0, 300));
    r = await alice2.post(`/admin/orders/${unpaid.orderId}/status`, { status: 'PACKED' });
    check('cancelled orders cannot move on', r.status === 409 && /already cancelled/.test(r.json.message), r.text);

    // paid order
    const paid1 = await makePaid();
    check('test order is paid', paid1.status === 'PAID');
    mb = mails.length;
    r = await buyer.post(`/orders/${paid1.orderId}/cancel`, {});
    check('cancel paid order refunds it', r.status === 200 && r.json.status === 'CANCELLED' && r.json.refundStatus === 'PROCESSED' && r.json.refundedAt && refundCalls().at(-1).url === `/v1/payments/${paid1.paymentId}/refund` && refundCalls().at(-1).body.amount === paid1.amount && refundCalls().at(-1).body.notes.order === paid1.orderId, r.text.slice(0, 300));
    check('timeline records cancel and refund', r.json.events.map((e) => e.note).join('|').includes('Cancelled by you') && /Refund of ₹\d+ issued/.test(r.json.events.at(-1).note), r.json.events);
    check('cancellation email mentions the refund', /refunding \S+/.test((await mailTo(buyerEmail, 'has been cancelled', mb)) || ''));
    raw = event('order.paid', paid1.razorpayOrderId, paid1.paymentId, paid1.amount);
    r = await hook(raw, hmac(WEBHOOK_SECRET, raw));
    const nRefunds = refundCalls().length;
    r = await buyer.get(`/orders/${paid1.orderId}`);
    check('webhook replay does not revive a cancelled order or refund twice', r.json.status === 'CANCELLED' && refundCalls().length === nRefunds, r.json.status);

    // packed order can still be cancelled by the customer
    const paid2 = await makePaid();
    await alice2.post(`/admin/orders/${paid2.orderId}/status`, { status: 'PACKED' });
    r = await alice2.get(`/admin/orders/${paid2.orderId}`);
    check('admin detail says it can be cancelled', r.json.canCancel === true);
    r = await buyer.post(`/orders/${paid2.orderId}/cancel`, {});
    check('cancel a packed order', r.status === 200 && r.json.status === 'CANCELLED' && r.json.refundStatus === 'PROCESSED', r.text.slice(0, 200));

    // shipped order cannot
    const paid3 = await makePaid();
    await alice2.post(`/admin/orders/${paid3.orderId}/status`, { status: 'PACKED' });
    await alice2.post(`/admin/orders/${paid3.orderId}/status`, { status: 'SHIPPED' });
    const nr = refundCalls().length;
    r = await buyer.post(`/orders/${paid3.orderId}/cancel`, {});
    check('shipped order cannot be cancelled', r.status === 409 && /already shipped/.test(r.json.message) && refundCalls().length === nr, r.text);
    r = await alice2.get(`/admin/orders/${paid3.orderId}`);
    check('admin detail: shipped cannot be cancelled', r.json.canCancel === false);
    r = await alice2.get(`/admin/orders/${co.orderId}`);
    check('admin detail: delivered cannot be cancelled', r.json.canCancel === false);

    // refund failure, then retry
    const paid4 = await makePaid();
    process.env.__RZP_REFUND_FAIL = '1';
    r = await buyer.post(`/orders/${paid4.orderId}/cancel`, {});
    check('refund failure still cancels, marks refund FAILED', r.status === 200 && r.json.status === 'CANCELLED' && r.json.refundStatus === 'FAILED' && r.json.refundedAt === null, r.text.slice(0, 300));
    r = await buyer.post(`/admin/orders/${paid4.orderId}/refund`);
    check('customers cannot retry refunds', r.status === 403);
    r = await alice2.post(`/admin/orders/${paid4.orderId}/refund`);
    check('retry while Razorpay is still failing → 502', r.status === 502, r.text);
    r = await alice2.get(`/admin/orders/${paid4.orderId}`);
    check('refund still FAILED after a failed retry', r.json.refundStatus === 'FAILED');
    delete process.env.__RZP_REFUND_FAIL;
    r = await alice2.post(`/admin/orders/${paid4.orderId}/refund`);
    check('retry succeeds', r.status === 200 && r.json.refundStatus === 'PROCESSED' && /^rfnd_/.test(r.json.refundId || '') || r.json?.refundStatus === 'PROCESSED', r.text.slice(0, 300));
    r = await alice2.post(`/admin/orders/${paid4.orderId}/refund`);
    check('refund twice → 409', r.status === 409, r.text);
    r = await alice2.post(`/admin/orders/${pending.id}/refund`);
    check('nothing to refund on an unpaid order → 409', r.status === 409 && /nothing to refund/.test(r.json.message), r.text);

    // admin cancels
    const paid5 = await makePaid();
    r = await alice2.post(`/admin/orders/${paid5.orderId}/cancel`, { reason: 'out of stock' });
    check('admin cancel + refund', r.status === 200 && r.json.status === 'CANCELLED' && r.json.refundStatus === 'PROCESSED' && r.json.events.some((e) => e.note === 'Cancelled by the shop: out of stock'), r.text.slice(0, 300));
    r = await alice2.get('/admin/orders?status=CANCELLED&limit=100');
    check('cancelled filter and counts', r.json.items.length >= 5 && r.json.counts.CANCELLED >= 5, r.json.counts);

    // ───── coupons ─────
    section('coupons');
    const U = RUN.toUpperCase();
    const input = (o = {}) => ({ code: `P${U}`, type: 'PERCENT', value: 10, maxDiscountPaise: 500, minOrderPaise: 0, perUserLimit: 1, ...o });
    r = await buyer.get('/admin/coupons');
    check('coupon admin needs admin', r.status === 403);
    r = await anon.get('/admin/coupons');
    check('coupon admin needs login', r.status === 401);
    r = await alice2.post('/admin/coupons', input({ code: 'a b' }));
    check('code format validated', r.status === 400 && JSON.stringify(r.json.message).includes('code must be 3-20'), r.text);
    r = await alice2.post('/admin/coupons', input({ type: 'WEIRD' }));
    check('type validated', r.status === 400, r.text);
    r = await alice2.post('/admin/coupons', input({ value: 150 }));
    check('over 100% refused', r.status === 400 && /100%/.test(r.json.message), r.text);
    r = await alice2.post('/admin/coupons', input({ type: 'FLAT', value: 500 }));
    check('cap only for percentage coupons', r.status === 400, r.text);
    r = await alice2.post('/admin/coupons', input({ startsAt: '2030-01-02T00:00:00Z', expiresAt: '2030-01-01T00:00:00Z' }));
    check('expiry must follow start', r.status === 400, r.text);
    r = await alice2.post('/admin/coupons', input({ code: ` p${RUN} ` }));
    check('create coupon (code trimmed and upper-cased)', r.status === 201 && r.json.code === `P${U}` && r.json.type === 'PERCENT' && r.json.state === 'ACTIVE' && r.json.redemptions === 0 && r.json.active === true, r.text);
    const pct = r.json;
    r = await alice2.post('/admin/coupons', input());
    check('duplicate code → 409', r.status === 409, r.text);
    r = await alice2.put(`/admin/coupons/${pct.id}`, input({ description: 'Ten percent', value: 10 }));
    check('update coupon', r.status === 200 && r.json.description === 'Ten percent', r.text);
    r = await alice2.get('/admin/coupons');
    check('list coupons', r.status === 200 && r.json.some((c) => c.id === pct.id));
    r = await alice2.get('/admin/coupons/nope');
    check('unknown coupon → 404', r.status === 404);
    const tmp = (await alice2.post('/admin/coupons', input({ code: `T${U}` }))).json;
    r = await alice2.del(`/admin/coupons/${tmp.id}`);
    check('unused coupon can be deleted', r.status === 204);

    // the buyer's saved cart: pa × 2 and pc × 1
    await buyer.put(`/account/cart/${pa.id}`, { qty: 2 });
    await buyer.put(`/account/cart/${pc.id}`, { qty: 1 });
    const state = (await buyer.get('/account/state')).json;
    const subtotal = state.cart.reduce((n, l) => n + l.product.price * 100 * l.qty, 0);
    const quote = (code) => buyer.post('/coupons/validate', { code });
    const mk = async (o) => (await alice2.post('/admin/coupons', input(o))).json;
    r = await anon.post('/coupons/validate', { code: 'X' });
    check('validate needs login', r.status === 401);
    r = await quote('NOPE-NOPE');
    check('unknown code → 400', r.status === 400 && r.json.message === 'This coupon code is not valid', r.text);
    r = await quote(`p${RUN}`);
    check('quote: percentage with cap', r.status === 200 && r.json.code === `P${U}` && r.json.subtotalPaise === subtotal && r.json.discountPaise === Math.min(Math.floor(subtotal / 10), 500) && r.json.totalPaise === subtotal - r.json.discountPaise, r.text);
    const flat = await mk({ code: `F${U}`, type: 'FLAT', value: 2500, maxDiscountPaise: null, perUserLimit: null });
    r = await quote(flat.code);
    check('quote: flat amount', r.status === 200 && r.json.discountPaise === Math.min(2500, subtotal - 100), r.text);
    const huge = await mk({ code: `H${U}`, type: 'FLAT', value: subtotal * 2, maxDiscountPaise: null, perUserLimit: null });
    r = await quote(huge.code);
    check('never discounts below ₹1', r.status === 200 && r.json.totalPaise === 100, r.text);
    const min = await mk({ code: `M${U}`, type: 'FLAT', value: 100, maxDiscountPaise: null, minOrderPaise: subtotal + 100 });
    r = await quote(min.code);
    check('minimum order enforced', r.status === 400 && /Add ₹1 more/.test(r.json.message), r.text);
    const old = await mk({ code: `E${U}`, expiresAt: '2020-01-01T00:00:00Z' });
    r = await quote(old.code);
    check('expired coupon refused', r.status === 400 && /expired/.test(r.json.message), r.text);
    const soon = await mk({ code: `S${U}`, startsAt: '2099-01-01T00:00:00Z' });
    r = await quote(soon.code);
    check('scheduled coupon refused', r.status === 400 && /not active yet/.test(r.json.message), r.text);
    const off = await mk({ code: `O${U}`, active: false });
    r = await quote(off.code);
    check('switched-off coupon refused', r.status === 400 && /not valid/.test(r.json.message), r.text);
    r = await alice2.get('/admin/coupons');
    check('states in the list', ['EXPIRED', 'SCHEDULED', 'INACTIVE', 'ACTIVE'].every((st) => r.json.some((c) => c.state === st)));

    const payWith = async (code) => {
      let res = await buyer.post('/checkout', { ...addr, couponCode: code });
      if (res.status === 429) { await new Promise((x) => setTimeout(x, 61_000)); res = await buyer.post('/checkout', { ...addr, couponCode: code }); }
      return res;
    };
    r = await payWith('BADCODE');
    check('checkout with an invalid code is refused', r.status === 400 && /not valid/.test(r.json.message), r.text);
    const ordersBefore = (await buyer.get('/orders')).json.length;
    r = await payWith(`p${RUN}`);
    const disc = Math.min(Math.floor(subtotal / 10), 500);
    check('checkout applies the discount on the server', r.status === 200 && r.json.amount === subtotal - disc && rzpCalls.at(-1).body.amount === subtotal - disc, r.text);
    const couponOrder = r.json;
    r = await buyer.get(`/orders/${couponOrder.orderId}`);
    check('order records subtotal, discount and code', r.json.subtotalPaise === subtotal && r.json.discountPaise === disc && r.json.couponCode === `P${U}` && r.json.amount === subtotal - disc, r.text.slice(0, 300));
    check('refused checkout created no order', (await buyer.get('/orders')).json.length === ordersBefore + 1);
    r = await quote(`P${U}`);
    check('one use per customer while the order is open', r.status === 400 && /already used/.test(r.json.message), r.text);
    r = await payWith(`P${U}`);
    check('checkout enforces the per-customer limit too', r.status === 400 && /already used/.test(r.json.message), r.text);
    r = await alice2.get(`/admin/coupons/${pct.id}`);
    check('redemptions counted', r.json.redemptions === 1, r.json);
    r = await alice2.del(`/admin/coupons/${pct.id}`);
    check('used coupon cannot be deleted', r.status === 409, r.text);
    r = await buyer.post(`/orders/${couponOrder.orderId}/cancel`, {});
    check('cancelling the order', r.status === 200);
    r = await quote(`P${U}`);
    check('a cancelled order releases the coupon', r.status === 200, r.text);

    const single = await mk({ code: `L${U}`, type: 'FLAT', value: 100, maxDiscountPaise: null, usageLimit: 1, perUserLimit: null });
    r = await payWith(single.code);
    check('order with a one-time coupon', r.status === 200 && r.json.amount === subtotal - 100, r.text);
    r = await quote(single.code);
    check('usage limit reached', r.status === 400 && /fully redeemed/.test(r.json.message), r.text);
    r = await alice2.get(`/admin/coupons/${single.id}`);
    check('exhausted state', r.json.state === 'EXHAUSTED' && r.json.redemptions === 1, r.json);
    await db.query(`update "Order" set "createdAt" = now() - interval '2 hours' where "couponId" = $1 and status = 'PENDING'`, [single.id]);
    r = await quote(single.code);
    check('an abandoned unpaid order releases the coupon after 30 minutes', r.status === 200, r.text);
    await db.query(`delete from "Order" where "couponId" in (select id from "Coupon" where code like $1)`, [`%${U}`]);
    await db.query(`delete from "Coupon" where code like $1`, [`%${U}`]);
    // ───── shipping ─────
    section('shipping');
    const RULES = { baseFeePaise: 4900, freeAbovePaise: 99900, originPincode: '560001', handlingDays: 1, blockedPrefixes: ['19'] };
    r = await buyer.get('/admin/shipping');
    check('shipping settings need admin', r.status === 403);
    r = await alice2.put('/admin/shipping', { ...RULES, originPincode: '12' });
    check('origin pincode validated', r.status === 400 && JSON.stringify(r.json.message).includes('originPincode must be 6 digits'), r.text);
    r = await alice2.put('/admin/shipping', { ...RULES, blockedPrefixes: ['x'] });
    check('blocked prefixes validated', r.status === 400, r.text);
    r = await alice2.put('/admin/shipping', { ...RULES, baseFeePaise: -1 });
    check('negative fee refused', r.status === 400, r.text);
    r = await alice2.put('/admin/shipping', RULES);
    check('save shipping rules', r.status === 200 && r.json.baseFeePaise === 4900 && r.json.freeAbovePaise === 99900 && r.json.blockedPrefixes.join() === '19', r.text);
    r = await alice2.get('/admin/shipping');
    check('shipping rules persist', r.json.originPincode === '560001' && r.json.handlingDays === 1, r.text);

    r = await anon.get('/shipping/estimate?pincode=560034');
    check('estimate is public; same area is quickest', r.status === 200 && r.json.serviceable === true && r.json.minDays === 2 && r.json.maxDays === 3 && r.json.feePaise === 4900 && r.json.freeAbovePaise === 99900 && /^\d{4}-\d\d-\d\d$/.test(r.json.from) && r.json.to >= r.json.from, r.text);
    r = await anon.get('/shipping/estimate?pincode=110001');
    check('far away takes longer', r.json.minDays === 5 && r.json.maxDays === 8, r.text);
    r = await anon.get('/shipping/estimate?pincode=194101');
    check('blocked area is not serviceable', r.status === 200 && r.json.serviceable === false && r.json.from === null, r.text);
    r = await anon.get('/shipping/estimate?pincode=12345');
    check('bad pincode → 400', r.status === 400 && /6-digit/.test(r.json.message), r.text);
    r = await anon.get('/shipping/estimate');
    check('missing pincode → 400', r.status === 400);

    await buyer.put(`/account/cart/${pa.id}`, { qty: 2 });
    const st = (await buyer.get('/account/state')).json;
    const sub2 = st.cart.reduce((n, l) => n + l.product.price * 100 * l.qty, 0);
    const preview = (b) => buyer.post('/checkout/preview', b);
    r = await anon.post('/checkout/preview', {});
    check('preview needs login', r.status === 401);
    r = await preview({ pincode: '560001' });
    check('preview adds the shipping fee below the threshold', r.status === 200 && r.json.subtotalPaise === sub2 && r.json.shippingPaise === 4900 && r.json.totalPaise === sub2 + 4900 && r.json.discountPaise === 0 && r.json.delivery.serviceable === true, r.text);
    r = await preview({});
    check('preview works without a pincode', r.status === 200 && r.json.delivery === null && r.json.shippingPaise === 4900, r.text);
    r = await preview({ pincode: '5600' });
    check('preview validates the pincode', r.status === 400, r.text);
    r = await preview({ pincode: '194101' });
    check('preview reports an unserviceable pincode', r.status === 200 && r.json.delivery.serviceable === false);
    await alice2.put('/admin/shipping', { ...RULES, freeAbovePaise: sub2 });
    r = await preview({ pincode: '560001' });
    check('free exactly at the threshold', r.json.shippingPaise === 0 && r.json.totalPaise === sub2, r.text);
    await alice2.put('/admin/shipping', { ...RULES, freeAbovePaise: sub2 + 1 });
    r = await preview({ pincode: '560001' });
    check('one paise short is not free', r.json.shippingPaise === 4900, r.text);
    const fs = (await alice2.post('/admin/coupons', { code: `FS${U}`, type: 'FREE_SHIPPING', perUserLimit: null })).json;
    check('free-shipping coupon needs no value', fs.type === 'FREE_SHIPPING' && fs.value === 0, fs);
    r = await preview({ pincode: '560001', couponCode: fs.code.toLowerCase() });
    check('free-shipping coupon waives the fee', r.status === 200 && r.json.shippingPaise === 0 && r.json.freeShipping === true && r.json.discountPaise === 0 && r.json.totalPaise === sub2 && r.json.couponCode === fs.code, r.text);
    r = await buyer.post('/coupons/validate', { code: fs.code });
    check('validate reports free shipping', r.status === 200 && r.json.freeShipping === true && r.json.discountPaise === 0, r.text);
    r = await preview({ pincode: '560001', couponCode: 'NOPE-NOPE' });
    check('preview surfaces coupon errors', r.status === 400 && /not valid/.test(r.json.message), r.text);

    const checkoutRaw = async (body) => {
      let res = await buyer.post('/checkout', body);
      if (res.status === 429) { await new Promise((x) => setTimeout(x, 61_000)); res = await buyer.post('/checkout', body); }
      return res;
    };
    r = await checkoutRaw({ ...addr, pincode: '194101' });
    check('checkout refuses an unserviceable pincode', r.status === 400 && /cannot deliver/.test(r.json.message), r.text);
    r = await checkoutRaw(addr);
    check('checkout charges the shipping fee', r.status === 200 && r.json.amount === sub2 + 4900 && rzpCalls.at(-1).body.amount === sub2 + 4900, r.text);
    const shipOrder = r.json;
    r = await buyer.get(`/orders/${shipOrder.orderId}`);
    check('order records shipping and the delivery window', r.json.shippingPaise === 4900 && r.json.subtotalPaise === sub2 && r.json.amount === sub2 + 4900 && /^\d{4}-\d\d-\d\d$/.test(r.json.estimatedFrom) && r.json.estimatedTo >= r.json.estimatedFrom, r.text.slice(0, 400));
    r = await checkoutRaw({ ...addr, couponCode: fs.code });
    check('checkout with a free-shipping coupon', r.status === 200 && r.json.amount === sub2, r.text);
    r = await buyer.get(`/orders/${r.json.orderId}`);
    check('free-shipping order has no fee', r.json.shippingPaise === 0 && r.json.couponCode === fs.code && r.json.discountPaise === 0, r.text.slice(0, 300));
    await alice2.put('/admin/shipping', { baseFeePaise: 4900, freeAbovePaise: 99900, originPincode: '560001', handlingDays: 1, blockedPrefixes: [] });
    await db.query(`delete from "Order" where "couponId" in (select id from "Coupon" where code like $1)`, [`%${U}`]);
    await db.query(`delete from "Coupon" where code like $1`, [`%${U}`]);

    // ───── stock ─────
    section('stock');
    const mkStock = async (name, stock) => (await alice2.post('/admin/products', { name, category: 'gift-cards', price: 60, stock, personalizable: false, description: 'stock test', rating: 4, colorName: `Stock Teal ${RUN}`, colorHex: '#0d9488', tags: [] })).json;
    const sp = await mkStock(`Stock Test ${RUN}`, 3);
    const stockOf = async (id) => (await anon.get(`/products/${id}`)).json.stock;
    check('product detail shows stock', (await stockOf(sp.id)) === 3);
    r = await anon.get('/products?q=' + encodeURIComponent(`Stock Test ${RUN}`));
    check('listing shows stock', r.json.items[0].stock === 3, r.text.slice(0, 200));
    r = await alice2.put(`/admin/products/${sp.id}/stock`, { stock: 500 });
    check('admin sets stock', r.status === 200 && r.json.stock === 500, r.text);
    check('customers see at most 20', (await stockOf(sp.id)) === 20);
    r = await alice2.put(`/admin/products/${sp.id}/stock`, { stock: -2 });
    check('stock validated', r.status === 400, r.text);
    r = await buyer.put(`/admin/products/${sp.id}/stock`, { stock: 5 });
    check('customers cannot change stock', r.status === 403);
    await alice2.put(`/admin/products/${sp.id}/stock`, { stock: 3 });
    r = await alice2.get(`/admin/products?stock=low&q=${encodeURIComponent(`Stock Test ${RUN}`)}`);
    check('admin low-stock filter', r.status === 200 && r.json.items.some((p) => p.id === sp.id) && r.json.items[0].stock === 3, r.text.slice(0, 200));
    r = await alice2.get(`/admin/products?stock=out&q=${encodeURIComponent(`Stock Test ${RUN}`)}`);
    check('admin out-of-stock filter excludes it', r.json.total === 0, r.text.slice(0, 200));
    r = await alice2.get('/admin/products?stock=weird');
    check('bad stock filter → 400', r.status === 400);

    await buyer.del('/account/cart');
    r = await buyer.put(`/account/cart/${sp.id}`, { qty: 4 });
    check('cannot put more in the cart than is in stock', r.status === 409 && r.json.message === `Only 3 of Stock Test ${RUN} are available`, r.text);
    r = await buyer.put(`/account/cart/${sp.id}`, { qty: 3 });
    check('up to the stock is fine', r.status === 204);
    const out = await mkStock(`Sold Out ${RUN}`, 0);
    r = await buyer.put(`/account/cart/${out.id}`, { qty: 1 });
    check('sold-out product cannot be added', r.status === 409 && /is sold out/.test(r.json.message), r.text);
    await alice2.put(`/admin/products/${sp.id}/stock`, { stock: 2 });
    r = await buyer.post('/account/merge', { cart: [{ productId: sp.id, qty: 5 }, { productId: out.id, qty: 1 }], wishlist: [] });
    const merged = Object.fromEntries(r.json.cart.map((l) => [l.product.id, l.qty]));
    check('merge caps to stock and skips sold-out items', merged[sp.id] === 2 && !(out.id in merged), merged);
    await alice2.put(`/admin/products/${sp.id}/stock`, { stock: 3 });
    await buyer.del('/account/cart');
    await buyer.put(`/account/cart/${sp.id}`, { qty: 3 });
    r = await checkoutRaw(addr);
    check('checkout reserves the stock', r.status === 200 && (await stockOf(sp.id)) === 0, r.text);
    const held = r.json;
    r = await buyer.put(`/account/cart/${sp.id}`, { qty: 1 });
    check('now it is sold out', r.status === 409 && /sold out/.test(r.json.message), r.text);
    await alice2.put(`/admin/products/${sp.id}/stock`, { stock: 1 }); // someone corrected the count, but the cart wants 3
    r = await checkoutRaw(addr);
    check('checkout refuses when the cart wants more than is left', r.status === 409 && r.json.message === `Only 1 of Stock Test ${RUN} is available`, r.text);
    check('a refused checkout keeps nothing reserved', (await stockOf(sp.id)) === 1);
    r = await buyer.post(`/orders/${held.orderId}/cancel`, {});
    check('cancelling gives the units back', r.status === 200 && (await stockOf(sp.id)) === 4, await stockOf(sp.id));
    await alice2.put(`/admin/products/${sp.id}/stock`, { stock: 3 });

    // the abandoned-order clean-up
    await buyer.del('/account/cart');
    await buyer.put(`/account/cart/${sp.id}`, { qty: 2 });
    const abandoned = (await checkoutRaw(addr)).json;
    check('abandoned order is holding stock', (await stockOf(sp.id)) === 1);
    const mailsMark = mails.length;
    await db.query(`update "Order" set "createdAt" = now() - interval '2 hours' where id = $1`, [abandoned.orderId]);
    let reaped = null;
    for (let i = 0; i < 40 && !reaped; i++) {
      await new Promise((x) => setTimeout(x, 500));
      const o = (await buyer.get(`/orders/${abandoned.orderId}`)).json;
      if (o.status === 'CANCELLED') reaped = o;
    }
    check('unpaid order is cancelled after the hold time', !!reaped && reaped.events.at(-1).note === 'Cancelled by the system: Payment was not completed in time' && reaped.refundStatus === null, reaped && reaped.events);
    check('and its stock is released', (await stockOf(sp.id)) === 3);
    check('no email is sent for it', !mails.slice(mailsMark).some((m) => /has been cancelled/.test(decodeQp(m)) && decodeQp(m).includes(abandoned.orderId)));
    r = await buyer.post('/checkout/verify', { orderId: abandoned.orderId, razorpay_order_id: abandoned.razorpayOrderId, razorpay_payment_id: `pay_${RUN}_stale`, razorpay_signature: hmac(KEY_SECRET, `${abandoned.razorpayOrderId}|pay_${RUN}_stale`) });
    check('a payment that still arrives is refunded', r.status === 200 && r.json.status === 'CANCELLED' && r.json.refundStatus === 'PROCESSED', r.text.slice(0, 200));
    check('late payment does not take the stock again', (await stockOf(sp.id)) === 3);

    // two people, one unit
    const rival = new Browser();
    const rivalEmail = newEmail('rival');
    const mk0 = mails.length;
    await rival.post('/auth/register', { name: 'Rival', email: rivalEmail, password: PASSWORD });
    await db.query(`update "User" set "emailVerifiedAt" = now() where email = $1`, [rivalEmail]);
    for (let attempt = 0; attempt < 2; attempt++) {
      await alice2.put(`/admin/products/${sp.id}/stock`, { stock: 1 });
      for (const who of [buyer, rival]) { await who.del('/account/cart'); await who.put(`/account/cart/${sp.id}`, { qty: 1 }); }
      const [x, y] = await Promise.all([buyer.post('/checkout', addr), rival.post('/checkout', addr)]);
      if (x.status === 429 || y.status === 429) { await new Promise((z) => setTimeout(z, 61_000)); continue; }
      const codes = [x.status, y.status].sort();
      check('only one of two simultaneous buyers gets the last unit', codes[0] === 200 && codes[1] === 409, [x.status, y.status, x.text, y.text]);
      check('the loser is told it is sold out', [x, y].find((q) => q.status === 409).json.message.includes('sold out'));
      check('stock is exactly zero, never negative', (await stockOf(sp.id)) === 0);
      break;
    }
    for (const who of [buyer, rival]) await who.del('/account/cart');
    await db.query(`delete from "Order" where id in (select "orderId" from "OrderItem" where "productId" in ($1, $2))`, [sp.id, out.id]);
    await alice2.del(`/admin/products/${sp.id}`);
    await alice2.del(`/admin/products/${out.id}`);
    await db.query(`delete from "Color" where name = $1`, [`Stock Teal ${RUN}`]);

    // ───── personalised cards ─────
    section('personalised cards');
    const card = (await alice2.post('/admin/products', { name: `Personal Card ${RUN}`, category: 'wedding-cards', price: 40, stock: 500, personalizable: true, description: 'p', rating: 4, colorName: `Personal Rose ${RUN}`, colorHex: '#e11d48', tags: [] })).json;
    check('admin can mark a product personalisable', card.personalizable === true, card);
    r = await anon.get(`/products/${card.id}`);
    check('product detail says it can be personalised', r.json.personalizable === true && (await anon.get(`/products/${pa.id}`)).json.personalizable === false);
    const future = new Date(Date.now() + 120 * 86400_000).toISOString().slice(0, 10);
    const D = { partnerOne: ' Asha ', partnerTwo: 'Rohan', eventDate: future, venue: ' Taj Hotel, Bengaluru ', note: ' With love ' };
    await buyer.del('/account/cart');
    r = await buyer.put(`/account/cart/${card.id}`, { qty: 2, personalization: { ...D, eventDate: '2020-01-01' } });
    check('past event date refused', r.status === 400 && /cannot be in the past/.test(r.json.message), r.text);
    r = await buyer.put(`/account/cart/${card.id}`, { qty: 2, personalization: { ...D, eventDate: 'tomorrow' } });
    check('bad date refused', r.status === 400, r.text);
    r = await buyer.put(`/account/cart/${card.id}`, { qty: 2, personalization: { ...D, partnerOne: '' } });
    check('names are required', r.status === 400 && JSON.stringify(r.json.message).includes('partnerOne must be longer'), r.text);
    r = await buyer.put(`/account/cart/${card.id}`, { qty: 2, personalization: { ...D, venue: 'x'.repeat(121) } });
    check('venue length limited', r.status === 400, r.text);
    r = await buyer.put(`/account/cart/${pa.id}`, { qty: 1, personalization: D });
    check('plain products cannot be personalised', r.status === 400 && /cannot be personalised/.test(r.json.message), r.text);
    r = await buyer.put(`/account/cart/${card.id}`, { qty: 2 });
    check('a personalised product can sit in the cart without details yet', r.status === 204);
    r = await buyer.del('/account/cart'); // (cart cleared) then checkout attempt with an empty-detail line
    await buyer.put(`/account/cart/${card.id}`, { qty: 2 });
    r = await checkoutRaw(addr);
    check('checkout needs the card details', r.status === 400 && r.json.message === `Add the card details for Personal Card ${RUN} before checking out`, r.text);
    r = await buyer.put(`/account/cart/${card.id}`, { qty: 2, personalization: D });
    check('save the details', r.status === 204, r.text);
    r = await buyer.get('/account/state');
    const line = r.json.cart.find((l) => l.product.id === card.id);
    check('cart returns the cleaned-up details', line.qty === 2 && line.personalization.partnerOne === 'Asha' && line.personalization.venue === 'Taj Hotel, Bengaluru' && line.personalization.note === 'With love' && line.personalization.eventDate === future && line.product.personalizable === true, line);
    await buyer.put(`/account/cart/${card.id}`, { qty: 3 });
    r = await buyer.get('/account/state');
    check('changing the quantity keeps the details', r.json.cart[0].qty === 3 && r.json.cart[0].personalization.partnerTwo === 'Rohan');
    await db.query(`update "CartItem" set personalization = jsonb_set(personalization, '{eventDate}', '"2020-05-05"') where "productId" = $1`, [card.id]);
    r = await checkoutRaw(addr);
    check('details whose date has passed must be updated', r.status === 400 && /need updating/.test(r.json.message), r.text);
    await buyer.put(`/account/cart/${card.id}`, { qty: 3, personalization: D });
    r = await checkoutRaw(addr);
    check('checkout with details works', r.status === 200, r.text);
    const pOrder = r.json;
    r = await buyer.get(`/orders/${pOrder.orderId}`);
    const pItem = r.json.items.find((i) => i.productId === card.id);
    check('order keeps a copy of the details', pItem.personalization.partnerOne === 'Asha' && pItem.personalization.eventDate === future && pItem.personalization.note === 'With love', pItem);
    await buyer.put(`/account/cart/${card.id}`, { qty: 1, personalization: { ...D, partnerOne: 'Changed' } });
    r = await buyer.get(`/orders/${pOrder.orderId}`);
    check('later cart edits do not change the order', r.json.items.find((i) => i.productId === card.id).personalization.partnerOne === 'Asha');
    r = await alice2.get(`/admin/orders/${pOrder.orderId}`);
    check('admin sees the details to print', r.json.items.find((i) => i.productId === card.id).personalization.venue === 'Taj Hotel, Bengaluru');
    r = await buyer.get('/orders');
    check('orders list carries them too', r.json.find((o) => o.id === pOrder.orderId).items.some((i) => i.personalization));
    await buyer.del('/account/cart');
    await buyer.post(`/orders/${pOrder.orderId}/cancel`, {});

    // guest cart merged at login
    r = await buyer.post('/account/merge', { cart: [{ productId: card.id, qty: 2, personalization: D }, { productId: pa.id, qty: 1 }], wishlist: [] });
    const mc = r.json.cart.find((l) => l.product.id === card.id);
    check('merge brings the details along', mc && mc.personalization && mc.personalization.partnerOne === 'Asha', r.text.slice(0, 300));
    check('merge does not invent details for plain products', r.json.cart.find((l) => l.product.id === pa.id).personalization === null);
    await buyer.del('/account/cart');
    r = await buyer.post('/account/merge', { cart: [{ productId: card.id, qty: 1, personalization: { ...D, eventDate: '2020-01-01' } }], wishlist: [] });
    check('merge keeps the item but drops details that no longer make sense', r.status === 200 && r.json.cart.length === 1 && r.json.cart[0].personalization === null, r.text.slice(0, 300));
    await buyer.del('/account/cart');
    await db.query(`delete from "Order" where id in (select "orderId" from "OrderItem" where "productId" = $1)`, [card.id]);
    await alice2.del(`/admin/products/${card.id}`);
    await db.query(`delete from "Color" where name = $1`, [`Personal Rose ${RUN}`]);

    // ───── invoices ─────
    section('invoices');
    const { execFileSync } = require('child_process');
    const pdfText = (buf) => { try { return execFileSync('pdftotext', ['-layout', '-', '-'], { input: buf }).toString(); } catch { return null; } };
    const getPdf = async (browser, path) => {
      const res = await fetch(BASE + path, { headers: { cookie: browser.cookie } });
      return { status: res.status, type: res.headers.get('content-type'), disp: res.headers.get('content-disposition'), buf: Buffer.from(await res.arrayBuffer()) };
    };
    const GOOD = { legalName: ' Decors Test Pvt Ltd ', addressLines: '1 Test Street\nBengaluru 560001', gstin: '29abcde1234f1z5', stateName: 'Karnataka', stateCode: '29', contactEmail: 'billing@example.test', invoicePrefix: 'dec', shippingGstPercent: 18,
      rates: { 'wedding-cards': { ratePercent: 12, hsn: '4909' }, 'gift-cards': { ratePercent: 12, hsn: '4909' }, 'wall-decor': { ratePercent: 18, hsn: '8306' }, paints: { ratePercent: 18, hsn: '3208' } } };
    r = await buyer.get('/admin/business');
    check('business settings need admin', r.status === 403);
    r = await alice2.get('/admin/business');
    check('business defaults', r.status === 200 && r.json.business.gstin === null && r.json.rates['wall-decor'].ratePercent === 18 && r.json.business.invoicePrefix === 'INV', r.text.slice(0, 300));
    r = await alice2.put('/admin/business', { ...GOOD, gstin: '123' });
    check('GSTIN validated', r.status === 400 && JSON.stringify(r.json.message).includes('valid 15-character GSTIN'), r.text);
    r = await alice2.put('/admin/business', { ...GOOD, stateCode: '27' });
    check('GSTIN must match the state code', r.status === 400 && /must match the state code/.test(r.json.message), r.text);
    r = await alice2.put('/admin/business', { ...GOOD, invoicePrefix: 'TOOLONG' });
    check('prefix validated', r.status === 400, r.text);
    r = await alice2.put('/admin/business', { ...GOOD, rates: { ...GOOD.rates, 'wall-decor': { ratePercent: 40, hsn: '8306' } } });
    check('rate range validated', r.status === 400, r.text);
    r = await alice2.put('/admin/business', { ...GOOD, rates: { widgets: { ratePercent: 5, hsn: '1234' } } });
    check('unknown category refused', r.status === 400 && /unknown category/.test(r.json.message), r.text);
    r = await alice2.put('/admin/business', GOOD);
    check('save business', r.status === 200 && r.json.business.gstin === '29ABCDE1234F1Z5' && r.json.business.legalName === 'Decors Test Pvt Ltd' && r.json.business.invoicePrefix === 'DEC', r.text.slice(0, 300));

    const inv = await makePaid();
    r = await buyer.get(`/orders/${inv.orderId}/invoice.pdf`);
    check('no invoice before shipping', r.status === 409 && /once your order has shipped/.test(r.json.message), r.text);
    r = await anon.get(`/orders/${inv.orderId}/invoice.pdf`);
    check('invoice needs login', r.status === 401);
    r = await stranger.get(`/orders/${inv.orderId}/invoice.pdf`);
    check("cannot read someone else's invoice", r.status === 404);
    r = await buyer.get(`/orders/${paid1.orderId}/invoice.pdf`);
    check('cancelled order has no invoice', r.status === 409 && /cancelled/.test(r.json.message), r.text);
    await alice2.post(`/admin/orders/${inv.orderId}/status`, { status: 'PACKED' });
    await alice2.post(`/admin/orders/${inv.orderId}/status`, { status: 'SHIPPED' });
    let pdf = await getPdf(buyer, `/orders/${inv.orderId}/invoice.pdf`);
    const orderNow = (await buyer.get(`/orders/${inv.orderId}`)).json;
    check('invoice is a PDF download', pdf.status === 200 && pdf.type === 'application/pdf' && pdf.buf.subarray(0, 5).toString() === '%PDF-' && /^attachment; filename="invoice-DEC-\d\d-\d\d-\d{5}\.pdf"$/.test(pdf.disp), [pdf.status, pdf.type, pdf.disp]);
    const text = pdfText(pdf.buf);
    const rsText = (paise) => 'Rs. ' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    if (text) {
      check('invoice shows seller, GSTIN, number and order', /TAX INVOICE/.test(text) && /Decors Test Pvt Ltd/.test(text) && /GSTIN: 29ABCDE1234F1Z5/.test(text) && /DEC\/\d\d-\d\d\/\d{5}/.test(text) && text.includes(inv.orderId), text.slice(0, 600));
      check('same-state sale shows CGST and SGST', /CGST/.test(text) && /SGST/.test(text) && !/IGST/.test(text), text);
      check('invoice total equals what was paid', text.includes(rsText(orderNow.amount)), [rsText(orderNow.amount), text.slice(-500)]);
      check('buyer details are on the invoice', /Asha/.test(text) && /560001/.test(text) && /HSN/.test(text) && /4909|8306|3208/.test(text));
    } else console.log('  (pdftotext not installed: PDF contents were not inspected)');
    const numberOf = (t) => (t && t.match(/DEC\/\d\d-\d\d\/(\d{5})/) || [])[1];
    const again = await getPdf(buyer, `/orders/${inv.orderId}/invoice.pdf`);
    check('the same invoice number is kept', !text || numberOf(pdfText(again.buf)) === numberOf(text));
    const adminPdf = await getPdf(alice2, `/admin/orders/${inv.orderId}/invoice.pdf`);
    check('admin can download it too', adminPdf.status === 200 && adminPdf.buf.subarray(0, 5).toString() === '%PDF-');
    r = await alice2.get(`/admin/orders/${paid1.orderId}/invoice.pdf`);
    check('admin: cancelled order has no invoice', r.status === 409);
    r = await alice2.get('/admin/orders/nope/invoice.pdf');
    check('admin: unknown order → 404', r.status === 404);
    r = await buyer.get(`/admin/orders/${inv.orderId}/invoice.pdf`);
    check('customers cannot use the admin invoice route', r.status === 403);
    r = await buyer.post(`/orders/${inv.orderId}/cancel`, {});
    check('a shipped (invoiced) order can no longer be cancelled', r.status === 409);

    // out of state: IGST, and the next number follows on
    await buyer.put(`/account/cart/${pa.id}`, { qty: 1 });
    const far = (await checkoutRaw({ ...addr, state: 'Maharashtra', pincode: '400001' })).json;
    await buyer.post('/checkout/verify', { orderId: far.orderId, razorpay_order_id: far.razorpayOrderId, razorpay_payment_id: `pay_${RUN}_far`, razorpay_signature: hmac(KEY_SECRET, `${far.razorpayOrderId}|pay_${RUN}_far`) });
    await alice2.post(`/admin/orders/${far.orderId}/status`, { status: 'PACKED' });
    await alice2.post(`/admin/orders/${far.orderId}/status`, { status: 'SHIPPED' });
    const farPdf = await getPdf(buyer, `/orders/${far.orderId}/invoice.pdf`);
    const farText = pdfText(farPdf.buf);
    check('invoice for the other order downloads', farPdf.status === 200);
    if (farText) {
      check('out-of-state sale shows IGST only', /IGST/.test(farText) && !/CGST/.test(farText) && /Place of supply: Maharashtra/.test(farText), farText.slice(0, 700));
      check('invoice numbers are consecutive', Number(numberOf(farText)) === Number(numberOf(text)) + 1, [numberOf(text), numberOf(farText)]);
    }

    // a shop without a GSTIN charges no tax
    await alice2.put('/admin/business', { ...GOOD, gstin: '' });
    const plain = await makePaid();
    await alice2.post(`/admin/orders/${plain.orderId}/status`, { status: 'PACKED' });
    await alice2.post(`/admin/orders/${plain.orderId}/status`, { status: 'SHIPPED' });
    const plainPdf = await getPdf(buyer, `/orders/${plain.orderId}/invoice.pdf`);
    check('unregistered shop: invoice downloads', plainPdf.status === 200);
    const plainText = pdfText(plainPdf.buf);
    if (plainText) check('unregistered shop: no tax columns and a note', /INVOICE/.test(plainText) && !/TAX INVOICE/.test(plainText) && !/GSTIN/.test(plainText) && !/CGST|IGST/.test(plainText) && /not registered under GST/.test(plainText), plainText.slice(0, 600));
    await alice2.put('/admin/business', { legalName: 'Decors', addressLines: 'Add your registered address under Admin > Business', gstin: '', stateName: 'Karnataka', stateCode: '29', contactEmail: '', invoicePrefix: 'INV', shippingGstPercent: 18, rates: { 'wedding-cards': { ratePercent: 12, hsn: '4909' }, 'gift-cards': { ratePercent: 12, hsn: '4909' }, 'wall-decor': { ratePercent: 18, hsn: '8306' }, paints: { ratePercent: 18, hsn: '3208' } } });
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
      for (const row of savedStock) await db.query('update "Product" set stock = $2, personalizable = $3 where id = $1', [row.id, row.stock, row.personalizable]);
    } catch (e) { console.log('could not restore stock:', e.message); }
    try {
      await db.query(`delete from "Order" where "userId" in (select id from "User" where email = any($1))`, [emails]);
      await db.query(`delete from "User" where email = any($1)`, [emails]);
    } catch (e) { console.log('cleanup failed:', e.message); }
    await db.end().catch(() => {});
    console.log(`\n${passed} checks passed, ${failures.length} failed${failures.length ? ': ' + failures.join('; ') : ''}`);
    process.exit(failures.length ? 1 : 0);
  });
