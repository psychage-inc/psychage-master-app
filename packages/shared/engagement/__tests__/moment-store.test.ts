// MomentStore unit tests — local-first capture, caps, dayRollup, and the
// merge/restore lane (ingestRemote). No device, no network: Storage is an in-memory
// Map, the clock is a controllable instant, ids are a deterministic counter.

import { beforeEach, describe, expect, it } from 'vitest';

import { asLocalCalendarDate } from '../dates';
import { mergeMoments, MomentStore } from '../moment-store';
import {
  MAX_LABELS,
  MAX_STORED_MOMENTS,
  type Moment,
  type MomentValence,
  MomentValidationError,
  NOTE_MAX_LENGTH,
  type Storage,
} from '../types';

function mapStorage(): Storage {
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

// Controllable deps: `at` drives the clock; ids are a monotonic counter.
function makeDeps(start = Date.parse('2026-06-17T09:00:00.000Z')) {
  let clock = start;
  let n = 0;
  return {
    deps: {
      storage: mapStorage(),
      now: () => new Date(clock),
      generateId: () => `m${++n}`,
    },
    advance: (ms: number) => {
      clock += ms;
    },
    setClock: (iso: string) => {
      clock = Date.parse(iso);
    },
    setMs: (ms: number) => {
      clock = ms;
    },
  };
}

const HOUR = 3_600_000;

// A local wall-clock instant (ms). Built from local Y/M/D/H so day-grouping tests are
// timezone-independent: callers pick hours safely inside a local day, never near a
// UTC boundary that would drift across midnight in a positive/negative offset.
function localInstant(y: number, m: number, d: number, h: number): number {
  return new Date(y, m - 1, d, h, 0, 0, 0).getTime();
}

describe('append (local-first capture)', () => {
  it('mints id + timestamp and returns the moment immediately', () => {
    const { deps } = makeDeps();
    const store = new MomentStore(deps);
    const m = store.append({ valence: 3 });
    expect(m.id).toBe('m1');
    expect(m.timestamp).toBe('2026-06-17T09:00:00.000Z');
    expect(m.valence).toBe(3);
    expect(m.labels).toEqual([]);
    expect(m.context).toEqual([]);
    expect(m.routedToSupport).toBe(false);
    expect(m.note).toBeUndefined();
  });

  it('is append-only — many per day, never overwrites', () => {
    const { deps, advance } = makeDeps();
    const store = new MomentStore(deps);
    store.append({ valence: 2 });
    advance(HOUR);
    store.append({ valence: 4 });
    advance(HOUR);
    store.append({ valence: 5 });
    expect(store.getAll()).toHaveLength(3);
  });

  it('persists so a fresh store over the same storage re-reads it', () => {
    const { deps } = makeDeps();
    const store = new MomentStore(deps);
    store.append({ valence: 4, labels: ['steady'], context: ['work'], note: 'a line' });
    const reopened = new MomentStore(deps); // same storage instance
    const all = reopened.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ valence: 4, labels: ['steady'], context: ['work'], note: 'a line' });
  });

  it('reads are defensive copies — mutating a returned moment does not corrupt the store', () => {
    const { deps } = makeDeps();
    const store = new MomentStore(deps);
    store.append({ valence: 3, labels: ['ok'] });
    const got = store.getRecent(1)[0] as Moment;
    (got.labels as string[]).push('injected');
    expect(store.getRecent(1)[0]?.labels).toEqual(['ok']);
  });
});

describe('validation (fail loud, never clamp)', () => {
  it('rejects valence out of 1..5', () => {
    const { deps } = makeDeps();
    const store = new MomentStore(deps);
    expect(() => store.append({ valence: 0 as MomentValence })).toThrow(MomentValidationError);
    expect(() => store.append({ valence: 6 as MomentValence })).toThrow(MomentValidationError);
  });

  it(`rejects more than ${MAX_LABELS} labels`, () => {
    const { deps } = makeDeps();
    const store = new MomentStore(deps);
    expect(() => store.append({ valence: 3, labels: ['a', 'b', 'c', 'd'] })).toThrow(
      MomentValidationError,
    );
  });

  it('rejects a note over the cap', () => {
    const { deps } = makeDeps();
    const store = new MomentStore(deps);
    expect(() => store.append({ valence: 3, note: 'x'.repeat(NOTE_MAX_LENGTH + 1) })).toThrow(
      MomentValidationError,
    );
  });
});

