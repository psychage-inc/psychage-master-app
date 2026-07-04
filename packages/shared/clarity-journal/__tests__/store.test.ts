import { describe, expect, it } from 'vitest';

import { ClarityJournalStore } from '../record-store';
import { QUARANTINE_KEY_PREFIX, SCHEMA_VERSION, STORAGE_KEY } from '../migrate';
import { ClarityJournalEntryNotFoundError, ClarityJournalValidationError } from '../types';

function makeStore(t0 = '2026-06-16T12:00:00.000Z') {
  const map = new Map<string, string>();
  let n = 0;
  let clock = new Date(t0);
  const storage = {
    get: (k: string) => map.get(k) ?? null,
    set: (k: string, v: string) => {
      map.set(k, v);
    },
  };
  const store = new ClarityJournalStore({ storage, now: () => clock, generateId: () => `id-${++n}` });
  return { store, map, setNow: (iso: string) => { clock = new Date(iso); } };
}

const dailyInput = {
  mood: 6,
  energy: 5,
  sleptLastNight: true,
  sleepHours: 7,
  note: 'ok day',
  tags: ['calm'],
};

describe('ClarityJournalStore — daily check-in', () => {
  it('upserts in place for the same local day (one entry, stable id)', () => {
    const { store } = makeStore();
    const a = store.saveDailyCheckIn(dailyInput);
    const b = store.saveDailyCheckIn({ ...dailyInput, mood: 8 });
    expect(b.id).toBe(a.id);
    expect(store.getRecentDailyCheckIns(10)).toHaveLength(1);
    expect(store.getDailyCheckIn(a.date)?.mood).toBe(8);
  });

  it('rejects out-of-range mood', () => {
    const { store } = makeStore();
    expect(() => store.saveDailyCheckIn({ ...dailyInput, mood: 11 })).toThrow(ClarityJournalValidationError);
  });

  it('rejects an over-long note', () => {
    const { store } = makeStore();
    expect(() => store.saveDailyCheckIn({ ...dailyInput, note: 'x'.repeat(281) })).toThrow(
      ClarityJournalValidationError,
    );
  });

  it('rejects non-finite sleepHours at write (loader parity — NaN dropped the check-in on reload)', () => {
    const { store } = makeStore();
    expect(() => store.saveDailyCheckIn({ ...dailyInput, sleepHours: Number.NaN })).toThrow(
      ClarityJournalValidationError,
    );
    expect(() =>
      store.saveDailyCheckIn({ ...dailyInput, sleepHours: Number.POSITIVE_INFINITY }),
    ).toThrow(ClarityJournalValidationError);
    expect(store.getRecentDailyCheckIns(10)).toHaveLength(0);
  });
});

describe('ClarityJournalStore — screening & reflection (one per week)', () => {
  it('upserts screening per weekStart', () => {
    const { store } = makeStore();
    const s1 = store.saveScreening({ phq2: [1, 1], gad2: [0, 0], pss4: [2, 2], who5: [4, 4] });
    const s2 = store.saveScreening({ phq2: [3, 3], gad2: [1, 1], pss4: [4, 0], who5: [5, 5] });
    expect(s2.id).toBe(s1.id); // same week
    expect(store.getRecentScreenings(10)).toHaveLength(1);
    expect(store.getScreening(s1.weekStart)?.phq2).toEqual([3, 3]);
  });

  it('rejects out-of-range / non-integer screening pairs at write (loader parity)', () => {
    // Same bounds as migrate.ts validScreening: phq2/gad2 0..3, pss4 0..4, who5 0..5.
    // The loader drops a bad screening on reload — the write must fail loud instead.
    const { store } = makeStore();
    const ok = { phq2: [0, 0], gad2: [0, 0], pss4: [0, 0], who5: [0, 0] } as const;
    expect(() => store.saveScreening({ ...ok, phq2: [4 as 3, 0] })).toThrow(
      ClarityJournalValidationError,
    );
    expect(() => store.saveScreening({ ...ok, gad2: [-1 as 0, 0] })).toThrow(
      ClarityJournalValidationError,
    );
    expect(() => store.saveScreening({ ...ok, pss4: [5 as 4, 0] })).toThrow(
      ClarityJournalValidationError,
    );
    expect(() => store.saveScreening({ ...ok, who5: [6 as 5, 0] })).toThrow(
      ClarityJournalValidationError,
    );
    expect(() => store.saveScreening({ ...ok, phq2: [Number.NaN as 0, 0] })).toThrow(
      ClarityJournalValidationError,
    );
    expect(store.getRecentScreenings(10)).toHaveLength(0);
  });

  it('a rejected screening write never poisons the blob — reload keeps the prior screening', () => {
    const map = new Map<string, string>();
    const storage = { get: (k: string) => map.get(k) ?? null, set: (k: string, v: string) => void map.set(k, v) };
    let n = 0;
    const deps = { storage, now: () => new Date('2026-06-16T12:00:00.000Z'), generateId: () => `s-${++n}` };
    const store = new ClarityJournalStore(deps);
    store.saveScreening({ phq2: [1, 1], gad2: [0, 0], pss4: [2, 2], who5: [4, 4] });
    expect(() =>
      store.saveScreening({ phq2: [9 as 3, 0], gad2: [0, 0], pss4: [0, 0], who5: [0, 0] }),
    ).toThrow(ClarityJournalValidationError);

    const reopened = new ClarityJournalStore(deps);
    expect(reopened.lastAnomaly).toBeNull();
    expect(reopened.getRecentScreenings(10)).toHaveLength(1);
    expect(reopened.getRecentScreenings(1)[0]?.phq2).toEqual([1, 1]);
  });
});

