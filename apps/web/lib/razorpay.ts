// Minimal typing for Razorpay's hosted Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
export interface RazorpayOptions {
  key: string; amount: number; currency: string; order_id: string; name: string; description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', cb: (r: { error: { description: string } }) => void) => void;
}
declare global {
  interface Window { Razorpay?: new (o: RazorpayOptions) => RazorpayInstance }
}

let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser only'));
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error('Could not load the payment window. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return loading;
}
