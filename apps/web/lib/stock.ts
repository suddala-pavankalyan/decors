export const LOW_STOCK = 5;

/** What to tell shoppers about stock: nothing while there is plenty. */
export function stockLabel(stock: number | undefined): string | null {
  if (stock === undefined) return null;
  if (stock <= 0) return 'Sold out';
  if (stock <= LOW_STOCK) return `Only ${stock} left`;
  return null;
}
