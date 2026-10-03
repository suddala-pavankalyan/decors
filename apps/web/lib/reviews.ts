import { API } from '@/lib/api';

export interface Photo { id: number; url: string }
export interface Review {
  id: string; rating: number; title: string | null; body: string; authorName: string; verifiedBuyer: boolean;
  createdAt: string; photos: Photo[]; reply: string | null; repliedAt: string | null;
}
export interface Summary { average: number; count: number; histogram: Record<string, number> }
export interface ReviewPage { summary: Summary; total: number; items: Review[]; hasMore: boolean }
export interface Mine { review: Review | null; status: 'PUBLISHED' | 'HIDDEN' | null; canReview: boolean; reason: string | null }
export type Sort = 'newest' | 'highest' | 'lowest';

async function call<T>(path: string, method = 'GET', body?: unknown, form?: FormData): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method, credentials: 'include', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  if (!res.ok) {
    let msg = 'Something went wrong. Please try again.';
    try { const j = await res.json(); msg = Array.isArray(j.message) ? j.message.join('. ') : j.message ?? msg; } catch {}
    if (res.status === 413) msg = 'That photo is too large (max 5 MB).';
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const base = (id: string) => `/products/${encodeURIComponent(id)}/reviews`;
export const fetchReviews = (id: string, sort: Sort, offset = 0) => call<ReviewPage>(`${base(id)}?sort=${sort}&limit=5&offset=${offset}`);
export const fetchMine = (id: string) => call<Mine>(`${base(id)}/mine`);
export const saveReview = (id: string, r: { rating: number; title: string; body: string }) => call<Mine>(`${base(id)}/mine`, 'PUT', { rating: r.rating, title: r.title || undefined, body: r.body });
export const deleteReview = (id: string) => call<void>(`${base(id)}/mine`, 'DELETE');
export const addPhoto = (id: string, file: File) => { const f = new FormData(); f.append('file', file); return call<Mine>(`${base(id)}/mine/images`, 'POST', undefined, f); };
export const removePhoto = (id: string, imageId: number) => call<Mine>(`${base(id)}/mine/images/${imageId}`, 'DELETE');
