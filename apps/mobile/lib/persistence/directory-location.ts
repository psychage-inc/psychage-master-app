// Directory home location — mobile-local, forward-only versioned migrator
// (Sacred Rule #13) plus a tiny reactive layer so the Find tab's location gate
// flips to the directory the instant setup completes.
//
// WHY THIS EXISTS: the provider directory is filter-first (the search RPC times
// out unscoped over 423k rows). Remembering the user's home state means a
// returning user lands directly in scoped results instead of re-walking a
// location wizard every visit. We persist the chosen STATE (display name + the
// 2-char code the search param needs) and an optional CITY string.
//
// PRIVACY: this is a user-chosen browse scope (a US state / city name), NOT geo
// coordinates and NOT symptom/mood/navigator state. The "near me" lat/long path
// (features/directory/location.ts) remains un-persisted by contract. Do not add
// coordinates to this store.
//
// `configured` separates "the user finished the one-time setup" from "the user
// picked a state" — choosing "Browse all states" completes setup with a null
// state, so the gate passes and the directory opens on its featured slice.
//
// RESEED-ON-ANOMALY (derived preference, never throws) — the appearance/tier-flags
// policy. migrate() is pure and is the unit of the SR-13 persistence test.

import { storage } from '@/lib/adapters/storage';
import type { Storage } from '@/lib/adapters/storage';

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'mobile:directory-location';

export interface DirectoryLocation {
  readonly version: number;
  /** True once the user has completed the one-time location setup. */
  readonly configured: boolean;
  /** Full state name for display, or null ("Browse all states"). */
  readonly stateName: string | null;
  /** 2-char state code for the search param, or null. */
  readonly stateAbbr: string | null;
  /** Optional city scope, or null ("All cities"). */
  readonly city: string | null;
}

function seed(): DirectoryLocation {
  return { version: SCHEMA_VERSION, configured: false, stateName: null, stateAbbr: null, city: null };
}

function normalizeStr(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Parse + migrate the raw persisted JSON into the current schema.
 * - null / parse failure / non-object / missing or future version → seed.
 * - matching version → pass-through (fields normalized).
 */
export function migrate(rawJson: string | null): DirectoryLocation {
  if (rawJson === null) return seed();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return seed();
  }

  if (typeof parsed !== 'object' || parsed === null) return seed();

  const e = parsed as {
    version?: unknown;
    configured?: unknown;
    stateName?: unknown;
    stateAbbr?: unknown;
    city?: unknown;
  };
  if (typeof e.version !== 'number') return seed();
  if (e.version !== SCHEMA_VERSION) return seed();

  return {
    version: SCHEMA_VERSION,
    configured: e.configured === true,
    stateName: normalizeStr(e.stateName),
    stateAbbr: normalizeStr(e.stateAbbr),
    city: normalizeStr(e.city),
  };
}

/** DI-style read → migrate → write-back-if-needed (mirrors loadAppearance). */
export function loadDirectoryLocation(s: Storage): DirectoryLocation {
  const raw = s.get(STORAGE_KEY);
  const value = migrate(raw);
  if (raw === null || raw !== JSON.stringify(value)) {
    s.set(STORAGE_KEY, JSON.stringify(value));
  }
  return value;
}

// ── reactive singleton layer (useSyncExternalStore-compatible) ───────────────

let cache: DirectoryLocation | null = null;
const listeners = new Set<() => void>();

function ensureLoaded(): DirectoryLocation {
  if (cache === null) cache = loadDirectoryLocation(storage);
  return cache;
}

function write(next: DirectoryLocation): void {
  cache = next;
  storage.set(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

/** Stable snapshot until a setter runs — safe for useSyncExternalStore. */
export function getDirectoryLocationSnapshot(): DirectoryLocation {
  return ensureLoaded();
}

export function subscribeDirectoryLocation(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Persist a chosen scope and mark setup complete. */
export function setDirectoryLocation(next: {
  stateName: string | null;
  stateAbbr: string | null;
  city: string | null;
}): void {
  write({
    version: SCHEMA_VERSION,
    configured: true,
    stateName: normalizeStr(next.stateName),
    stateAbbr: normalizeStr(next.stateAbbr),
    city: normalizeStr(next.city),
  });
}

/** Re-open the one-time setup (used by the location chip in a later slice). */
export function resetDirectoryLocation(): void {
  write(seed());
}

/**
 * Drop the in-memory cache and re-notify subscribers so the next read
 * re-hydrates from disk. Used after a disk wipe (S48 delete / privacy clear)
 * so a stale cache can't keep serving — or re-persist — deleted data (PR-013).
 */
export function reloadDirectoryLocationFromDisk(): void {
  cache = null;
  for (const listener of listeners) listener();
}

/** Test seam: drop the in-memory cache + listeners so a fresh-storage test re-hydrates. */
export function __resetDirectoryLocationCacheForTests(): void {
  cache = null;
  listeners.clear();
}
