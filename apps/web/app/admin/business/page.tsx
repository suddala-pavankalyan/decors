'use client';
import { useEffect, useState } from 'react';
import AdminGate from '@/components/admin/AdminGate';
import AdminTabs from '@/components/admin/AdminTabs';
import { getBusiness, saveBusiness, type Rates } from '@/lib/adminBusiness';

const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';

interface Form {
  legalName: string; addressLines: string; gstin: string; stateName: string; stateCode: string; contactEmail: string;
  invoicePrefix: string; shippingGstPercent: string; rates: Record<string, { ratePercent: string; hsn: string }>;
}

function BusinessForm() {
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBusiness().then(({ business: b, rates }) => setForm({
      legalName: b.legalName, addressLines: b.addressLines, gstin: b.gstin ?? '', stateName: b.stateName, stateCode: b.stateCode,
      contactEmail: b.contactEmail ?? '', invoicePrefix: b.invoicePrefix, shippingGstPercent: String(b.shippingGstPercent),
      rates: Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, { ratePercent: String(v.ratePercent), hsn: v.hsn }])),
    })).catch((e) => setError(e.message));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setError(''); setOk('');
    try {
      const rates: Rates = Object.fromEntries(Object.entries(form.rates).map(([k, v]) => [k, { ratePercent: Math.round(Number(v.ratePercent)), hsn: v.hsn.trim() }]));
      await saveBusiness({
        legalName: form.legalName, addressLines: form.addressLines, gstin: form.gstin.trim(), stateName: form.stateName, stateCode: form.stateCode.trim(),
        contactEmail: form.contactEmail.trim(), invoicePrefix: form.invoicePrefix.trim(), shippingGstPercent: Math.round(Number(form.shippingGstPercent)), rates,
      });
      setOk('Saved. New invoices use these details.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }
  const set = (k: Exclude<keyof Form, 'rates'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => form && setForm({ ...form, [k]: e.target.value });
  const setRate = (cat: string, k: 'ratePercent' | 'hsn') => (e: React.ChangeEvent<HTMLInputElement>) =>
    form && setForm({ ...form, rates: { ...form.rates, [cat]: { ...form.rates[cat], [k]: e.target.value } } });

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <h1 className="text-3xl font-bold">Business &amp; GST</h1>
      <p className="text-sm text-slate-500">Printed on every invoice. Leave the GSTIN empty if you are not registered for GST: invoices then show no tax.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      {ok && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
      {!form && !error && <p className="mt-6">Loading…</p>}
      {form && (
        <form onSubmit={submit} aria-label="Business details" className="mt-5 space-y-6">
          <section className="space-y-4 rounded-3xl bg-white p-5 shadow">
            <h2 className="font-semibold">Seller</h2>
            <label className="block text-sm font-medium">Legal name<input className={field} value={form.legalName} onChange={set('legalName')} required maxLength={120} /></label>
            <label className="block text-sm font-medium">Registered address<textarea className={field} rows={3} value={form.addressLines} onChange={set('addressLines')} required maxLength={400} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">GSTIN (optional)<input className={`${field} uppercase`} value={form.gstin} onChange={set('gstin')} maxLength={15} placeholder="29ABCDE1234F1Z5" /></label>
              <label className="text-sm font-medium">Contact email (optional)<input className={field} type="email" value={form.contactEmail} onChange={set('contactEmail')} /></label>
              <label className="text-sm font-medium">State<input className={field} value={form.stateName} onChange={set('stateName')} required maxLength={40} /></label>
              <label className="text-sm font-medium">State code (2 digits)<input className={field} value={form.stateCode} onChange={set('stateCode')} required inputMode="numeric" maxLength={2} /></label>
              <label className="text-sm font-medium">Invoice prefix (1-3 letters)<input className={`${field} uppercase`} value={form.invoicePrefix} onChange={set('invoicePrefix')} required maxLength={3} /></label>
              <label className="text-sm font-medium">GST on shipping (%)<input className={field} type="number" min={0} max={28} value={form.shippingGstPercent} onChange={set('shippingGstPercent')} required /></label>
            </div>
          </section>
          <section className="rounded-3xl bg-white p-5 shadow">
            <h2 className="font-semibold">GST rate and HSN code by category</h2>
            <p className="mb-3 text-xs text-slate-500">Your prices already include GST. Check these with your accountant: they are starting values, not advice.</p>
            <div className="space-y-3">
              {Object.keys(form.rates).map((cat) => (
                <div key={cat} className="grid items-end gap-3 sm:grid-cols-[1fr_120px_160px]">
                  <p className="text-sm font-medium capitalize">{cat.replace('-', ' ')}</p>
                  <label className="text-xs">GST %<input aria-label={`GST % for ${cat}`} className={field} type="number" min={0} max={28} value={form.rates[cat].ratePercent} onChange={setRate(cat, 'ratePercent')} required /></label>
                  <label className="text-xs">HSN<input aria-label={`HSN for ${cat}`} className={field} value={form.rates[cat].hsn} onChange={setRate(cat, 'hsn')} required inputMode="numeric" maxLength={8} /></label>
                </div>
              ))}
            </div>
          </section>
          <p className="text-xs text-slate-500">Invoices are issued when an order ships. Customers in the same state as the seller see CGST + SGST; everyone else sees IGST.</p>
          <button type="submit" disabled={busy} className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
        </form>
      )}
    </main>
  );
}

export default function AdminBusinessPage() {
  return <AdminGate><AdminTabs active="business" /><BusinessForm /></AdminGate>;
}
