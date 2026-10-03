import type { OrderStatus, RefundStatus } from '@/lib/account';

/** Steps in the order they happen (a cancelled order leaves this path). */
export const STEPS: OrderStatus[] = ['PENDING', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED'];

/** Customers may cancel until the order ships. */
export const canCancel = (s: OrderStatus) => s === 'PENDING' || s === 'PAID' || s === 'PACKED';

export const REFUND_LABEL: Record<RefundStatus, string> = {
  PENDING: 'Refund in progress',
  PROCESSING: 'Refund in progress',
  PROCESSED: 'Refund issued',
  FAILED: 'Refund delayed, we are retrying',
};

export const STEP_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Order placed',
  PAID: 'Payment received',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Short status shown in lists. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Awaiting payment',
  PAID: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  PAID: 'bg-sky-50 text-sky-700',
  PACKED: 'bg-violet-50 text-violet-700',
  SHIPPED: 'bg-fuchsia-50 text-fuchsia-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-rose-50 text-rose-700',
};

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
