import { API } from '@/lib/api';
import type { Photo } from '@/lib/reviews';

export type ReviewStatus = 'PUBLISHED' | 'HIDDEN';
export interface AdminReview {
  id: string; productId: string; productName: string; userName: string; userEmail: string; rating: number; title: string | null; body: string;
  status: ReviewStatus; reply: string | null; repliedAt: string | null; createdAt: string; photos: Photo[];
}
export interface AdminReviewPage { total: number; items: AdminReview[]; hasMore: boolean; counts: Record<ReviewStatus, number> }

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API}/admin/reviews${path}`, {
    method, credentials: 'include', cache: 'no-store',
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

export interface Filters { status: ReviewStatus | ''; rating: number | 0; q: string; offset: number }
export const listReviews = (f: Filters) => {
  const p = new URLSearchParams({ limit: '20', offset: String(f.offset) });
  if (f.status) p.set('status', f.status);
  if (f.rating) p.set('rating', String(f.rating));
  if (f.q.trim()) p.set('q', f.q.trim());
  return call<AdminReviewPage>(`?${p}`);
};
export const updateReview = (id: string, patch: { status?: ReviewStatus; reply?: string | null }) => call<AdminReview>(`/${id}`, 'PUT', patch);
export const deleteReview = (id: string) => call<void>(`/${id}`, 'DELETE');
