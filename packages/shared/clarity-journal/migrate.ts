// Clarity Journal persistence schema + forward-only versioned migrator (SR-13).
// Mirrors check-in/migrate.ts: user data is NEVER silently reseeded — on anomaly
// the store quarantines the raw blob and continues on a best-effort recovered
// subset. The journal envelope holds several collections; each is normalized
// independently and any drop flips the whole load to `anomaly`.

import {
  EMOTION_MAX,
  EMOTION_MIN,
  MOOD_MAX,
  MOOD_MIN,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from './constants';
import { isLocalCalendarDate } from './dates';
import {
  type BehavioralActivation,
  type DailyJournalCheckIn,
  FIELD_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  type SafetyFlag,
  type SafetyPlan,
  type ThoughtRecord,
  type TriggerLog,
  type WeeklyReflection,
  type WeeklyScreening,
  type WellnessToolbox,
} from './types';

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'mobile:clarity-journal';
export const QUARANTINE_KEY_PREFIX = `${STORAGE_KEY}:quarantine:`;

export interface PersistedJournal {
  readonly version: number;
  readonly dailyCheckIns: DailyJournalCheckIn[];
  readonly weeklyScreenings: WeeklyScreening[];
  readonly weeklyReflections: WeeklyReflection[];
  readonly thoughtRecords: ThoughtRecord[];
  readonly behavioralActivations: BehavioralActivation[];
  readonly triggerLogs: TriggerLog[];
  readonly wellnessToolbox: WellnessToolbox | null;
  readonly safetyPlan: SafetyPlan | null;
  readonly safetyFlags: SafetyFlag[];
}

export type AnomalyReason =
  | 'corrupt-json'
  | 'not-an-object'
  | 'missing-version'
  | 'future-version'
  | 'no-migration-path'
  | 'malformed-collections';

export type MigrateOutcome =
  | { readonly status: 'clean'; readonly value: PersistedJournal }
  | {
      readonly status: 'anomaly';
      readonly value: PersistedJournal;
      readonly raw: string;
      readonly reason: AnomalyReason;
    };

// Forward-only transform registry, indexed by `from` (same pattern as
// engagement/migrate.ts and sleep/migrate.ts). Each step receives the FULL parsed
// envelope of version `from` and returns the envelope shaped for version `to`;
// `migrate` walks the registry stepwise and only then validates the collections
// against the current-version validators. Empty: v1 is the first journal schema.
interface Transform {
  readonly from: number;
  readonly to: number;
  readonly transform: (raw: unknown) => unknown;
}
export type JournalTransform = Transform;
const TRANSFORMS: readonly Transform[] = [];

export function emptyStore(): PersistedJournal {
  return {
    version: SCHEMA_VERSION,
    dailyCheckIns: [],
    weeklyScreenings: [],
    weeklyReflections: [],
    thoughtRecords: [],
    behavioralActivations: [],
    triggerLogs: [],
    wellnessToolbox: null,
    safetyPlan: null,
    safetyFlags: [],
  };
}

// ── field guards ───────────────────────────────────────────────────────────
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isStr = (v: unknown, max = FIELD_MAX_LENGTH): v is string =>
  typeof v === 'string' && v.length <= max;
const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isItem = (v: unknown, lo: number, hi: number): boolean => isInt(v, lo, hi);
const isStrArr = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string' && s.length <= FIELD_MAX_LENGTH);

function isPair(v: unknown, lo: number, hi: number): boolean {
  return Array.isArray(v) && v.length === 2 && isItem(v[0], lo, hi) && isItem(v[1], lo, hi);
}

function validDailyCheckIn(v: unknown): v is DailyJournalCheckIn {
  if (!isObj(v)) return false;
  return (
    isId(v.id) &&
    isLocalCalendarDate(v.date) &&
    typeof v.createdAt === 'string' &&
    isInt(v.mood, MOOD_MIN, MOOD_MAX) &&
    isInt(v.energy, MOOD_MIN, MOOD_MAX) &&
    typeof v.sleptLastNight === 'boolean' &&
    (v.sleepHours === undefined || (typeof v.sleepHours === 'number' && v.sleepHours >= 0 && v.sleepHours <= 24)) &&
    (v.note === undefined || isStr(v.note, NOTE_MAX_LENGTH)) &&
    Array.isArray(v.tags) && v.tags.every((t) => typeof t === 'string')
  );
}

function validScreening(v: unknown): v is WeeklyScreening {
  if (!isObj(v)) return false;
  return (
    isId(v.id) && isLocalCalendarDate(v.weekStart) && typeof v.createdAt === 'string' &&
    isPair(v.phq2, 0, 3) && isPair(v.gad2, 0, 3) && isPair(v.pss4, 0, 4) && isPair(v.who5, 0, 5)
  );
}

function validReflection(v: unknown): v is WeeklyReflection {
  if (!isObj(v)) return false;
  return (
    isId(v.id) && isLocalCalendarDate(v.weekStart) && typeof v.createdAt === 'string' &&
    isStr(v.wentWell) && isStr(v.wasDifficult) && isStr(v.patterns) && isStr(v.doNext) && isStr(v.gratitude)
  );
}

function validThoughtRecord(v: unknown): v is ThoughtRecord {
  if (!isObj(v)) return false;
  return (
    isId(v.id) && isLocalCalendarDate(v.date) && typeof v.createdAt === 'string' &&
    isStr(v.situation) && isStr(v.automaticThought) && isStrArr(v.distortions) &&
    isStr(v.evidenceFor) && isStr(v.evidenceAgainst) && isStr(v.balancedThought) &&
    isInt(v.emotionBefore, EMOTION_MIN, EMOTION_MAX) && isInt(v.emotionAfter, EMOTION_MIN, EMOTION_MAX)
  );
}

function validActivation(v: unknown): v is BehavioralActivation {
  if (!isObj(v)) return false;
  return (
    isId(v.id) && isLocalCalendarDate(v.date) && typeof v.createdAt === 'string' &&
    isStr(v.activity) && (v.type === 'mastery' || v.type === 'pleasure' || v.type === 'both') &&
    isInt(v.predictedMood, EMOTION_MIN, EMOTION_MAX) &&
    (v.actualMood === undefined || isInt(v.actualMood, EMOTION_MIN, EMOTION_MAX))
  );
}

function validTrigger(v: unknown): v is TriggerLog {
  if (!isObj(v)) return false;
  return (
    isId(v.id) && isLocalCalendarDate(v.date) && typeof v.createdAt === 'string' &&
    isStr(v.trigger) && isInt(v.severity, SEVERITY_MIN, SEVERITY_MAX) && isStr(v.category) &&
    (v.subCategory === undefined || isStr(v.subCategory)) &&
    (v.whatHelps === undefined || isStr(v.whatHelps)) &&
    (v.whatWorsens === undefined || isStr(v.whatWorsens)) &&
    (v.effectiveness === undefined || isInt(v.effectiveness, SEVERITY_MIN, SEVERITY_MAX))
  );
}

function validToolbox(v: unknown): v is WellnessToolbox {
  if (!isObj(v)) return false;
  return (
    typeof v.updatedAt === 'string' &&
    isStrArr(v.physical) && isStrArr(v.social) && isStrArr(v.mental) && isStrArr(v.professional)
  );
}

function validSafetyPlan(v: unknown): v is SafetyPlan {
  if (!isObj(v) || !isObj(v.sections)) return false;
  const sectionsOk = ([1, 2, 3, 4, 5, 6] as const).every((n) => isStrArr((v.sections as Record<string, unknown>)[n]));
  const contactsOk =
    Array.isArray(v.crisisContacts) &&
    v.crisisContacts.every(
      (c) => isObj(c) && typeof c.label === 'string' && (c.phone === undefined || typeof c.phone === 'string'),
    );
  return typeof v.updatedAt === 'string' && sectionsOk && contactsOk;
}

function validSafetyFlag(v: unknown): v is SafetyFlag {
  return isObj(v) && isLocalCalendarDate(v.date) && v.source === 'keyword' && typeof v.createdAt === 'string';
}

/** Normalize a list: keep valid items, flag drops. Optional dedupe key keeps last-wins. */
function normalizeList<T>(
  raw: unknown,
  valid: (v: unknown) => v is T,
  key?: (item: T) => string,
): { items: T[]; dropped: boolean } {
  if (!Array.isArray(raw)) return { items: [], dropped: raw !== undefined };
  let dropped = false;
  const out: T[] = [];
  const seen = new Map<string, number>();
  for (const c of raw) {
    if (!valid(c)) {
      dropped = true;
      continue;
    }
    if (key) {
      const k = key(c);
      if (seen.has(k)) {
        dropped = true;
        out[seen.get(k) as number] = c; // last wins
        continue;
      }
      seen.set(k, out.length);
    }
    out.push(c);
  }
  return { items: out, dropped };
}

/**
 * Parse + migrate a persisted journal blob. `transforms` is injectable for the
 * migrator's own tests (DI seam, rules/conventions.md #3); production callers
 * always use the module TRANSFORMS registry via the default.
 */
export function migrate(
  rawJson: string | null,
  transforms: readonly Transform[] = TRANSFORMS,
): MigrateOutcome {
  if (rawJson === null) return { status: 'clean', value: emptyStore() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'corrupt-json' };
  }
  if (!isObj(parsed)) {
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'not-an-object' };
  }
  if (typeof parsed.version !== 'number') {
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'missing-version' };
  }
  if (parsed.version > SCHEMA_VERSION) {
    return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'future-version' };
  }
  let envelope: Record<string, unknown> = parsed;
  if (parsed.version < SCHEMA_VERSION) {
    // Apply the stepwise N→N+1 transforms BEFORE validating (same loop as
    // engagement/migrate.ts and sleep/migrate.ts). Validating an old-version
    // payload against the current validators would mass-quarantine every journal.
    let cursor = parsed.version;
    let payload: unknown = parsed;
    while (cursor < SCHEMA_VERSION) {
      const step = transforms.find((t) => t.from === cursor);
      if (!step) {
        return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'no-migration-path' };
      }
      payload = step.transform(payload);
      cursor = step.to;
    }
    if (!isObj(payload)) {
      return { status: 'anomaly', value: emptyStore(), raw: rawJson, reason: 'not-an-object' };
    }
    envelope = payload;
  }

  const dc = normalizeList<DailyJournalCheckIn>(envelope.dailyCheckIns, validDailyCheckIn, (e) => e.date);
  const ws = normalizeList<WeeklyScreening>(envelope.weeklyScreenings, validScreening, (e) => e.weekStart);
  const wr = normalizeList<WeeklyReflection>(envelope.weeklyReflections, validReflection, (e) => e.weekStart);
  const tr = normalizeList<ThoughtRecord>(envelope.thoughtRecords, validThoughtRecord);
  const ba = normalizeList<BehavioralActivation>(envelope.behavioralActivations, validActivation);
  const tg = normalizeList<TriggerLog>(envelope.triggerLogs, validTrigger);
  const sf = normalizeList<SafetyFlag>(envelope.safetyFlags, validSafetyFlag);

  let toolbox: WellnessToolbox | null = null;
  let toolboxDropped = false;
  if (envelope.wellnessToolbox != null) {
    if (validToolbox(envelope.wellnessToolbox)) toolbox = envelope.wellnessToolbox;
    else toolboxDropped = true;
  }
  let plan: SafetyPlan | null = null;
  let planDropped = false;
  if (envelope.safetyPlan != null) {
    if (validSafetyPlan(envelope.safetyPlan)) plan = envelope.safetyPlan;
    else planDropped = true;
  }

  const value: PersistedJournal = {
    version: SCHEMA_VERSION,
    dailyCheckIns: dc.items,
    weeklyScreenings: ws.items,
    weeklyReflections: wr.items,
    thoughtRecords: tr.items,
    behavioralActivations: ba.items,
    triggerLogs: tg.items,
    wellnessToolbox: toolbox,
    safetyPlan: plan,
    safetyFlags: sf.items,
  };

  const dropped =
    dc.dropped || ws.dropped || wr.dropped || tr.dropped || ba.dropped || tg.dropped ||
    sf.dropped || toolboxDropped || planDropped;

  return dropped
    ? { status: 'anomaly', value, raw: rawJson, reason: 'malformed-collections' }
    : { status: 'clean', value };
}

export function serialize(value: PersistedJournal): string {
  return JSON.stringify(value);
}
