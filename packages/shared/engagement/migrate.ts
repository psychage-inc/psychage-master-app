// Moments persistence schema + forward-only versioned migrator (Sacred Rule #13:
// every persisted shape carries a version + an N→N+1 transform from day one).
//
// Mirrors packages/shared/check-in/migrate.ts's NEVER-SILENTLY-LOSE-USER-DATA
// policy: check-ins/moments are user data, so on anomaly the raw blob is preserved
// under a quarantine key and the failure is surfaced — the store then continues on a
// best-effort recovered subset. (Unlike derived preferences, which may reseed.)

import {
  type Moment,
  type MomentSource,
  type MomentValence,
  MOMENT_SOURCES,
  NOTE_MAX_LENGTH,
  STORED_MAX_LABELS,
} from './types';

// v2 (unify): adds `source` (provenance, backfilled `today` for v1 rows) + the
// optional migration-only `legacyValence10` (the original 1–10 Mood Journal valence
// preserved when a journal entry is folded in). Load-validation widens the labels
// ceiling to STORED_MAX_LABELS so folded-in entries are not quarantined.
export const SCHEMA_VERSION = 2 as const;
export const STORAGE_KEY = 'mobile:moments';
/** Quarantined blobs land at `${STORAGE_KEY}:quarantine:<iso>-<uuid>` (uuid keeps each anomaly distinct). */
export const QUARANTINE_KEY_PREFIX = `${STORAGE_KEY}:quarantine:`;

/** The persisted envelope. `version` is meta; `moments` is the user data. */
export interface PersistedMoments {
  readonly version: number;
  readonly moments: Moment[];
}

/** Why a load was treated as anomalous (for the surfaced anomaly + telemetry later). */
export type AnomalyReason =
  | 'corrupt-json'
  | 'not-an-object'
  | 'missing-version'
  | 'future-version'
  | 'no-migration-path'
  | 'malformed-moments';

export type MigrateOutcome =
  | { readonly status: 'clean'; readonly value: PersistedMoments }
  | {
      readonly status: 'anomaly';
      /** Best-effort recovered state (empty unless a v1 envelope yielded salvageable moments). */
      readonly value: PersistedMoments;
      /** The original blob, preserved verbatim for quarantine. */
      readonly raw: string;
      readonly reason: AnomalyReason;
    };

// Forward-only transform registry, indexed by `from`. v1→v2 is purely additive: a v1
// moment predates `source`, so backfill it to `today` (the home capture surface that
// minted every v1 moment). `legacyValence10` stays absent (v1 had no Mood Journal
// data folded in). `normalizeMoments` then re-validates under the v2 `isValidMoment`.
interface Transform {
  readonly from: number;
  readonly to: number;
  readonly transform: (raw: unknown) => unknown;
}
const TRANSFORMS: readonly Transform[] = [
  {
    from: 1,
    to: 2,
    transform: (moments) =>
      Array.isArray(moments)
        ? moments.map((m) =>
            typeof m === 'object' && m !== null && !('source' in m)
              ? { ...(m as Record<string, unknown>), source: 'today' satisfies MomentSource }
              : m,
          )
        : moments,
  },
];

function emptyStore(): PersistedMoments {
  return { version: SCHEMA_VERSION, moments: [] };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === 'string');
}

function isValidMoment(value: unknown): value is Moment {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (typeof v.timestamp !== 'string' || Number.isNaN(Date.parse(v.timestamp))) return false;
  if (
    typeof v.valence !== 'number' ||
    !Number.isInteger(v.valence) ||
    v.valence < 1 ||
    v.valence > 5
  ) {
    return false;
  }
  // Wider than the capture cap (MAX_LABELS): a folded-in Mood Journal entry may carry
  // up to the 12 closed emotion tags. Keep them rather than quarantine the moment.
  if (!isStringArray(v.labels) || v.labels.length > STORED_MAX_LABELS) return false;
  if (!isStringArray(v.context)) return false;
  if (v.note !== undefined && (typeof v.note !== 'string' || v.note.length > NOTE_MAX_LENGTH)) {
    return false;
  }
  if (typeof v.routedToSupport !== 'boolean') return false;
  // Optional: present on every local capture, absent on a cloud-restored moment. When
  // present it must be a known source.
  if (v.source !== undefined && (typeof v.source !== 'string' || !MOMENT_SOURCES.has(v.source))) {
    return false;
  }
  // Migration-only: the original 1–10 Mood Journal valence. Absent on every fresh
  // capture; when present it must be a sane 1–10 integer.
  if (
    v.legacyValence10 !== undefined &&
    (typeof v.legacyValence10 !== 'number' ||
      !Number.isInteger(v.legacyValence10) ||
      v.legacyValence10 < 1 ||
      v.legacyValence10 > 10)
  ) {
    return false;
  }
  return true;
}

