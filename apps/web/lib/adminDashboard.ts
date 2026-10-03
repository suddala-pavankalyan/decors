import { API } from '@/lib/api';
import type { OrderStatus } from '@/lib/account';

export interface Kpi { value: number; previous: number }
export interface Day { date: string; revenuePaise: number; orders: number }
export interface Dashboard {
  days: number; from: string; to: string;
  revenue: Kpi; orders: Kpi; newCustomers: Kpi; refunded: Kpi;
  toShip: number; awaitingPayment: number; statusCounts: Record<OrderStatus, number>;
  daily: Day[];
  topProducts: { productId: string | null; name: string; units: number; salesPaise: number }[];
  lowStock: { id: string; name: string; stock: number }[];
  recent: { id: string; createdAt: string; customerName: string; amountPaise: number; status: OrderStatus }[];
}
export interface Customer {
  id: string; name: string; email: string; emailVerified: boolean; role: 'USER' | 'ADMIN'; createdAt: string;
  orders: number; spentPaise: number; lastOrderAt: string | null;
}
export interface CustomerPage { total: number; items: Customer[]; hasMore: boolean }

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}/admin/${path}`, { credentials: 'include', signal, cache: 'no-store' });
  if (!res.ok) {
    let msg = res.status === 403 ? 'You do not have admin access.' : 'Something went wrong. Please try again.';
    try { const j = await res.json(); if (res.status !== 403) msg = Array.isArray(j.message) ? j.message.join('. ') : j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const fetchDashboard = (days: number, signal?: AbortSignal) => get<Dashboard>(`dashboard?days=${days}`, signal);
export const fetchCustomers = (o: { q?: string; offset?: number; signal?: AbortSignal } = {}) => {
  const p = new URLSearchParams();
  if (o.q?.trim()) p.set('q', o.q.trim());
  if (o.offset) p.set('offset', String(o.offset));
  const qs = p.toString();
  return get<CustomerPage>(qs ? `customers?${qs}` : 'customers', o.signal);
};

/** Change against the previous period: null when there is nothing to compare with. */
export function change(k: Kpi): { pct: number | null; dir: 'up' | 'down' | 'same' } {
  if (k.value === k.previous) return { pct: 0, dir: 'same' };
  if (k.previous === 0) return { pct: null, dir: 'up' };
  const pct = Math.round(((k.value - k.previous) / k.previous) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'same' };
}
