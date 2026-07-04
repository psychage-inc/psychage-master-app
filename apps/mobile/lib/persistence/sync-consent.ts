// Check-in cloud-backup CONSENT — mobile-local, forward-only versioned migrator
// (Sacred Rule #13) + a reactive layer so the S46 toggle drives the live sync gate
// immediately.
//
// THIS IS THE USER-CONSENT GATE for SR-4's ADR-001 carve-out. The push-only
// check-in backup (lib/check-in-store.ts pushCheckInEntry) is allowed to leave the
// device ONLY when this is true. ADR-001 lets check-ins persist to Supabase as
// "consented self-tracking" — this is the explicit, revocable user consent that
// claim rests on. Default is OFF (opt-in): nothing syncs until the person turns it
// on (App Store Guideline 5.1.1 — data-collection consent).
//
// RESEED-ON-ANOMALY (a derived preference, never throws). `migrate()` is pure and
// is the SR-13 unit; `loadSyncConsent(storage)` is the DI-style read; the pure
// `getCheckInSyncConsent()` is the non-React gate consumed by the push path.

import { storage } from '@/lib/adapters/storage';
import type { Storage } from '@/lib/adapters/storage';

// SCHEMA v2 (2026-06-17): adds `momentSyncConsent` — the SEPARATE consent gate for
// the Moments engine (the evolved check-in). Moments sync is independent of the
// legacy check-in sync, so it has its own flag; both default OFF (opt-in). The
// v1→v2 migrator PRESERVES an existing checkInSyncConsent rather than reseeding it,
// so a user who already opted into check-in backup isn't silently turned off.
export const SCHEMA_VERSION = 2 as const;
export const STORAGE_KEY = 'mobile:sync-consent';

export interface SyncConsentState {
  readonly version: number;
  /** Legacy check-in cloud-backup consent (check-in is being retired; kept for migration). */
  readonly checkInSyncConsent: boolean;
  /** Moments cloud-sync consent (SR-4 / ADR-001 — the evolved check-in). Default OFF. */
  readonly momentSyncConsent: boolean;
}

function seed(): SyncConsentState {
  // Default OFF on both — explicit opt-in. Nothing leaves the device until consented.
  return { version: SCHEMA_VERSION, checkInSyncConsent: false, momentSyncConsent: false };
}

/**
 * Parse + migrate the raw persisted JSON into the current schema.
 * - null / parse failure / non-object / missing version / future version → seed (OFF).
 * - v1 → forward-migrate: keep checkInSyncConsent, add momentSyncConsent = false.
 * - v2 → pass-through (each consent normalized to a strict boolean).
 */
export function migrate(rawJson: string | null): SyncConsentState {
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
    checkInSyncConsent?: unknown;
    momentSyncConsent?: unknown;
  };
  if (typeof e.version !== 'number') return seed();

  // v1 → v2: a pre-Moments install carried only checkInSyncConsent. Forward-migrate
  // by preserving it and defaulting the new moment consent OFF (never silently lose
  // an explicit opt-in; never silently turn one ON).
  if (e.version === 1) {
    return {
      version: SCHEMA_VERSION,
      checkInSyncConsent: e.checkInSyncConsent === true,
      momentSyncConsent: false,
    };
  }

  if (e.version !== SCHEMA_VERSION) return seed();

  return {
    version: SCHEMA_VERSION,
    checkInSyncConsent: e.checkInSyncConsent === true,
    momentSyncConsent: e.momentSyncConsent === true,
  };
}

/** DI-style read → migrate → write-back-if-needed (mirrors loadAppearance). */
export function loadSyncConsent(s: Storage): SyncConsentState {
  const raw = s.get(STORAGE_KEY);
  const state = migrate(raw);
  if (raw === null || raw !== JSON.stringify(state)) {
    s.set(STORAGE_KEY, JSON.stringify(state));
  }
  return state;
}

// ── reactive singleton layer (useSyncExternalStore-compatible) ───────────────

let cache: SyncConsentState | null = null;
const listeners = new Set<() => void>();

function ensureLoaded(): SyncConsentState {
  if (cache === null) cache = loadSyncConsent(storage);
  return cache;
}

function write(next: SyncConsentState): void {
  cache = next;
  storage.set(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

/** Current snapshot (stable identity until a setter runs — safe for useSyncExternalStore). */
export function getSyncConsentSnapshot(): SyncConsentState {
  return ensureLoaded();
}

export function subscribeSyncConsent(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setCheckInSyncConsent(on: boolean): void {
  write({ ...ensureLoaded(), checkInSyncConsent: on });
}

export function setMomentSyncConsent(on: boolean): void {
  write({ ...ensureLoaded(), momentSyncConsent: on });
}

/** Pure read for the push gate (no React) — the user's check-in cloud-backup consent. */
export function getCheckInSyncConsent(): boolean {
  return ensureLoaded().checkInSyncConsent;
}

/** Pure read for the Moments push/pull gate (no React) — the user's moment-sync consent. */
export function getMomentSyncConsent(): boolean {
  return ensureLoaded().momentSyncConsent;
}

/**
 * Drop the in-memory cache and re-notify subscribers so the next read
 * re-hydrates from disk. Used after a disk wipe (S48 delete / privacy clear)
 * so a stale cache can't keep serving — or re-persist — deleted data (PR-013).
 */
export function reloadSyncConsentFromDisk(): void {
  cache = null;
  for (const listener of listeners) listener();
}

/** Test seam: drop the in-memory cache + listeners so a fresh-storage test re-hydrates. */
export function __resetSyncConsentCacheForTests(): void {
  cache = null;
  listeners.clear();
}