/**
 * Canonicalize one validated moment — drop unknown keys, omit absent optionals. Key
 * order MUST match `makeMoment` in moment-store.ts so a fresh write and a reloaded
 * write serialize identically (the load() restamp check). `legacyValence10` sits
 * before `note` (it is absent on fresh captures, so append's order is unaffected).
 */
export function canonicalMoment(moment: Moment): Moment {
  const base = {
    id: moment.id,
    timestamp: moment.timestamp,
    valence: moment.valence as MomentValence,
    labels: [...moment.labels],
    context: [...moment.context],
    routedToSupport: moment.routedToSupport,
  };
  const withSource = moment.source === undefined ? base : { ...base, source: moment.source };
  const withLegacy =
    moment.legacyValence10 === undefined
      ? withSource
      : { ...withSource, legacyValence10: moment.legacyValence10 };
  return moment.note === undefined ? withLegacy : { ...withLegacy, note: moment.note };
}

/** Ascending chronological order by capture instant (stable tiebreak on id). */
export function compareByTimestamp(a: Moment, b: Moment): number {
  if (a.timestamp < b.timestamp) return -1;
  if (a.timestamp > b.timestamp) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Validate + dedupe a raw moments array. Keeps every well-formed moment; collapses
 * duplicate ids (last occurrence wins). `dropped` is true when anything was rejected
 * or collapsed — the signal the store uses to quarantine the original blob.
 */
export function normalizeMoments(raw: unknown): { moments: Moment[]; dropped: boolean } {
  if (!Array.isArray(raw)) return { moments: [], dropped: true };

  const byId = new Map<string, Moment>();
  let dropped = false;

  for (const candidate of raw) {
    if (!isValidMoment(candidate)) {
      dropped = true;
      continue;
    }
    if (byId.has(candidate.id)) dropped = true; // duplicate id collapsed
    byId.set(candidate.id, canonicalMoment(candidate));
  }

  return { moments: [...byId.values()].sort(compareByTimestamp), dropped };
}

/**
 * Parse + migrate a persisted moments blob.
 *
 * - `null` (no data) → clean empty store.
 * - matching version, all moments valid → clean pass-through.
 * - matching version, some malformed/duplicated → anomaly carrying the salvageable subset.
 * - corrupt JSON / non-object / missing version / future version / no migration path
 *   → anomaly carrying the raw and an empty recovered store.
 */
export function migrate(rawJson: string | null): MigrateOutcome {
  if (rawJson === null) return { status: 'clean', value: emptyStore() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'corrupt-json' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'not-an-object' };
  }

  const envelope = parsed as { version?: unknown; moments?: unknown };
  if (typeof envelope.version !== 'number') {
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'missing-version' };
  }
  const version = envelope.version;

  if (version > SCHEMA_VERSION) {
    // Downgraded app reading newer state — preserve, never discard.
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'future-version' };
  }

  if (version < SCHEMA_VERSION) {
    let cursor = version;
    let payload: unknown = envelope.moments;
    while (cursor < SCHEMA_VERSION) {
      const step = TRANSFORMS.find((t) => t.from === cursor);
      // Progress + throw guards: a registered transform that fails to advance the
      // version (to <= from) or throws must degrade to an anomaly, never hang or
      // crash store construction at app launch (second-pass review of PR-043).
      if (!step || step.to <= cursor) {
        return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'no-migration-path' };
      }
      try {
        payload = step.transform(payload);
      } catch {
        return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'no-migration-path' };
      }
      cursor = step.to;
    }
    const migrated = normalizeMoments(payload);
    const value: PersistedMoments = { version: SCHEMA_VERSION, moments: migrated.moments };
    return migrated.dropped
      ? { status: 'anomaly', value, raw: rawJson, reason: 'malformed-moments' }
      : { status: 'clean', value };
  }

  // version === SCHEMA_VERSION
  const { moments, dropped } = normalizeMoments(envelope.moments);
  const value: PersistedMoments = { version: SCHEMA_VERSION, moments };
  return dropped
    ? { status: 'anomaly', value, raw: rawJson, reason: 'malformed-moments' }
    : { status: 'clean', value };
}

/** Canonical serialization of an envelope (moments pre-sorted by `normalizeMoments`). */
export function serialize(value: PersistedMoments): string {
  return JSON.stringify(value);
}
