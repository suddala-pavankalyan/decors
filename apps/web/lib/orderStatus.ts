import type { OrderStatus } from '@/lib/account';

/** Steps in the order they happen. */
export const STEPS: OrderStatus[] = ['PENDING', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED'];

export const STEP_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Order placed',
  PAID: 'Payment received',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
};

/** Short status shown in lists. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Awaiting payment',
  PAID: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  PAID: 'bg-sky-50 text-sky-700',
  PACKED: 'bg-violet-50 text-violet-700',
  SHIPPED: 'bg-fuchsia-50 text-fuchsia-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
};

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
