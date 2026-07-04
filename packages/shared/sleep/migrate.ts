// Sleep persistence schema + forward-only versioned migrator (Sacred Rule #13:
// every persisted shape carries a version + an N→N+1 transform from day one).
//
// User-data policy (same as @psychage/shared/check-in): NEVER silently reseed. On
// any anomaly, `migrate` returns `status: 'anomaly'` carrying the raw blob; the
// store quarantines it and surfaces the anomaly before continuing on a best-effort
// recovered subset. Settings are low-stakes preferences — they sanitize to
// defaults rather than triggering an anomaly; only ENTRY problems quarantine.

import { DEFAULT_SLEEP_SETTINGS } from './constants';
import { isLocalCalendarDate } from './dates';
import {
  type ChronotypeAnimal,
  type NapEntry,
  SLEEP_NOTE_MAX,
  type SleepEntry,
  type SleepSettings,
  type SubstanceLog,
} from './types';

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'mobile:sleep-entries';
/** Quarantined blobs land at `${STORAGE_KEY}:quarantine:<iso>-<uuid>`. */
export const QUARANTINE_KEY_PREFIX = `${STORAGE_KEY}:quarantine:`;

/** The persisted envelope. `version` + `settings` are meta; `entries` is user data. */
export interface PersistedSleep {
  readonly version: number;
  readonly settings: SleepSettings;
  readonly entries: SleepEntry[];
}

export type AnomalyReason =
  | 'corrupt-json'
  | 'not-an-object'
  | 'missing-version'
  | 'future-version'
  | 'no-migration-path'
  | 'malformed-entries';

export type MigrateOutcome =
  | { readonly status: 'clean'; readonly value: PersistedSleep }
  | {
      readonly status: 'anomaly';
      readonly value: PersistedSleep;
      readonly raw: string;
      readonly reason: AnomalyReason;
    };

// Forward-only transform registry, indexed by `from`. Empty: v1 is the first
// sleep schema. A future v2 adds an entry here; `migrate` already walks it.
interface Transform {
  readonly from: number;
  readonly to: number;
  readonly transform: (raw: unknown) => unknown;
}
const TRANSFORMS: readonly Transform[] = [];

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ANIMALS: readonly ChronotypeAnimal[] = ['lion', 'bear', 'wolf', 'dolphin'];

function isHHMM(value: unknown): value is string {
  return typeof value === 'string' && HHMM_RE.test(value);
}

function isNonNegInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonNegNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isRating(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= SLEEP_NOTE_MAX);
}

function isValidNap(value: unknown): value is NapEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return isHHMM(v.start) && isHHMM(v.end);
}

function isValidSubstances(value: unknown): value is SubstanceLog {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.alcohol !== 'boolean') return false;
  if (typeof v.exercise !== 'boolean') return false;
  if (typeof v.medication_sleep_aid !== 'boolean') return false;
  if (v.caffeine_last_time !== undefined && !isHHMM(v.caffeine_last_time)) return false;
  if (v.exercise_time !== undefined && !isHHMM(v.exercise_time)) return false;
  if (v.alcohol_units !== undefined && !isNonNegNumber(v.alcohol_units)) return false;
  if (v.screens_before_bed_minutes !== undefined && !isNonNegNumber(v.screens_before_bed_minutes))
    return false;
  return true;
}

function isValidEntry(value: unknown): value is SleepEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (!isLocalCalendarDate(v.date)) return false;
  if (typeof v.created_at !== 'string' || v.created_at.length === 0) return false;
  if (!isHHMM(v.bedtime) || !isHHMM(v.lights_out) || !isHHMM(v.wake_time) || !isHHMM(v.out_of_bed_time))
    return false;
  if (!isNonNegInt(v.sleep_onset_minutes)) return false;
  if (!isNonNegInt(v.night_wakings)) return false;
  if (!isNonNegInt(v.night_waking_duration_minutes)) return false;
  if (!isRating(v.sleep_quality) || !isRating(v.morning_mood)) return false;
  if (typeof v.dream_recall !== 'boolean') return false;
  if (!isOptionalText(v.dream_notes) || !isOptionalText(v.notes)) return false;
  if (!Array.isArray(v.naps) || !v.naps.every(isValidNap)) return false;
  if (!isValidSubstances(v.substances)) return false;
  return true;
}

/** Canonicalize one validated substances object — drop unknown keys, omit absent optionals. */
function canonicalSubstances(s: SubstanceLog): SubstanceLog {
  const base: SubstanceLog = {
    alcohol: s.alcohol,
    exercise: s.exercise,
    medication_sleep_aid: s.medication_sleep_aid,
  };
  return {
    ...base,
    ...(s.caffeine_last_time !== undefined ? { caffeine_last_time: s.caffeine_last_time } : {}),
    ...(s.alcohol_units !== undefined ? { alcohol_units: s.alcohol_units } : {}),
    ...(s.screens_before_bed_minutes !== undefined
      ? { screens_before_bed_minutes: s.screens_before_bed_minutes }
      : {}),
    ...(s.exercise_time !== undefined ? { exercise_time: s.exercise_time } : {}),
  };
}

