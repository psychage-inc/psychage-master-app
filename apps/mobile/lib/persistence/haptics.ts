// Haptic feedback preference — mobile-local, forward-only versioned migrator
// (Sacred Rule #13: every persisted shape needs a version field + N→N+1
// transform from day one or stored state silently rots across schema bumps).
//
// RESEED-ON-ANOMALY (UI preference, never throws) — copies the
// reminder-settings policy: a corrupt/unknown envelope recovers to the default
// (enabled: true). The only intent that can be lost to external storage
// corruption is a persisted OFF, which is re-settable in one tap; this is NOT
// user-authored record data (which the check-in store quarantines, never
// reseeds).
//
// STORAGE_KEY was reserved in lib/persistence/known-keys.ts (and the storage
// adapter's namespacing comment) before this module existed — the persistence
// test pins the registry containment so the two can't drift.

import type { Storage } from '@/lib/adapters/storage';

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'mobile:haptics-enabled';

export interface HapticSettings {
  readonly version: number;
  /** Is haptic feedback on. Default ON. */
  readonly enabled: boolean;
}

function seed(): HapticSettings {
  return { version: SCHEMA_VERSION, enabled: true };
}

/**
 * Parse + migrate the raw persisted JSON into the current schema.
 * - null → seed.
 * - parse failure / non-object / missing version / future version → seed (reseed-on-anomaly).
 * - matching version → pass-through (only an explicit `false` disables; the
 *   default is ON, so a garbled `enabled` field recovers to enabled).
 */
export function migrate(rawJson: string | null): HapticSettings {
  if (rawJson === null) return seed();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return seed();
  }

  if (typeof parsed !== 'object' || parsed === null) return seed();

  const e = parsed as { version?: unknown; enabled?: unknown };
  if (typeof e.version !== 'number') return seed();
  if (e.version !== SCHEMA_VERSION) return seed(); // future/unmapped older → seed (v1 is first)

  return { version: SCHEMA_VERSION, enabled: e.enabled !== false };
}

/** Read → migrate → write-back-if-needed → return whether haptics are enabled. */
export function loadHapticsEnabled(storage: Storage): boolean {
  const raw = storage.get(STORAGE_KEY);
  const settings = migrate(raw);
  if (raw === null || raw !== JSON.stringify(settings)) {
    storage.set(STORAGE_KEY, JSON.stringify(settings));
  }
  return settings.enabled;
}

/** Persist the toggle (writes a clean v1 envelope). */
export function saveHapticsEnabled(storage: Storage, enabled: boolean): HapticSettings {
  const settings: HapticSettings = { version: SCHEMA_VERSION, enabled };
  storage.set(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}
