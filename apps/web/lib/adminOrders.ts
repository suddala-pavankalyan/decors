import { API } from '@/lib/api';
import type { Order, OrderStatus } from '@/lib/account';

export interface AdminOrderRow {
  id: string; createdAt: string; status: OrderStatus; amount: number;
  customerName: string; customerEmail: string; shipName: string; shipCity: string; itemCount: number;
}
export interface AdminOrderPage { total: number; items: AdminOrderRow[]; hasMore: boolean; counts: Record<OrderStatus, number> }
export interface AdminOrder extends Order {
  customer?: { name: string; email: string };
  nextStatus: OrderStatus | null;
  canCancel: boolean;
}

async function call<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}/admin/orders${path}`, {
    method, credentials: 'include', signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.status === 403 ? 'You do not have admin access.' : 'Something went wrong. Please try again.';
    try {
      const j = await res.json();
      if (res.status !== 403) msg = Array.isArray(j.message) ? j.message.join('. ') : j.message ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const listOrders = (o: { status?: string; q?: string; offset?: number; signal?: AbortSignal } = {}) => {
  const p = new URLSearchParams();
  if (o.status) p.set('status', o.status);
  if (o.q?.trim()) p.set('q', o.q.trim());
  if (o.offset) p.set('offset', String(o.offset));
  const qs = p.toString();
  return call<AdminOrderPage>(qs ? `?${qs}` : '', 'GET', undefined, o.signal);
};
export const getOrder = (id: string) => call<AdminOrder>(`/${encodeURIComponent(id)}`);
export const advanceOrder = (id: string, status: OrderStatus, shipment?: { carrier?: string; trackingNumber?: string }) =>
  call<AdminOrder>(`/${encodeURIComponent(id)}/status`, 'POST', { status, ...shipment });
export const cancelOrder = (id: string, reason?: string) =>
  call<AdminOrder>(`/${encodeURIComponent(id)}/cancel`, 'POST', { reason: reason?.trim() || undefined });
export const retryRefund = (id: string) => call<AdminOrder>(`/${encodeURIComponent(id)}/refund`, 'POST');
