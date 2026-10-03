'use client';
import { useState } from 'react';
import { downloadInvoice } from '@/lib/invoice';

export default function InvoiceButton({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    setBusy(true); setError('');
    try { await downloadInvoice(path); } catch (e) { setError(e instanceof Error ? e.message : 'Could not download the invoice'); } finally { setBusy(false); }
  }
  return (
    <div>
      <button type="button" onClick={go} disabled={busy} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold hover:border-fuchsia-400 disabled:opacity-60">
        {busy ? 'Preparing…' : 'Download invoice (PDF)'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
