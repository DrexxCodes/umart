/**
 * creator cache (If you ain't drexx, leave me alone)
 *
 * Two-tier cache for the creator dashboard:
 *
 * 1. SESSION  — username only, lives in sessionStorage.
 *               Survives page refreshes within the tab, cleared when tab closes.
 *
 * 2. DASHBOARD — full API payload, lives in localStorage with a 10-min TTL.
 *               Survives refreshes and new tabs, but expires after 10 minutes
 *               or when the user logs out.
 */

const DASHBOARD_KEY = 'creator:dashboard'
const USERNAME_KEY  = 'creator:username'
const TTL_MS        = 10 * 60 * 1000   // 10 minutes

interface CacheEntry<T> {
  data: T
  cachedAt: number   // Date.now() timestamp
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeGet<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function safeSet(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // Quota exceeded or private browsing — fail jejely without crashing the app
    console.warn('[creator-cache] Storage write failed:', e)
  }
}

function safeRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch { /* ignore */ }
}

// ── Dashboard cache (localStorage, 10-min TTL) ────────────────────────────────

export function getDashboardCache<T>(): T | null {
  if (typeof window === 'undefined') return null
  const entry = safeGet<CacheEntry<T>>(localStorage, DASHBOARD_KEY)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > TTL_MS) {
    safeRemove(localStorage, DASHBOARD_KEY)
    return null
  }
  return entry.data
}

export function setDashboardCache<T>(data: T): void {
  if (typeof window === 'undefined') return
  const entry: CacheEntry<T> = { data, cachedAt: Date.now() }
  safeSet(localStorage, DASHBOARD_KEY, entry)
}

export function clearDashboardCache(): void {
  if (typeof window === 'undefined') return
  safeRemove(localStorage, DASHBOARD_KEY)
}

// ── Username cache (sessionStorage, session-scoped) ───────────────────────────

export function getUsernameCache(): string | null {
  if (typeof window === 'undefined') return null
  return safeGet<string>(sessionStorage, USERNAME_KEY)
}

export function setUsernameCache(username: string): void {
  if (typeof window === 'undefined') return
  safeSet(sessionStorage, USERNAME_KEY, username)
}

export function clearUsernameCache(): void {
  if (typeof window === 'undefined') return
  safeRemove(sessionStorage, USERNAME_KEY)
}

// ── Logout — clears everything ────────────────────────────────────────────────

export function clearAllCreatorCache(): void {
  clearDashboardCache()
  clearUsernameCache()
}