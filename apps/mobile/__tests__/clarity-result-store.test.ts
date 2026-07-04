import { describe, expect, it } from 'vitest';

import {
  CLARITY_HISTORY_CAP,
  CLARITY_QUARANTINE_PREFIX,
  CLARITY_SCHEMA_VERSION,
  CLARITY_STORAGE_KEY,
  ClarityResultStore,
} from '@/features/clarity/result-store';
import type { ClarityResult } from '@/features/clarity/types';
import type { Storage } from '@/lib/adapters/storage';

// LOCAL-ONLY history (SR-4) + versioned forward-only migrator (SR-13). The store persists
// composite/tier/domains ONLY — never the raw answers, sub-scores, or flags. Schema is now
// v2 (web vocab + web domain keys); v1 snapshots migrate forward in place.

function makeStorage(seed?: Record<string, string>) {
  const map = new Map<string, string>(seed ? Object.entries(seed) : []);
  const storage: Storage = {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
  return { storage, map };
}

function makeIds() {
  let n = 0;
  return () => `id-${++n}`;
}

const FIXED = new Date('2026-06-15T09:30:00Z');

function setup(seed?: Record<string, string>) {
  const { storage, map } = makeStorage(seed);
  const store = new ClarityResultStore({ storage, now: () => FIXED, generateId: makeIds() });
  return { store, map };
}

const RESULT: ClarityResult = {
  totalScore: 64,
  domainScores: { emotional: 14, vitality: 12, social: 16, cognitive: 10, functioning: 12 },
  subScores: { phq2: 2, gad2: 2, who5Percentage: 60, uclaScore: 4, pssScore: 8 },
  rawScores: { q1: 1, q2: 1 },
  flags: [],
  structuredFlags: [],
  strengths: ['Social Connection', 'Emotional Wellness'],
  growthAreas: ['Stress Load', 'Overall Wellbeing'],
  label: 'Balanced',
  tier: 'balanced',
};

describe('save / getRecent', () => {
  it('save returns a snapshot stamped with id + local date and the kept fields', () => {
    const { store } = setup();
    const snap = store.save(RESULT);
    expect(snap.id).toBe('id-1');
    expect(snap.date).toBe('2026-06-15');
    expect(snap.composite).toBe(64); // from result.totalScore
    expect(snap.tier).toBe('balanced');
    expect(snap.domains).toEqual(RESULT.domainScores);
  });

  it('getRecent returns newest first', () => {
    const { store } = setup();
    store.save({ ...RESULT, totalScore: 50, tier: 'struggling' });
    store.save({ ...RESULT, totalScore: 80, tier: 'thriving' });
    expect(store.getRecent(10).map((s) => s.composite)).toEqual([80, 50]);
  });

  it('replaceLatest swaps the most recent snapshot in place (same id, one row per run)', () => {
    const { store } = setup();
    store.save(RESULT);
    const replaced = store.replaceLatest({ ...RESULT, totalScore: 42, tier: 'struggling' });
    expect(replaced.id).toBe('id-1'); // same run, same row
    expect(store.count).toBe(1);
    expect(store.getRecent(1)[0]?.composite).toBe(42);
    expect(store.getRecent(1)[0]?.tier).toBe('struggling');
  });

  it('replaceLatest on an empty store falls back to a plain save', () => {
    const { store } = setup();
    const snap = store.replaceLatest(RESULT);
    expect(store.count).toBe(1);
    expect(snap.composite).toBe(64);
  });

  it('getRecent(n<=0) returns []', () => {
    const { store } = setup();
    store.save(RESULT);
    expect(store.getRecent(0)).toEqual([]);
    expect(store.getRecent(-1)).toEqual([]);
  });
});

describe('persistence shape (SR-4) — answers / sub-scores / flags never hit disk', () => {
  it('persisted blob is versioned and carries only composite/tier/domains/id/date', () => {
    const { store, map } = setup();
    store.save(RESULT);
    const raw = map.get(CLARITY_STORAGE_KEY) ?? '';
    const parsed = JSON.parse(raw) as { version: number; entries: unknown[] };
    expect(parsed.version).toBe(CLARITY_SCHEMA_VERSION);
    expect(parsed.entries).toHaveLength(1);
    expect(Object.keys(parsed.entries[0] as object).sort()).toEqual([
      'composite', 'date', 'domains', 'id', 'tier',
    ]);
    // No item-level answer keys, no sub-scores, no flags anywhere in the blob.
    expect(raw).not.toMatch(/"q\d+"/);
    expect(raw).not.toContain('rawScores');
    expect(raw).not.toContain('subScores');
    expect(raw).not.toContain('structuredFlags');
  });
});

describe('history cap', () => {
  it('keeps at most CLARITY_HISTORY_CAP snapshots (newest retained)', () => {
    const { store } = setup();
    for (let i = 0; i < CLARITY_HISTORY_CAP + 5; i++) {
      store.save({ ...RESULT, totalScore: i });
    }
    expect(store.count).toBe(CLARITY_HISTORY_CAP);
    expect(store.getRecent(1)[0]?.composite).toBe(CLARITY_HISTORY_CAP + 4);
  });
});

describe('migrator (SR-13) — quarantine corrupt blobs, migrate v1 forward', () => {
  it('unparseable JSON → quarantined verbatim, store recovers empty, primary reset to v2', () => {
    const { store, map } = setup({ [CLARITY_STORAGE_KEY]: '{not json' });
    expect(store.count).toBe(0);
    const quarantined = [...map.keys()].filter((k) => k.startsWith(CLARITY_QUARANTINE_PREFIX));
    expect(quarantined).toHaveLength(1);
    expect(map.get(quarantined[0] ?? '')).toBe('{not json');
    expect(JSON.parse(map.get(CLARITY_STORAGE_KEY) ?? '{}').version).toBe(CLARITY_SCHEMA_VERSION);
  });

  it('a future version → quarantined, recovers none', () => {
    const blob = JSON.stringify({ version: 999, entries: [] });
    const { store, map } = setup({ [CLARITY_STORAGE_KEY]: blob });
    expect(store.count).toBe(0);
    expect([...map.keys()].some((k) => k.startsWith(CLARITY_QUARANTINE_PREFIX))).toBe(true);
  });

  it('a valid v2 blob loads cleanly with no quarantine', () => {
    const { store: seedStore, map } = setup();
    seedStore.save(RESULT);
    const blob = map.get(CLARITY_STORAGE_KEY) ?? '';

    const { store, map: map2 } = setup({ [CLARITY_STORAGE_KEY]: blob });
    expect(store.count).toBe(1);
    expect([...map2.keys()].some((k) => k.startsWith(CLARITY_QUARANTINE_PREFIX))).toBe(false);
  });

  it('a v1 blob migrates forward: tier vocab + domain keys remapped, no quarantine', () => {
    const v1 = JSON.stringify({
      version: 1,
      entries: [
        {
          id: 'a',
          date: '2026-06-01',
          composite: 50,
          tier: 'mixed', // → struggling
          domains: { emotional: 10, wellbeing: 8, social: 12, stress: 6, functioning: 14 },
        },
        {
          id: 'b',
          date: '2026-06-05',
          composite: 15,
          tier: 'reachOut', // → crisis
          domains: { emotional: 2, wellbeing: 4, social: 3, stress: 1, functioning: 5 },
        },
      ],
    });
    const { store, map } = setup({ [CLARITY_STORAGE_KEY]: v1 });

    expect(store.count).toBe(2);
    expect([...map.keys()].some((k) => k.startsWith(CLARITY_QUARANTINE_PREFIX))).toBe(false);

    const recent = store.getRecent(2); // newest first: b, then a
    expect(recent[0]?.tier).toBe('crisis');
    expect(recent[1]?.tier).toBe('struggling');
    // wellbeing → vitality, stress → cognitive
    expect(recent[1]?.domains).toEqual({ emotional: 10, vitality: 8, social: 12, cognitive: 6, functioning: 14 });

    // The primary key is rewritten as a v2 envelope (forward-only upgrade on disk).
    expect(JSON.parse(map.get(CLARITY_STORAGE_KEY) ?? '{}').version).toBe(CLARITY_SCHEMA_VERSION);
  });

  it('a v1 blob with one malformed entry recovers the good and quarantines the raw', () => {
    const v1 = JSON.stringify({
      version: 1,
      entries: [
        { id: 'a', date: '2026-06-01', composite: 50, tier: 'mixed', domains: { emotional: 10, wellbeing: 8, social: 12, stress: 6, functioning: 14 } },
        { id: 'b', date: 'NOT-A-DATE', composite: 10, tier: 'reachOut', domains: { emotional: 2, wellbeing: 4, social: 3, stress: 1, functioning: 5 } },
      ],
    });
    const { store, map } = setup({ [CLARITY_STORAGE_KEY]: v1 });
    expect(store.count).toBe(1);
    expect(store.getRecent(1)[0]?.id).toBe('a');
    expect([...map.keys()].some((k) => k.startsWith(CLARITY_QUARANTINE_PREFIX))).toBe(true);
  });
});
