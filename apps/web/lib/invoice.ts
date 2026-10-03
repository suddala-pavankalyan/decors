import { API } from '@/lib/api';

/**
 * Downloads an invoice PDF. It goes through fetch (with the login cookie) so a problem, such as "the invoice is
 * available once your order has shipped", can be shown as a message instead of a blank browser tab.
 */
export async function downloadInvoice(path: string): Promise<void> {
  const res = await fetch(`${API}${path}`, { credentials: 'include' });
  if (!res.ok) {
    let msg = 'Could not download the invoice. Please try again.';
    try { const j = await res.json(); msg = Array.isArray(j.message) ? j.message.join('. ') : j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'invoice.pdf';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
