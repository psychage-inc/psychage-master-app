// PR-001: the haptic toggle must survive relaunch. Persisted behind an SR-13
// versioned envelope with reseed-on-anomaly (UI preference, default ON) —
// mirrors reminder-settings. Old behavior: in-memory only, OFF silently lost.

import { describe, expect, it } from 'vitest';

import type { Storage } from '@/lib/adapters/storage';
import {
  loadHapticsEnabled,
  migrate,
  saveHapticsEnabled,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from '@/lib/persistence/haptics';
import { KNOWN_LOCAL_KEYS } from '@/lib/persistence/known-keys';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => {
      m.set(k, v);
    },
    remove: (k) => {
      m.delete(k);
    },
  };
}

describe('haptics migrate (reseed-on-anomaly)', () => {
  it('seeds enabled:true when no data', () => {
    expect(migrate(null)).toEqual({ version: SCHEMA_VERSION, enabled: true });
  });

  it('reseeds on corrupt JSON, non-object, and missing version', () => {
    expect(migrate('not json')).toEqual(migrate(null));
    expect(migrate('"null"')).toEqual(migrate(null)); // parses to a string, not an object
    expect(migrate('null')).toEqual(migrate(null)); // parses to literal null
    expect(migrate('[1]')).toEqual(migrate(null)); // array envelope — no version field
    expect(migrate(JSON.stringify({ enabled: false }))).toEqual(migrate(null));
  });

  it('reseeds on a future version (downgraded app)', () => {
    expect(migrate(JSON.stringify({ version: 99, enabled: false }))).toEqual(migrate(null));
  });

  it('passes a clean v1 envelope through; only an explicit false disables', () => {
    expect(migrate(JSON.stringify({ version: 1, enabled: false })).enabled).toBe(false);
    expect(migrate(JSON.stringify({ version: 1, enabled: true })).enabled).toBe(true);
    expect(migrate(JSON.stringify({ version: 1, enabled: 'garbage' })).enabled).toBe(true);
  });
});

describe('haptics load/save round-trip', () => {
  it('persists OFF and reads it back (the PR-001 loss case)', () => {
    const storage = memStorage();
    expect(loadHapticsEnabled(storage)).toBe(true); // first launch default
    saveHapticsEnabled(storage, false);
    expect(loadHapticsEnabled(storage)).toBe(false); // "relaunch": OFF survives
    expect(loadHapticsEnabled(storage)).toBe(false); // no reseed on a clean envelope
  });

  it('load writes back a clean envelope over an anomalous one', () => {
    const storage = memStorage();
    storage.set(STORAGE_KEY, '"null"');
    expect(loadHapticsEnabled(storage)).toBe(true);
    expect(storage.get(STORAGE_KEY)).toBe(
      JSON.stringify({ version: SCHEMA_VERSION, enabled: true }),
    );
  });
});

describe('haptics storage key registration', () => {
  it('uses the exact key reserved in KNOWN_LOCAL_KEYS (wipe coverage)', () => {
    expect(STORAGE_KEY).toBe('mobile:haptics-enabled');
    expect(KNOWN_LOCAL_KEYS).toContain(STORAGE_KEY);
  });
});
