// Clarity Journal migrator — SR-13 forward-only transform loop. The loop must
// APPLY registered N→N+1 transforms before validating; validating an old-version
// payload against the current validators would mass-quarantine every journal on
// the first future version bump. `transforms` is injectable purely for these
// tests (SCHEMA_VERSION is 1 and the production registry is empty).

import { describe, expect, it } from 'vitest';

import {
  type JournalTransform,
  migrate,
  SCHEMA_VERSION,
} from '../migrate';

// A pre-v1 check-in missing `tags` — INVALID under the v1 validator until a
// transform backfills it.
const v0CheckIn = {
  id: 'a',
  date: '2026-06-10',
  createdAt: '2026-06-10T09:00:00.000Z',
  mood: 5,
  energy: 5,
  sleptLastNight: true,
};

const v0to1: JournalTransform = {
  from: 0,
  to: 1,
  transform: (raw) => {
    const env = raw as Record<string, unknown>;
    const checkIns = Array.isArray(env.dailyCheckIns) ? env.dailyCheckIns : [];
    return {
      ...env,
      dailyCheckIns: checkIns.map((c) => ({ ...(c as Record<string, unknown>), tags: [] })),
    };
  },
};

describe('migrate — stepwise transform application', () => {
  it('APPLIES a registered transform before validating (old payloads are never judged by new validators)', () => {
    // Against the pre-fix migrator this quarantined: the transform's existence was
    // checked but never applied, so the tag-less v0 check-in failed v1 validation.
    const out = migrate(JSON.stringify({ version: 0, dailyCheckIns: [v0CheckIn] }), [v0to1]);
    expect(out.status).toBe('clean');
    expect(out.value.version).toBe(SCHEMA_VERSION);
    expect(out.value.dailyCheckIns).toHaveLength(1);
    expect(out.value.dailyCheckIns[0]?.tags).toEqual([]);
  });

  it('walks multi-step chains stepwise (v-1 → v0 → v1)', () => {
    const vm1to0: JournalTransform = { from: -1, to: 0, transform: (raw) => raw };
    const out = migrate(
      JSON.stringify({ version: -1, dailyCheckIns: [v0CheckIn] }),
      [vm1to0, v0to1],
    );
    expect(out.status).toBe('clean');
    expect(out.value.dailyCheckIns[0]?.tags).toEqual([]);
  });

  it('version < SCHEMA_VERSION with no registered transform → no-migration-path anomaly (raw preserved)', () => {
    const raw = JSON.stringify({ version: 0, dailyCheckIns: [] });
    const out = migrate(raw); // production registry: empty
    expect(out).toMatchObject({ status: 'anomaly', reason: 'no-migration-path', raw });
    expect(out.value.dailyCheckIns).toEqual([]);
  });

  it('a chain missing an intermediate step → no-migration-path anomaly', () => {
    // Only v0→v1 registered; a v-1 blob has no way to reach v0.
    const raw = JSON.stringify({ version: -1, dailyCheckIns: [] });
    const out = migrate(raw, [v0to1]);
    expect(out).toMatchObject({ status: 'anomaly', reason: 'no-migration-path', raw });
  });

  it('a transform yielding a non-object → anomaly (raw preserved, never throws)', () => {
    const bad: JournalTransform = { from: 0, to: 1, transform: () => 42 };
    const raw = JSON.stringify({ version: 0 });
    const out = migrate(raw, [bad]);
    expect(out).toMatchObject({ status: 'anomaly', reason: 'not-an-object', raw });
  });

  it('current-version envelopes are untouched by the registry', () => {
    const raw = JSON.stringify({ version: SCHEMA_VERSION, dailyCheckIns: [] });
    const poison: JournalTransform = {
      from: SCHEMA_VERSION,
      to: SCHEMA_VERSION + 1,
      transform: () => {
        throw new Error('must not run for a current-version blob');
      },
    };
    const out = migrate(raw, [poison]);
    expect(out.status).toBe('clean');
  });
});
