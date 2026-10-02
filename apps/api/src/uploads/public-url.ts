/** Uploaded images are stored as "/uploads/<file>"; clients need an absolute URL to the API. External URLs pass through. */
export const publicUrl = (u: string): string =>
  u.startsWith('/') ? `${(process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '')}${u}` : u;