describe('reads', () => {
  it('getRecent returns newest-first and respects n', () => {
    const { deps, advance } = makeDeps();
    const store = new MomentStore(deps);
    const a = store.append({ valence: 1 });
    advance(HOUR);
    const b = store.append({ valence: 2 });
    advance(HOUR);
    const c = store.append({ valence: 3 });
    expect(store.getRecent(2).map((m) => m.id)).toEqual([c.id, b.id]);
    expect(store.getRecent(0)).toEqual([]);
    expect(store.getRecent(-1)).toEqual([]);
    expect(a.id).toBe('m1');
  });

  it('getRange filters by local calendar day inclusive', () => {
    const { deps, setMs } = makeDeps();
    const store = new MomentStore(deps);
    setMs(localInstant(2026, 6, 15, 12));
    store.append({ valence: 2 });
    setMs(localInstant(2026, 6, 16, 12));
    store.append({ valence: 3 });
    setMs(localInstant(2026, 6, 17, 12));
    store.append({ valence: 4 });
    const mid = store.getRange(asLocalCalendarDate('2026-06-16'), asLocalCalendarDate('2026-06-16'));
    expect(mid).toHaveLength(1);
    expect(mid[0]?.valence).toBe(3);
  });
});

describe('dayRollup (event-based → day-based bridge)', () => {
  it('groups many moments per day; carries the RANGE, scalar = worst-of-day (never latest)', () => {
    const { deps, setMs } = makeDeps();
    const store = new MomentStore(deps);
    // Two moments on local 2026-06-16 (a tense morning + an eased evening, both safely
    // mid-day so they can't cross a UTC midnight), one on local 2026-06-17.
    setMs(localInstant(2026, 6, 16, 9));
    store.append({ valence: 2, labels: ['tense'], context: ['work'] });
    setMs(localInstant(2026, 6, 16, 18)); // a LATER, calmer tap must NOT become the day
    store.append({ valence: 5, labels: ['eased'], context: ['home'], note: 'better now' });
    setMs(localInstant(2026, 6, 17, 9));
    store.append({ valence: 3, context: ['work'] });

    const rollups = store.dayRollup();
    expect(rollups).toHaveLength(2);
    const d16 = rollups[0];
    expect(d16?.date).toBe('2026-06-16');
    expect(d16?.valence).toBe(2); // worst-of-day — NOT the later calm tap (5), not an average
    expect(d16?.low).toBe(2);
    expect(d16?.high).toBe(5);
    expect(d16?.momentCount).toBe(2);
    expect(d16?.hasNote).toBe(true);
    expect(new Set(d16?.labels)).toEqual(new Set(['tense', 'eased']));
    expect(new Set(d16?.context)).toEqual(new Set(['work', 'home']));
    // Single-moment day: low == high == valence.
    expect(rollups[1]?.date).toBe('2026-06-17');
    expect(rollups[1]?.low).toBe(3);
    expect(rollups[1]?.high).toBe(3);
    expect(rollups[1]?.valence).toBe(3);
    expect(rollups[1]?.hasNote).toBe(false);
  });

  it('honors from/to bounds', () => {
    const { deps, setMs } = makeDeps();
    const store = new MomentStore(deps);
    for (const d of [14, 15, 16]) {
      setMs(localInstant(2026, 6, d, 10));
      store.append({ valence: 3 });
    }
    const out = store.dayRollup(asLocalCalendarDate('2026-06-15'), asLocalCalendarDate('2026-06-16'));
    expect(out.map((r) => r.date)).toEqual(['2026-06-15', '2026-06-16']);
  });
});

