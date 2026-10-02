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
