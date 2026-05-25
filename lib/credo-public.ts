// lib/credo-public.ts — client-safe Credo exports
// Import from this file in client components that need the public key.
// Do NOT import lib/credo.ts in client components.

export const CREDO_PUBLIC_KEY = process.env.NEXT_PUBLIC_CREDO_PUBLIC_KEY || ''
