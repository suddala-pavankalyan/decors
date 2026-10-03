import { API, type Product } from '@/lib/api';

export interface ServerState {
  cart: { qty: number; product: Product }[];
  wishlist: Product[];
}

async function req(path: string, method: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${API}/account/${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`account/${path} failed: ${res.status}`);
  return res;
}

export const fetchState = async (): Promise<ServerState> => (await req('state', 'GET')).json();
export const mergeGuest = async (cart: { productId: string; qty: number }[], wishlist: string[]): Promise<ServerState> =>
  (await req('merge', 'POST', { cart, wishlist })).json();
export const putQty = (id: string, qty: number) => req(`cart/${encodeURIComponent(id)}`, 'PUT', { qty });
export const deleteCart = () => req('cart', 'DELETE');
export const putWish = (id: string) => req(`wishlist/${encodeURIComponent(id)}`, 'PUT');
export const deleteWish = (id: string) => req(`wishlist/${encodeURIComponent(id)}`, 'DELETE');

export type OrderStatus = 'PENDING' | 'PAID' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type RefundStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
export interface OrderEvent { status: OrderStatus; note: string | null; createdAt: string }
export interface OrderItem { id: number; productId: string | null; name: string; unitPricePaise: number; qty: number }
export interface Order {
  id: string; status: OrderStatus; amount: number; subtotalPaise: number; discountPaise: number; couponCode: string | null; currency: string; createdAt: string; paidAt: string | null;
  razorpayPaymentId: string | null;
  shipName: string; shipPhone: string; shipLine1: string; shipLine2: string | null;
  shipCity: string; shipState: string; shipPincode: string;
  carrier: string | null; trackingNumber: string | null;
  cancelReason: string | null; refundStatus: RefundStatus | null; refundedAt: string | null;
  items: OrderItem[];
  events: OrderEvent[];
}
export interface Address { name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string }
export interface CheckoutSession { orderId: string; razorpayOrderId: string; amount: number; currency: string; keyId: string }
export interface PaymentResult { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

async function json<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = 'Something went wrong. Please try again.';
    try { const j = await res.json(); msg = Array.isArray(j.message) ? j.message.join('. ') : j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const startCheckout = (a: Address, saveAddress = false, couponCode?: string) =>
  json<CheckoutSession>('checkout', 'POST', { ...a, line2: a.line2 || undefined, saveAddress, couponCode });

export interface CouponQuote { code: string; description: string | null; subtotalPaise: number; discountPaise: number; totalPaise: number }
export const validateCoupon = (code: string) => json<CouponQuote>('coupons/validate', 'POST', { code });
export const verifyPayment = (orderId: string, r: PaymentResult) => json<Order>('checkout/verify', 'POST', { orderId, ...r });
export const fetchOrders = () => json<Order[]>('orders');
export const fetchOrder = (id: string) => json<Order>(`orders/${encodeURIComponent(id)}`);
export const cancelOrder = (id: string, reason?: string) =>
  json<Order>(`orders/${encodeURIComponent(id)}/cancel`, 'POST', { reason: reason?.trim() || undefined });

export interface SavedAddress extends Address { id: string; line2: string; isDefault: boolean }
type Wire = Omit<SavedAddress, 'line2'> & { line2: string | null };
const fromWire = (a: Wire): SavedAddress => ({ ...a, line2: a.line2 ?? '' });
const body = (a: Address, isDefault?: boolean) => ({ ...a, line2: a.line2 || undefined, isDefault });

export const fetchAddresses = async () => (await json<Wire[]>('account/addresses')).map(fromWire);
export const createAddress = async (a: Address, isDefault = false) => fromWire(await json<Wire>('account/addresses', 'POST', body(a, isDefault)));
export const updateAddress = async (id: string, a: Address, isDefault?: boolean) =>
  fromWire(await json<Wire>(`account/addresses/${encodeURIComponent(id)}`, 'PUT', body(a, isDefault)));
export const makeDefaultAddress = async (id: string) =>
  (await json<Wire[]>(`account/addresses/${encodeURIComponent(id)}/default`, 'POST')).map(fromWire);
export const deleteAddress = (id: string) => json<void>(`account/addresses/${encodeURIComponent(id)}`, 'DELETE');
