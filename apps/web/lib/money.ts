const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Whole rupees, e.g. 1500 -> ₹1,500 */
export const rupees = (n: number) => inr.format(n);
/** Paise (as stored on orders), e.g. 150000 -> ₹1,500 */
export const fromPaise = (p: number) => inr.format(p / 100);
