/**
 * The shop can focus on one category. While it does, every shopper-facing page shows only that category:
 * the home page, the shop and its filters, search suggestions, and product pages. Nothing is deleted; the
 * other categories stay in the database and the admin area, and come back by setting
 * NEXT_PUBLIC_FOCUS_CATEGORY to an empty value (or "all").
 */
const raw = process.env.NEXT_PUBLIC_FOCUS_CATEGORY;
export const FOCUS_CATEGORY: string | null = raw === undefined ? 'wedding-cards' : raw === '' || raw === 'all' ? null : raw;

export const focusName = (FOCUS_CATEGORY ?? '').replace(/-/g, ' ');