/** Canonicalize one validated entry — drop unknown keys, omit absent optional text. */
function canonicalEntry(entry: SleepEntry): SleepEntry {
  return {
    id: entry.id,
    date: entry.date,
    created_at: entry.created_at,
    bedtime: entry.bedtime,
    lights_out: entry.lights_out,
    sleep_onset_minutes: entry.sleep_onset_minutes,
    wake_time: entry.wake_time,
    out_of_bed_time: entry.out_of_bed_time,
    night_wakings: entry.night_wakings,
    night_waking_duration_minutes: entry.night_waking_duration_minutes,
    sleep_quality: entry.sleep_quality,
    morning_mood: entry.morning_mood,
    dream_recall: entry.dream_recall,
    naps: entry.naps.map((n) => ({ start: n.start, end: n.end })),
    substances: canonicalSubstances(entry.substances),
    ...(entry.dream_notes !== undefined ? { dream_notes: entry.dream_notes } : {}),
    ...(entry.notes !== undefined ? { notes: entry.notes } : {}),
  };
}

/** Ascending chronological order (lexical on `YYYY-MM-DD` equals chronological). */
export function compareByDate(a: SleepEntry, b: SleepEntry): number {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  return 0;
}

/**
 * Validate + dedupe a raw entries array. Keeps every well-formed entry; collapses
 * duplicate calendar days (last occurrence wins, enforcing one-per-day on read).
 * `dropped` is true when anything was rejected or collapsed.
 */
export function normalizeEntries(raw: unknown): { entries: SleepEntry[]; dropped: boolean } {
  if (!Array.isArray(raw)) return { entries: [], dropped: true };

  const byDate = new Map<string, SleepEntry>();
  let dropped = false;

  for (const candidate of raw) {
    if (!isValidEntry(candidate)) {
      dropped = true;
      continue;
    }
    if (byDate.has(candidate.date)) dropped = true; // duplicate day collapsed
    byDate.set(candidate.date, canonicalEntry(candidate));
  }

  return { entries: [...byDate.values()].sort(compareByDate), dropped };
}

/** Coerce raw settings to a valid SleepSettings, falling back to defaults per field. */
export function sanitizeSettings(raw: unknown): SleepSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SLEEP_SETTINGS;
  const v = raw as Record<string, unknown>;

  const target_sleep_minutes = isNonNegInt(v.target_sleep_minutes)
    ? v.target_sleep_minutes
    : DEFAULT_SLEEP_SETTINGS.target_sleep_minutes;
  const age_range =
    typeof v.age_range === 'string' && v.age_range.length > 0
      ? v.age_range
      : DEFAULT_SLEEP_SETTINGS.age_range;

  return {
    target_sleep_minutes,
    age_range,
    ...(ANIMALS.includes(v.chronotype as ChronotypeAnimal)
      ? { chronotype: v.chronotype as ChronotypeAnimal }
      : {}),
    ...(isHHMM(v.target_bedtime) ? { target_bedtime: v.target_bedtime } : {}),
    ...(isHHMM(v.target_wake_time) ? { target_wake_time: v.target_wake_time } : {}),
  };
}

function emptyStore(): PersistedSleep {
  return { version: SCHEMA_VERSION, settings: DEFAULT_SLEEP_SETTINGS, entries: [] };
}

/**
 * Parse + migrate a persisted sleep blob.
 *
 * - `null` (no data) → clean empty store.
 * - matching version, all entries valid → clean pass-through.
 * - matching version, some entries malformed/duplicated → anomaly carrying the
 *   salvageable subset (store quarantines the raw, keeps the subset).
 * - corrupt JSON / non-object / missing version / future version / no migration
 *   path → anomaly carrying the raw and an empty recovered store.
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

  const envelope = parsed as { version?: unknown; settings?: unknown; entries?: unknown };
  if (typeof envelope.version !== 'number') {
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'missing-version' };
  }
  const version = envelope.version;

  if (version > SCHEMA_VERSION) {
    // Downgraded app reading newer state — preserve, never discard.
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'future-version' };
  }

  const settings = sanitizeSettings(envelope.settings);

  if (version < SCHEMA_VERSION) {
    let cursor = version;
    let payload: unknown = envelope.entries;
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
    const migrated = normalizeEntries(payload);
    const value: PersistedSleep = { version: SCHEMA_VERSION, settings, entries: migrated.entries };
    return migrated.dropped
      ? { status: 'anomaly', value, raw: rawJson, reason: 'malformed-entries' }
      : { status: 'clean', value };
  }

  // version === SCHEMA_VERSION
  const { entries, dropped } = normalizeEntries(envelope.entries);
  const value: PersistedSleep = { version: SCHEMA_VERSION, settings, entries };
  return dropped
    ? { status: 'anomaly', value, raw: rawJson, reason: 'malformed-entries' }
    : { status: 'clean', value };
}

/** Canonical serialization of an envelope (entries pre-sorted by `normalizeEntries`). */
export function serialize(value: PersistedSleep): string {
  return JSON.stringify(value);
}
