import { API } from '@/lib/api';

export interface Business {
  legalName: string; addressLines: string; gstin: string | null; stateName: string; stateCode: string; contactEmail: string | null;
  invoicePrefix: string; shippingGstPercent: number;
}
export type Rates = Record<string, { ratePercent: number; hsn: string }>;
export interface BusinessSettings { business: Business; rates: Rates }
export type BusinessInput = Omit<Business, 'gstin' | 'contactEmail'> & { gstin: string; contactEmail: string; rates: Rates };

async function call<T>(method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/admin/business`, {
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

export const getBusiness = () => call<BusinessSettings>('GET');
export const saveBusiness = (b: BusinessInput) => call<BusinessSettings>('PUT', b);