describe('mergeMoments (last-write-wins, append-only)', () => {
  function moment(id: string, ts: string, valence: MomentValence): Moment {
    return { id, timestamp: ts, valence, labels: [], context: [], routedToSupport: false, source: 'today' };
  }

  it('unions by id and sorts by timestamp', () => {
    const local = [moment('a', '2026-06-17T09:00:00.000Z', 3)];
    const remote = [moment('b', '2026-06-16T09:00:00.000Z', 2)];
    expect(mergeMoments(local, remote).map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('local copy wins on a shared id (local is the source of truth)', () => {
    const local = [moment('a', '2026-06-17T09:00:00.000Z', 5)];
    const remote = [moment('a', '2026-06-17T09:00:00.000Z', 1)];
    expect(mergeMoments(local, remote)).toEqual([local[0]]);
  });
});

describe('ingestRemote (pull/restore — survives reinstall)', () => {
  it('repopulates an empty (freshly reinstalled) store from remote', () => {
    const { deps } = makeDeps();
    const fresh = new MomentStore(deps); // empty local cache, as after reinstall
    expect(fresh.getAll()).toHaveLength(0);
    fresh.ingestRemote([
      { id: 'r1', timestamp: '2026-06-10T09:00:00.000Z', valence: 4, labels: ['hopeful'], context: [], routedToSupport: false, source: 'today' },
      { id: 'r2', timestamp: '2026-06-11T09:00:00.000Z', valence: 2, labels: [], context: ['sleep'], routedToSupport: false, source: 'today' },
    ]);
    expect(fresh.getAll().map((m) => m.id)).toEqual(['r1', 'r2']);
    // and it persisted — a re-open over the same storage still has them
    const reopened = new MomentStore(deps);
    expect(reopened.getAll()).toHaveLength(2);
  });

  it('merges remote into existing local without dropping local-only moments', () => {
    const { deps } = makeDeps();
    const store = new MomentStore(deps);
    const localMoment = store.append({ valence: 3 }); // id m1
    store.ingestRemote([
      { id: 'remote-1', timestamp: '2026-06-01T09:00:00.000Z', valence: 5, labels: [], context: [], routedToSupport: false, source: 'today' },
    ]);
    expect(store.getAll().map((m) => m.id).sort()).toEqual(['remote-1', localMoment.id].sort());
  });

  it('drops invalid remote rows at the boundary, keeps valid ones, never throws — relaunch stays clean', () => {
    // One malformed server row must not poison the blob and quarantine the whole
    // store on the next launch.
    const { deps } = makeDeps();
    const store = new MomentStore(deps);
    const valid: Moment = { id: 'r-ok', timestamp: '2026-06-10T09:00:00.000Z', valence: 4, labels: [], context: [], routedToSupport: false, source: 'today' };
    const invalid = { id: 'r-bad', timestamp: '2026-06-10T10:00:00.000Z', valence: 99, labels: [], context: [], routedToSupport: false } as unknown as Moment;

    expect(() => store.ingestRemote([invalid, valid])).not.toThrow();
    expect(store.getAll().map((m) => m.id)).toEqual(['r-ok']);

    const reopened = new MomentStore(deps); // same storage — the relaunch read
    expect(reopened.lastAnomaly).toBeNull();
    expect(reopened.getAll().map((m) => m.id)).toEqual(['r-ok']);
  });
});

describe(`growth cap — most recent ${MAX_STORED_MOMENTS} moments kept on persist`, () => {
  function remoteMoment(i: number): Moment {
    return {
      id: `r${i}`,
      timestamp: new Date(Date.UTC(2025, 0, 1) + i * 60_000).toISOString(),
      valence: 3,
      labels: [],
      context: [],
      routedToSupport: false,
      source: 'today',
    };
  }

  it('appending beyond the cap trims the oldest and retains the newest', () => {
    const { deps } = makeDeps(); // clock: 2026-06-17, newer than every remote moment
    const store = new MomentStore(deps);
    store.ingestRemote(Array.from({ length: MAX_STORED_MOMENTS }, (_, i) => remoteMoment(i)));
    expect(store.getAll()).toHaveLength(MAX_STORED_MOMENTS);

    const appended = store.append({ valence: 5 }); // one past the cap
    const all = store.getAll();
    expect(all).toHaveLength(MAX_STORED_MOMENTS);
    expect(all.some((m) => m.id === 'r0')).toBe(false); // oldest dropped
    expect(all.some((m) => m.id === appended.id)).toBe(true); // newest retained
    expect(all[0]?.id).toBe('r1'); // next-oldest survives

    const reopened = new MomentStore(deps); // persisted blob is capped and clean
    expect(reopened.lastAnomaly).toBeNull();
    expect(reopened.getAll()).toHaveLength(MAX_STORED_MOMENTS);
  });
});

describe('empty / offline resilience', () => {
  it('a fresh store with no storage is empty and does not throw', () => {
    const { deps } = makeDeps();
    const store = new MomentStore(deps);
    expect(store.getAll()).toEqual([]);
    expect(store.getRecent(5)).toEqual([]);
    expect(store.dayRollup()).toEqual([]);
    expect(store.lastAnomaly).toBeNull();
  });
});
