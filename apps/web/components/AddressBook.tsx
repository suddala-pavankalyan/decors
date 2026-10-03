'use client';
import { useEffect, useState } from 'react';
import {
  createAddress, deleteAddress, fetchAddresses, makeDefaultAddress, updateAddress, type Address, type SavedAddress,
} from '@/lib/account';
import AddressFields, { EMPTY_ADDRESS } from '@/components/AddressFields';

const MAX = 10;
const lines = (a: Address) => [a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join(', ');

/** Saved delivery addresses: add, edit, delete, and choose the default. */
export default function AddressBook() {
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id: string | null; form: Address; makeDefault: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => { fetchAddresses().then(setList).catch((e) => setError(e.message)); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true); setError('');
    try {
      if (editing.id) await updateAddress(editing.id, editing.form, editing.makeDefault || undefined);
      else await createAddress(editing.form, editing.makeDefault);
      setList(await fetchAddresses());
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the address');
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); setList(await fetchAddresses()); setConfirming(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong'); }
    finally { setBusy(false); }
  }

  const startAdd = () => setEditing({ id: null, form: EMPTY_ADDRESS, makeDefault: (list?.length ?? 0) === 0 });
  const startEdit = (a: SavedAddress) => setEditing({
    id: a.id, form: { name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, pincode: a.pincode }, makeDefault: false,
  });

  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      {list === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {list && list.length === 0 && !editing && <p className="text-sm text-slate-500">You have no saved addresses yet. Add one to check out faster.</p>}
      <ul className="space-y-3">
        {list?.map((a) => (
          <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold">{a.name} <span className="font-normal text-slate-500">· {a.phone}</span>
                {a.isDefault && <span className="ml-2 rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700">Default</span>}
              </p>
              <div className="flex flex-wrap gap-3 text-xs font-medium">
                {!a.isDefault && <button type="button" disabled={busy} onClick={() => run(() => makeDefaultAddress(a.id))} className="text-fuchsia-700 hover:underline">Make default</button>}
                <button type="button" onClick={() => startEdit(a)} aria-label={`Edit address for ${a.name}`} className="text-slate-700 hover:underline">Edit</button>
                {confirming === a.id ? (
                  <span className="inline-flex gap-2">
                    <button type="button" disabled={busy} onClick={() => run(() => deleteAddress(a.id))} className="font-semibold text-rose-600">Yes, delete</button>
                    <button type="button" onClick={() => setConfirming(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirming(a.id)} aria-label={`Delete address for ${a.name}`} className="text-rose-600 hover:underline">Delete</button>
                )}
              </div>
            </div>
            <p className="mt-1 text-slate-600">{lines(a)}</p>
          </li>
        ))}
      </ul>

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4" aria-label={editing.id ? 'Edit address' : 'New address'}>
          <AddressFields value={editing.form} onChange={(form) => setEditing({ ...editing, form })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.makeDefault} onChange={(e) => setEditing({ ...editing, makeDefault: e.target.checked })} />
            Use as my default address
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Saving…' : editing.id ? 'Save changes' : 'Save address'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm">Cancel</button>
          </div>
        </form>
      ) : (
        list && (list.length < MAX
          ? <button type="button" onClick={startAdd} className="mt-4 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold hover:border-fuchsia-400">Add an address</button>
          : <p className="mt-3 text-xs text-slate-500">You have saved the maximum of {MAX} addresses.</p>)
      )}
    </div>
  );
}
