import Link from 'next/link';

/** Switches between the admin sections. */
export default function AdminTabs({ active }: { active: 'dashboard' | 'products' | 'orders' | 'customers' | 'coupons' | 'shipping' | 'business' }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${on ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="Admin sections" className="mx-auto mb-5 flex max-w-6xl flex-wrap gap-2 px-4">
      {tab('/admin/dashboard', 'Dashboard', active === 'dashboard')}
      {tab('/admin', 'Products', active === 'products')}
      {tab('/admin/orders', 'Orders', active === 'orders')}
      {tab('/admin/customers', 'Customers', active === 'customers')}
      {tab('/admin/coupons', 'Coupons', active === 'coupons')}
      {tab('/admin/shipping', 'Shipping', active === 'shipping')}
      {tab('/admin/business', 'Business & GST', active === 'business')}
    </nav>
  );
}