describe('ClarityJournalStore — thought records', () => {
  const tr = {
    situation: 's',
    automaticThought: 'a',
    distortions: ['catastrophizing'],
    evidenceFor: 'f',
    evidenceAgainst: 'g',
    balancedThought: 'b',
    emotionBefore: 8,
    emotionAfter: 4,
  };

  it('adds, lists newest-first, and deletes', () => {
    const { store, setNow } = makeStore();
    const a = store.addThoughtRecord(tr);
    setNow('2026-06-16T13:00:00.000Z');
    const b = store.addThoughtRecord({ ...tr, situation: 's2' });
    expect(store.getThoughtRecords().map((r) => r.id)).toEqual([b.id, a.id]);
    store.deleteThoughtRecord(a.id);
    expect(store.getThoughtRecords()).toHaveLength(1);
    expect(() => store.deleteThoughtRecord('nope')).toThrow(ClarityJournalEntryNotFoundError);
  });

  it('rejects emotion out of 0..10', () => {
    const { store } = makeStore();
    expect(() => store.addThoughtRecord({ ...tr, emotionBefore: 11 })).toThrow(ClarityJournalValidationError);
  });
});

describe('ClarityJournalStore — behavioral activation draft → rate', () => {
  it('adds unrated, then rates', () => {
    const { store } = makeStore();
    const a = store.addActivation({ activity: 'walk', type: 'pleasure', predictedMood: 6 });
    expect(a.actualMood).toBeUndefined();
    const rated = store.rateActivation(a.id, 8);
    expect(rated.actualMood).toBe(8);
    expect(() => store.rateActivation('nope', 5)).toThrow(ClarityJournalEntryNotFoundError);
  });
});

describe('ClarityJournalStore — singletons + safety flags', () => {
  it('stores toolbox + safety plan + safety flags', () => {
    const { store } = makeStore();
    store.saveToolbox({ physical: ['walk'], social: [], mental: [], professional: [] });
    expect(store.getToolbox()?.physical).toEqual(['walk']);
    store.saveSafetyPlan({
      sections: { 1: ['warning'], 2: [], 3: [], 4: [], 5: [], 6: [] },
      crisisContacts: [{ label: '988', phone: '988' }],
    });
    expect(store.getSafetyPlan()?.crisisContacts[0]?.phone).toBe('988');
    store.addSafetyFlag();
    expect(store.getSafetyFlags()).toHaveLength(1);
  });
});

describe('ClarityJournalStore — persistence & migration', () => {
  it('round-trips across instances on the same storage', () => {
    const map = new Map<string, string>();
    const storage = { get: (k: string) => map.get(k) ?? null, set: (k: string, v: string) => void map.set(k, v) };
    const deps = { storage, now: () => new Date('2026-06-16T12:00:00.000Z'), generateId: () => 'fixed' };
    new ClarityJournalStore(deps).saveDailyCheckIn(dailyInput);
    const reopened = new ClarityJournalStore(deps);
    expect(reopened.getRecentDailyCheckIns(10)).toHaveLength(1);
    expect(reopened.lastAnomaly).toBeNull();
  });

  it('quarantines a corrupt blob and recovers empty (never throws)', () => {
    const map = new Map<string, string>([[STORAGE_KEY, '{not json']]);
    let n = 0;
    const storage = { get: (k: string) => map.get(k) ?? null, set: (k: string, v: string) => void map.set(k, v) };
    const store = new ClarityJournalStore({
      storage,
      now: () => new Date('2026-06-16T12:00:00.000Z'),
      generateId: () => `q-${++n}`,
    });
    expect(store.getRecentDailyCheckIns(10)).toEqual([]);
    expect(store.lastAnomaly?.reason).toBe('corrupt-json');
    const quarantined = [...map.keys()].find((k) => k.startsWith(QUARANTINE_KEY_PREFIX));
    expect(quarantined).toBeDefined();
    expect(map.get(quarantined as string)).toBe('{not json');
  });

  it('drops malformed entries as an anomaly but keeps valid ones', () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      dailyCheckIns: [
        { id: 'ok', date: '2026-06-10', createdAt: 'x', mood: 5, energy: 5, sleptLastNight: true, tags: [] },
        { id: 'bad', date: 'not-a-date', mood: 5 },
      ],
    });
    const map = new Map<string, string>([[STORAGE_KEY, blob]]);
    const store = new ClarityJournalStore({
      storage: { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) },
      now: () => new Date('2026-06-16T12:00:00.000Z'),
      generateId: () => 'q',
    });
    expect(store.getRecentDailyCheckIns(10)).toHaveLength(1);
    expect(store.lastAnomaly?.reason).toBe('malformed-collections');
  });
});
