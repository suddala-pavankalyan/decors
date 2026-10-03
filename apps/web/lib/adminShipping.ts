import { API } from '@/lib/api';

export interface ShippingSettings {
  baseFeePaise: number; freeAbovePaise: number | null; originPincode: string; handlingDays: number; blockedPrefixes: string[];
}

async function call<T>(method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/admin/shipping`, {
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
  return res.json();
}

export const getShipping = () => call<ShippingSettings>('GET');
export const saveShipping = (s: ShippingSettings) => call<ShippingSettings>('PUT', s);
