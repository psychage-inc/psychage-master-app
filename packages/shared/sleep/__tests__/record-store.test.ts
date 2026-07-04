// SleepRecordStore behavioral contract — the two date rules, one-per-day,
// fail-loud validation, settings, reads, persistence round-trip, and anomaly
// quarantine. Follows the @psychage/shared/check-in test harness: a Map-backed
// in-memory Storage, deterministic injected clock + id factory.

import { describe, expect, it } from 'vitest';

import { toLocalCalendarDate } from '../dates';
import { QUARANTINE_KEY_PREFIX, SCHEMA_VERSION, STORAGE_KEY } from '../migrate';
import { SleepRecordStore } from '../record-store';
import {
  type SleepEntryInput,
  SleepEntryNotFoundError,
  type Storage,
  SleepValidationError,
} from '../types';

function makeStorage(seed?: Record<string, string>): { storage: Storage; map: Map<string, string> } {
  const map = new Map<string, string>(seed ? Object.entries(seed) : []);
  const storage: Storage = {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
  return { storage, map };
}

function makeClock(initial: Date): { now: () => Date; set: (d: Date) => void } {
  let current = initial;
  return {
    now: () => current,
    set: (d) => {
      current = d;
    },
  };
}

function makeIds(prefix = 'id'): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${n}`;
  };
}

const TUE = new Date(2026, 5, 16, 9, 0); // 2026-06-16
const WED = new Date(2026, 5, 17, 9, 0); // 2026-06-17

const baseInput: SleepEntryInput = {
  bedtime: '23:00',
  lights_out: '23:15',
  sleep_onset_minutes: 15,
  wake_time: '07:00',
  out_of_bed_time: '07:15',
  night_wakings: 1,
  night_waking_duration_minutes: 10,
  sleep_quality: 4,
  morning_mood: 4,
  dream_recall: false,
  naps: [],
  substances: { alcohol: false, exercise: true, medication_sleep_aid: false },
};

function input(over: Partial<SleepEntryInput> = {}): SleepEntryInput {
  return { ...baseInput, ...over };
}

function setup(seed?: Record<string, string>, initialClock: Date = TUE) {
  const { storage, map } = makeStorage(seed);
  const clock = makeClock(initialClock);
  const store = new SleepRecordStore({ storage, now: clock.now, generateId: makeIds() });
  return { store, clock, map, storage };
}

function persistedEntries(map: Map<string, string>): unknown[] {
  const raw = map.get(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { entries: unknown[] }).entries : [];
}

// ── Date Rule 1: saveToday keys to the device's local day; one per day ───────
describe('saveToday — local day + overwrite', () => {
  it('a second save on the same day edits in place — never a second entry', () => {
    const { store, map, clock } = setup();
    const first = store.saveToday(input({ sleep_quality: 2 }));
    clock.set(new Date(2026, 5, 16, 14, 0)); // same day, later
    const second = store.saveToday(input({ sleep_quality: 5 }));

    expect(store.getRecent(10)).toHaveLength(1);
    expect(persistedEntries(map)).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.date).toBe(first.date);
    expect(second.created_at).toBe(first.created_at); // created_at preserved on overwrite
    expect(store.getToday()?.sleep_quality).toBe(5);
  });

  it('holds one-entry-per-day across many days', () => {
    const { store, clock, map } = setup();
    store.saveToday(input()); // TUE
    clock.set(WED);
    store.saveToday(input());
    clock.set(new Date(2026, 5, 18, 9, 0)); // THU
    store.saveToday(input());
    store.saveToday(input()); // re-save THU
    expect(store.getRecent(10)).toHaveLength(3);
    expect(persistedEntries(map)).toHaveLength(3);
  });

  it('a save at 00:30 lands on the NEW local day (midnight crossing)', () => {
    const { store, clock } = setup({}, new Date(2026, 5, 16, 23, 30)); // TUE 23:30
    const tue = store.saveToday(input());
    expect(tue.date).toBe('2026-06-16');
    clock.set(new Date(2026, 5, 17, 0, 30)); // WED 00:30
    const wed = store.saveToday(input());
    expect(wed.date).toBe('2026-06-17');
    expect(store.getRecent(10)).toHaveLength(2);
    expect(store.getToday()?.date).toBe('2026-06-17');
  });

  it('keys to the LOCAL day, not UTC, under a non-UTC zone', () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Asia/Kolkata'; // UTC+5:30
      const instant = new Date(2026, 5, 17, 0, 30);
      expect(instant.getUTCDate()).not.toBe(instant.getDate());
      const { storage } = makeStorage();
      const store = new SleepRecordStore({ storage, now: () => instant, generateId: makeIds() });
      expect(store.saveToday(input()).date).toBe('2026-06-17');
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

// ── Date Rule 2: editEntry never re-dates ────────────────────────────────────
describe('editEntry — never re-dates', () => {
  it('editing Tuesday on Wednesday keeps date + created_at, changes fields', () => {
    const { store, clock } = setup();
    const tue = store.saveToday(input({ sleep_quality: 2 }));
    clock.set(WED);
    store.saveToday(input()); // create WED

    const edited = store.editEntry(tue.id, input({ sleep_quality: 5, notes: 'edited wed' }));
    expect(edited.id).toBe(tue.id);
    expect(edited.date).toBe('2026-06-16');
    expect(edited.created_at).toBe(tue.created_at);
    expect(edited.sleep_quality).toBe(5);
    expect(edited.notes).toBe('edited wed');
    expect(store.getToday()?.date).toBe('2026-06-17');
    expect(store.getRecent(10)).toHaveLength(2);
  });

  it('throws SleepEntryNotFoundError for an unknown id', () => {
    const { store } = setup();
    expect(() => store.editEntry('nope', input())).toThrow(SleepEntryNotFoundError);
  });
});

// ── fail-loud validation ─────────────────────────────────────────────────────
describe('validation — fails loud, persists nothing', () => {
  it('rejects malformed times', () => {
    const { store } = setup();
    expect(() => store.saveToday(input({ bedtime: '25:00' }))).toThrow(SleepValidationError);
    expect(() => store.saveToday(input({ wake_time: '7:00' }))).toThrow(SleepValidationError);
    expect(store.getRecent(10)).toHaveLength(0);
  });

  it('rejects out-of-range ratings and negative integers', () => {
    const { store } = setup();
    expect(() => store.saveToday(input({ sleep_quality: 0 as 1 }))).toThrow(SleepValidationError);
    expect(() => store.saveToday(input({ sleep_quality: 6 as 5 }))).toThrow(SleepValidationError);
    expect(() => store.saveToday(input({ sleep_onset_minutes: -5 }))).toThrow(SleepValidationError);
  });

  it('rejects an over-long note', () => {
    const { store } = setup();
    expect(() => store.saveToday(input({ notes: 'x'.repeat(1001) }))).toThrow(SleepValidationError);
  });

  it('rejects malformed nap / substance times', () => {
    const { store } = setup();
    expect(() => store.saveToday(input({ naps: [{ start: '13:00', end: '99:00' }] }))).toThrow(
      SleepValidationError,
    );
    expect(() =>
      store.saveToday(input({ substances: { ...baseInput.substances, caffeine_last_time: 'noon' } })),
    ).toThrow(SleepValidationError);
  });

  it('rejects negative / non-finite substance quantities at write (loader parity)', () => {
    // The loader (migrate.ts isValidSubstances) rejects these on the next launch;
    // accepting them at write would silently quarantine the whole blob later.
    const { store } = setup();
    expect(() =>
      store.saveToday(input({ substances: { ...baseInput.substances, alcohol_units: -5 } })),
    ).toThrow(SleepValidationError);
    expect(() =>
      store.saveToday(
        input({ substances: { ...baseInput.substances, screens_before_bed_minutes: Number.NaN } }),
      ),
    ).toThrow(SleepValidationError);
    expect(() =>
      store.saveToday(
        input({ substances: { ...baseInput.substances, alcohol_units: Number.POSITIVE_INFINITY } }),
      ),
    ).toThrow(SleepValidationError);
    expect(store.getRecent(10)).toHaveLength(0);
  });

  it('a rejected substance write never reaches storage — reload keeps prior entries, no anomaly', () => {
    const { store, storage, clock } = setup();
    store.saveToday(input()); // a good entry first
    expect(() =>
      store.saveToday(input({ substances: { ...baseInput.substances, alcohol_units: -5 } })),
    ).toThrow(SleepValidationError);

    const reopened = new SleepRecordStore({ storage, now: clock.now, generateId: makeIds('r') });
    expect(reopened.lastAnomaly).toBeNull();
    expect(reopened.getRecent(10)).toHaveLength(1);
  });
});

// ── settings ─────────────────────────────────────────────────────────────────
describe('settings', () => {
  it('defaults, then merges + persists a patch', () => {
    const { store, storage } = setup();
    expect(store.getSettings().age_range).toBe('adult_26_64');

    store.saveSettings({ target_sleep_minutes: 450, chronotype: 'bear' });
    expect(store.getSettings()).toMatchObject({ target_sleep_minutes: 450, chronotype: 'bear' });

    // A second store on the same storage reads the persisted settings.
    const reopened = new SleepRecordStore({ storage, now: () => TUE, generateId: makeIds('b') });
    expect(reopened.getSettings()).toMatchObject({ target_sleep_minutes: 450, chronotype: 'bear' });
  });
});

// ── reads ────────────────────────────────────────────────────────────────────
describe('reads', () => {
  it('getRecent newest-first + respects n; getRange inclusive; defensive copies', () => {
    const { store, clock } = setup();
    const a = store.saveToday(input()); // 06-16
    clock.set(WED);
    const b = store.saveToday(input()); // 06-17
    clock.set(new Date(2026, 5, 18, 9, 0));
    const c = store.saveToday(input()); // 06-18

    expect(store.getRecent(2).map((e) => e.id)).toEqual([c.id, b.id]);
    expect(store.getRecent(0)).toEqual([]);
    expect(store.getAll().map((e) => e.id)).toEqual([a.id, b.id, c.id]);

    const range = store.getRange(
      toLocalCalendarDate(new Date(2026, 5, 16)),
      toLocalCalendarDate(new Date(2026, 5, 17)),
    );
    expect(range.map((e) => e.date)).toEqual(['2026-06-16', '2026-06-17']);

    expect(store.getToday()).not.toBe(store.getToday()); // fresh object each read
    expect(store.getToday()).toEqual(store.getToday());
  });
});

// ── persistence round-trip + LOCAL-ONLY ──────────────────────────────────────
describe('persistence round-trip', () => {
  it('a second store hydrates from storage; only the single sleep key is written', () => {
    const { storage, map, clock } = setup();
    const s1 = new SleepRecordStore({ storage, now: clock.now, generateId: makeIds('a') });
    const tue = s1.saveToday(input({ notes: 'persisted' }));
    clock.set(WED);
    s1.saveToday(input());

    const s2 = new SleepRecordStore({ storage, now: clock.now, generateId: makeIds('c') });
    expect(s2.getRecent(10)).toHaveLength(2);
    expect(s2.getEntry(tue.id)).toMatchObject({ date: '2026-06-16', notes: 'persisted' });
    expect(s2.lastAnomaly).toBeNull();
    expect([...map.keys()]).toEqual([STORAGE_KEY]); // LOCAL-ONLY: nothing outside the key
  });

  it('a fresh store seeds a v1 envelope', () => {
    const { map } = setup();
    const envelope = JSON.parse(map.get(STORAGE_KEY) as string);
    expect(envelope.version).toBe(SCHEMA_VERSION);
    expect(envelope.entries).toEqual([]);
  });
});

// ── anomaly quarantine ───────────────────────────────────────────────────────
describe('anomaly handling', () => {
  it('corrupt JSON is quarantined; store recovers empty and re-stamps clean', () => {
    const { store, map, storage } = setup({ [STORAGE_KEY]: '{not json' });
    expect(store.lastAnomaly?.reason).toBe('corrupt-json');
    expect(store.getRecent(10)).toEqual([]);
    const qKey = store.lastAnomaly?.quarantineKey as string;
    expect(qKey.startsWith(QUARANTINE_KEY_PREFIX)).toBe(true);
    expect(map.get(qKey)).toBe('{not json');

    const reopened = new SleepRecordStore({ storage, now: () => TUE, generateId: makeIds('z') });
    expect(reopened.lastAnomaly).toBeNull(); // primary key reset to clean envelope
    expect(map.get(qKey)).toBe('{not json'); // quarantine preserved
  });

  it('malformed entries are partially recovered while the raw is quarantined', () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      settings: { target_sleep_minutes: 480, age_range: 'adult_26_64' },
      entries: [
        {
          id: 'good',
          date: '2026-06-16',
          created_at: '2026-01-01T00:00:00.000Z',
          bedtime: '23:00',
          lights_out: '23:15',
          sleep_onset_minutes: 15,
          wake_time: '07:00',
          out_of_bed_time: '07:15',
          night_wakings: 0,
          night_waking_duration_minutes: 0,
          sleep_quality: 4,
          morning_mood: 4,
          dream_recall: false,
          naps: [],
          substances: { alcohol: false, exercise: false, medication_sleep_aid: false },
        },
        { id: 'bad', date: 'xxxx', sleep_quality: 9 },
      ],
    });
    const { store, map } = setup({ [STORAGE_KEY]: blob });
    expect(store.lastAnomaly?.reason).toBe('malformed-entries');
    expect(store.lastAnomaly?.recoveredEntryCount).toBe(1);
    expect(store.getRecent(10).map((e) => e.id)).toEqual(['good']);
    expect(map.get(store.lastAnomaly?.quarantineKey as string)).toBe(blob);
  });
});
