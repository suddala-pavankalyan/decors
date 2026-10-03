import type { Address } from '@/lib/account';

export const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';

export const EMPTY_ADDRESS: Address = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

/** The seven delivery fields, shared by checkout and the address book. */
export default function AddressFields({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <>
      <label className="block text-sm font-medium">Full name
        <input className={inputClass} value={value.name} onChange={set('name')} required maxLength={80} autoComplete="name" />
      </label>
      <label className="block text-sm font-medium">Mobile number
        <input className={inputClass} value={value.phone} onChange={set('phone')} required inputMode="numeric"
          pattern="[6-9][0-9]{9}" title="10-digit Indian mobile number" autoComplete="tel-national" />
      </label>
      <label className="block text-sm font-medium">Address line 1
        <input className={inputClass} value={value.line1} onChange={set('line1')} required maxLength={120} autoComplete="address-line1" />
      </label>
      <label className="block text-sm font-medium">Address line 2 (optional)
        <input className={inputClass} value={value.line2} onChange={set('line2')} maxLength={120} autoComplete="address-line2" />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">City
          <input className={inputClass} value={value.city} onChange={set('city')} required maxLength={60} autoComplete="address-level2" />
        </label>
        <label className="block text-sm font-medium">State
          <input className={inputClass} value={value.state} onChange={set('state')} required maxLength={60} autoComplete="address-level1" />
        </label>
        <label className="block text-sm font-medium">Pincode
          <input className={inputClass} value={value.pincode} onChange={set('pincode')} required inputMode="numeric"
            pattern="[1-9][0-9]{5}" title="6-digit pincode" autoComplete="postal-code" />
        </label>
      </div>
    </>
  );
}
