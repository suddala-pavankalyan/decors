import { API } from '@/lib/api';

export interface AdminImage { id: number; url: string; alt: string }
export interface AdminProduct {
  id: string; name: string; category: string; price: number; rating: number; description: string;
  colorName: string; colorHex: string; tags: string[]; images: AdminImage[];
}
export type ProductInput = Omit<AdminProduct, 'id' | 'images'>;

export const MAX_IMAGES = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function call<T>(path: string, method = 'GET', body?: unknown, form?: FormData): Promise<T> {
  const res = await fetch(`${API}/admin/products${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  if (!res.ok) {
    let msg = res.status === 403 ? 'You do not have admin access.' : 'Something went wrong. Please try again.';
    try {
      const j = await res.json();
      if (res.status !== 403) msg = Array.isArray(j.message) ? j.message.join('. ') : j.message ?? msg;
    } catch {}
    if (res.status === 413) msg = 'That image is too large (max 5 MB).';
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const listProducts = () => call<{ total: number; items: AdminProduct[] }>('');
export const getProduct = (id: string) => call<AdminProduct>(`/${encodeURIComponent(id)}`);
export const createProduct = (p: ProductInput) => call<AdminProduct>('', 'POST', p);
export const updateProduct = (id: string, p: ProductInput) => call<AdminProduct>(`/${encodeURIComponent(id)}`, 'PUT', p);
export const deleteProduct = (id: string) => call<void>(`/${encodeURIComponent(id)}`, 'DELETE');
export const uploadImage = (id: string, file: File) => {
  const f = new FormData();
  f.append('file', file);
  return call<AdminProduct>(`/${encodeURIComponent(id)}/images`, 'POST', undefined, f);
};
export const deleteImage = (id: string, imageId: number) =>
  call<AdminProduct>(`/${encodeURIComponent(id)}/images/${imageId}`, 'DELETE');
export const reorderImages = (id: string, ids: number[]) =>
  call<AdminProduct>(`/${encodeURIComponent(id)}/images/order`, 'PUT', { ids });
