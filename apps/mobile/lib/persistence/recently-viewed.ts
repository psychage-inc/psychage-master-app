// Recently-viewed providers — mobile-local, forward-only versioned migrator
// (Sacred Rule #13) plus a reactive layer so the directory's "recently viewed"
// rail updates as the user opens profiles.
//
// We denormalize a tiny snapshot (id + display name + photo_url) captured at view
// time so the rail renders without re-fetching N providers. These are PUBLIC,
// non-PII provider fields (the same data the public directory shows) — NOT
// symptom / mood / navigator state, which never persists (Sacred Rule #4).
//
// Cap MAX_RECENT, newest-first, deduped by id. RESEED-ON-ANOMALY (derived
// convenience cache, never throws). migrate() is pure (the SR-13 test unit).

import { storage } from '@/lib/adapters/storage';
import type { Storage } from '@/lib/adapters/storage';

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'mobile:recently-viewed-providers';
export const MAX_RECENT = 5;

export interface RecentProvider {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
}

export interface RecentlyViewed {
  readonly version: number;
  readonly items: readonly RecentProvider[];
}

function seed(): RecentlyViewed {
  return { version: SCHEMA_VERSION, items: [] };
}

function normalizeItem(value: unknown): RecentProvider | null {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as { id?: unknown; name?: unknown; photoUrl?: unknown };
  if (typeof e.id !== 'string' || e.id.length === 0) return null;
  if (typeof e.name !== 'string' || e.name.length === 0) return null;
  return { id: e.id, name: e.name, photoUrl: typeof e.photoUrl === 'string' ? e.photoUrl : null };
}

/**
 * Parse + migrate the raw persisted JSON into the current schema.
 * - null / parse failure / non-object / missing or future version → seed.
 * - matching version → items normalized, deduped by id, capped.
 */
export function migrate(rawJson: string | null): RecentlyViewed {
  if (rawJson === null) return seed();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return seed();
  }

  if (typeof parsed !== 'object' || parsed === null) return seed();

  const e = parsed as { version?: unknown; items?: unknown };
  if (typeof e.version !== 'number') return seed();
  if (e.version !== SCHEMA_VERSION) return seed();
  if (!Array.isArray(e.items)) return seed();

  const seen = new Set<string>();
  const items: RecentProvider[] = [];
  for (const raw of e.items) {
    const item = normalizeItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= MAX_RECENT) break;
  }
  return { version: SCHEMA_VERSION, items };
}

/** Pure transform — prepend (newest-first), dedupe by id, cap. Exported for tests. */
export function pushRecent(
  prev: readonly RecentProvider[],
  next: RecentProvider,
): RecentProvider[] {
  const rest = prev.filter((p) => p.id !== next.id);
  return [next, ...rest].slice(0, MAX_RECENT);
}

/** DI-style read → migrate → write-back-if-needed. */
export function loadRecentlyViewed(s: Storage): RecentlyViewed {
  const raw = s.get(STORAGE_KEY);
  const value = migrate(raw);
  if (raw === null || raw !== JSON.stringify(value)) {
    s.set(STORAGE_KEY, JSON.stringify(value));
  }
  return value;
}

// ── reactive singleton layer (useSyncExternalStore-compatible) ───────────────

let cache: RecentlyViewed | null = null;
const listeners = new Set<() => void>();

function ensureLoaded(): RecentlyViewed {
  if (cache === null) cache = loadRecentlyViewed(storage);
  return cache;
}

function write(next: RecentlyViewed): void {
  cache = next;
  storage.set(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

export function getRecentlyViewedSnapshot(): RecentlyViewed {
  return ensureLoaded();
}

export function subscribeRecentlyViewed(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Record a viewed provider (newest-first, deduped, capped). No-op on empty id/name. */
export function recordRecentlyViewed(next: RecentProvider): void {
  if (!next.id || !next.name) return;
  write({ version: SCHEMA_VERSION, items: pushRecent(ensureLoaded().items, next) });
}

/**
 * Drop the in-memory cache and re-notify subscribers so the next read
 * re-hydrates from disk. Used after a disk wipe (S48 delete / privacy clear)
 * so a stale cache can't keep serving — or re-persist — deleted data (PR-013).
 */
export function reloadRecentlyViewedFromDisk(): void {
  cache = null;
  for (const listener of listeners) listener();
}

/** Test seam: drop the in-memory cache + listeners so a fresh-storage test re-hydrates. */
export function __resetRecentlyViewedCacheForTests(): void {
  cache = null;
  listeners.clear();
}
