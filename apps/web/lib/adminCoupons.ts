import { API } from '@/lib/api';

export type CouponState = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SCHEDULED' | 'EXHAUSTED';
export interface Coupon {
  id: string; code: string; description: string | null; type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING'; value: number;
  maxDiscountPaise: number | null; minOrderPaise: number; startsAt: string | null; expiresAt: string | null;
  usageLimit: number | null; perUserLimit: number | null; active: boolean; redemptions: number; state: CouponState; createdAt: string;
}
export interface CouponInput {
  code: string; description?: string; type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING'; value?: number; maxDiscountPaise?: number | null; minOrderPaise?: number;
  startsAt?: string | null; expiresAt?: string | null; usageLimit?: number | null; perUserLimit?: number | null; active?: boolean;
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API}/admin/coupons${path}`, {
    method, credentials: 'include',
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
  return res.status === 204 ? (undefined as T) : res.json();
}

export const listCoupons = () => call<Coupon[]>('');
export const createCoupon = (c: CouponInput) => call<Coupon>('', 'POST', c);
export const updateCoupon = (id: string, c: CouponInput) => call<Coupon>(`/${encodeURIComponent(id)}`, 'PUT', c);
export const deleteCoupon = (id: string) => call<void>(`/${encodeURIComponent(id)}`, 'DELETE');

/** A stored coupon back as an input, so a single field (such as "active") can be changed. */
export const toInput = (c: Coupon): CouponInput => ({
  code: c.code, description: c.description ?? undefined, type: c.type, value: c.value, maxDiscountPaise: c.maxDiscountPaise,
  minOrderPaise: c.minOrderPaise, startsAt: c.startsAt, expiresAt: c.expiresAt, usageLimit: c.usageLimit, perUserLimit: c.perUserLimit, active: c.active,
});
