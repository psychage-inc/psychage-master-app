// ClarityJournalStore — the typed boundary for every Clarity Journal section.
// LOCAL-ONLY (SR-4): writes the injected Storage seam and nowhere else — no
// Supabase, no analytics, no Sentry. Load → migrate → quarantine-on-anomaly →
// hydrate, mirroring check-in's record store (nothing the user wrote is lost).
//
// Date rules (same class of bug check-in guards): daily check-in keys to the
// DEVICE's local day at save time and edits in place; screening/reflection key
// to the ISO `weekStart`. Free-text fields are validated for length here, but
// crisis SCANNING of their content happens in the app (CrisisScannedField) — the
// store never sees un-scanned text as a safety bypass (SR-2 is enforced at input).

import {
  EMOTION_MAX,
  EMOTION_MIN,
  MOOD_MAX,
  MOOD_MIN,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from './constants';
import { toLocalCalendarDate, weekStart } from './dates';
import {
  type AnomalyReason,
  emptyStore,
  migrate,
  type PersistedJournal,
  QUARANTINE_KEY_PREFIX,
  SCHEMA_VERSION,
  serialize,
  STORAGE_KEY,
} from './migrate';
import {
  type BehavioralActivation,
  ClarityJournalEntryNotFoundError,
  ClarityJournalValidationError,
  type ClarityJournalStoreDeps,
  type DailyJournalCheckIn,
  FIELD_MAX_LENGTH,
  type LocalCalendarDate,
  NOTE_MAX_LENGTH,
  type SafetyFlag,
  type SafetyPlan,
  type Storage,
  type ThoughtRecord,
  type TriggerLog,
  type WeeklyReflection,
  type WeeklyScreening,
  type WellnessToolbox,
} from './types';

export interface ClarityJournalAnomaly {
  readonly reason: AnomalyReason;
  readonly quarantineKey: string;
  readonly detectedAtIso: string;
}

type DailyInput = Omit<DailyJournalCheckIn, 'id' | 'date' | 'createdAt'>;
type ScreeningInput = Omit<WeeklyScreening, 'id' | 'weekStart' | 'createdAt'>;
type ReflectionInput = Omit<WeeklyReflection, 'id' | 'weekStart' | 'createdAt'>;
type ThoughtRecordInput = Omit<ThoughtRecord, 'id' | 'date' | 'createdAt'>;
type ActivationInput = Omit<BehavioralActivation, 'id' | 'date' | 'createdAt' | 'actualMood'>;
type TriggerInput = Omit<TriggerLog, 'id' | 'date' | 'createdAt'>;

const byCreatedDesc = (a: { createdAt: string }, b: { createdAt: string }): number =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;

export class ClarityJournalStore {
  private readonly storage: Storage;
  private readonly now: () => Date;
  private readonly generateId: () => string;

  private data: PersistedJournal = emptyStore();
  private anomaly: ClarityJournalAnomaly | null = null;

  constructor(deps: ClarityJournalStoreDeps) {
    this.storage = deps.storage;
    this.now = deps.now;
    this.generateId = deps.generateId;
    this.load();
  }

  get lastAnomaly(): ClarityJournalAnomaly | null {
    return this.anomaly;
  }

  // ── daily check-in (one per local day, edit-in-place) ──────────────────────
  saveDailyCheckIn(input: DailyInput): DailyJournalCheckIn {
    this.assertMood(input.mood, 'mood');
    this.assertMood(input.energy, 'energy');
    // Same bounds the loader enforces (migrate.ts validDailyCheckIn): a finite number
    // in 0..24. NaN slipped the old `< 0 || > 24` check at write, then dropped the
    // whole check-in on the next launch's load — write/read asymmetry.
    if (
      input.sleepHours !== undefined &&
      !(
        typeof input.sleepHours === 'number' &&
        Number.isFinite(input.sleepHours) &&
        input.sleepHours >= 0 &&
        input.sleepHours <= 24
      )
    ) {
      throw new ClarityJournalValidationError('sleepHours must be a finite number 0..24');
    }
    if (input.note !== undefined) this.assertLen(input.note, NOTE_MAX_LENGTH, 'note');
    const date = toLocalCalendarDate(this.now());
    const existing = this.data.dailyCheckIns.find((e) => e.date === date);
    const entry: DailyJournalCheckIn = {
      ...input,
      tags: [...input.tags],
      id: existing ? existing.id : this.generateId(),
      date,
      createdAt: existing ? existing.createdAt : this.iso(),
    };
    this.data = {
      ...this.data,
      dailyCheckIns: upsert(this.data.dailyCheckIns, entry, (e) => e.date === date),
    };
    this.persist();
    return entry;
  }

  getDailyCheckIn(date: LocalCalendarDate): DailyJournalCheckIn | undefined {
    return this.data.dailyCheckIns.find((e) => e.date === date);
  }

  getRecentDailyCheckIns(n: number): DailyJournalCheckIn[] {
    return sortByDateDesc(this.data.dailyCheckIns).slice(0, Math.max(0, n));
  }

  // ── weekly screening (one per weekStart) ───────────────────────────────────
  saveScreening(input: ScreeningInput, when = this.now()): WeeklyScreening {
    // Same bounds the loader enforces (migrate.ts validScreening / isPair): each
    // instrument is a 2-item integer pair within its scale. Validating at write
    // keeps a bad pair from quarantining the whole journal on the next launch.
    this.assertPair(input.phq2, 0, 3, 'phq2');
    this.assertPair(input.gad2, 0, 3, 'gad2');
    this.assertPair(input.pss4, 0, 4, 'pss4');
    this.assertPair(input.who5, 0, 5, 'who5');
    const ws = weekStart(toLocalCalendarDate(when));
    const existing = this.data.weeklyScreenings.find((e) => e.weekStart === ws);
    const entry: WeeklyScreening = {
      ...input,
      id: existing ? existing.id : this.generateId(),
      weekStart: ws,
      createdAt: existing ? existing.createdAt : this.iso(),
    };
    this.data = {
      ...this.data,
      weeklyScreenings: upsert(this.data.weeklyScreenings, entry, (e) => e.weekStart === ws),
    };
    this.persist();
    return entry;
  }

  getScreening(ws: LocalCalendarDate): WeeklyScreening | undefined {
    return this.data.weeklyScreenings.find((e) => e.weekStart === ws);
  }

  getRecentScreenings(n: number): WeeklyScreening[] {
    return [...this.data.weeklyScreenings].sort(byWeekDesc).slice(0, Math.max(0, n));
  }

  // ── weekly reflection (one per weekStart) ──────────────────────────────────
  saveReflection(input: ReflectionInput, when = this.now()): WeeklyReflection {
    for (const [k, v] of Object.entries(input)) this.assertLen(v as string, FIELD_MAX_LENGTH, k);
    const ws = weekStart(toLocalCalendarDate(when));
    const existing = this.data.weeklyReflections.find((e) => e.weekStart === ws);
    const entry: WeeklyReflection = {
      ...input,
      id: existing ? existing.id : this.generateId(),
      weekStart: ws,
      createdAt: existing ? existing.createdAt : this.iso(),
    };
    this.data = {
      ...this.data,
      weeklyReflections: upsert(this.data.weeklyReflections, entry, (e) => e.weekStart === ws),
    };
    this.persist();
    return entry;
  }

  getReflection(ws: LocalCalendarDate): WeeklyReflection | undefined {
    return this.data.weeklyReflections.find((e) => e.weekStart === ws);
  }

  // ── thought records (append; delete by id) ─────────────────────────────────
  addThoughtRecord(input: ThoughtRecordInput): ThoughtRecord {
    this.assertEmotion(input.emotionBefore, 'emotionBefore');
    this.assertEmotion(input.emotionAfter, 'emotionAfter');
    for (const f of ['situation', 'automaticThought', 'evidenceFor', 'evidenceAgainst', 'balancedThought'] as const) {
      this.assertLen(input[f], FIELD_MAX_LENGTH, f);
    }
    const entry: ThoughtRecord = {
      ...input,
      distortions: [...input.distortions],
      id: this.generateId(),
      date: toLocalCalendarDate(this.now()),
      createdAt: this.iso(),
    };
    this.data = { ...this.data, thoughtRecords: [...this.data.thoughtRecords, entry] };
    this.persist();
    return entry;
  }

  getThoughtRecords(n?: number): ThoughtRecord[] {
    const sorted = [...this.data.thoughtRecords].sort(byCreatedDesc);
    return n === undefined ? sorted : sorted.slice(0, Math.max(0, n));
  }

  deleteThoughtRecord(id: string): void {
    const next = this.data.thoughtRecords.filter((e) => e.id !== id);
    if (next.length === this.data.thoughtRecords.length) throw new ClarityJournalEntryNotFoundError(id);
    this.data = { ...this.data, thoughtRecords: next };
    this.persist();
  }

  // ── behavioral activation (add planned; rate later) ────────────────────────
  addActivation(input: ActivationInput): BehavioralActivation {
    this.assertEmotion(input.predictedMood, 'predictedMood');
    this.assertLen(input.activity, FIELD_MAX_LENGTH, 'activity');
    const entry: BehavioralActivation = {
      ...input,
      id: this.generateId(),
      date: toLocalCalendarDate(this.now()),
      createdAt: this.iso(),
    };
    this.data = { ...this.data, behavioralActivations: [...this.data.behavioralActivations, entry] };
    this.persist();
    return entry;
  }

  rateActivation(id: string, actualMood: number): BehavioralActivation {
    this.assertEmotion(actualMood, 'actualMood');
    const existing = this.data.behavioralActivations.find((e) => e.id === id);
    if (!existing) throw new ClarityJournalEntryNotFoundError(id);
    const updated = { ...existing, actualMood };
    this.data = {
      ...this.data,
      behavioralActivations: this.data.behavioralActivations.map((e) => (e.id === id ? updated : e)),
    };
    this.persist();
    return updated;
  }

  getActivations(n?: number): BehavioralActivation[] {
    const sorted = [...this.data.behavioralActivations].sort(byCreatedDesc);
    return n === undefined ? sorted : sorted.slice(0, Math.max(0, n));
  }

  // ── trigger log ────────────────────────────────────────────────────────────
  addTrigger(input: TriggerInput): TriggerLog {
    this.assertRange(input.severity, SEVERITY_MIN, SEVERITY_MAX, 'severity');
    if (input.effectiveness !== undefined) {
      this.assertRange(input.effectiveness, SEVERITY_MIN, SEVERITY_MAX, 'effectiveness');
    }
    this.assertLen(input.trigger, FIELD_MAX_LENGTH, 'trigger');
    const entry: TriggerLog = {
      ...input,
      id: this.generateId(),
      date: toLocalCalendarDate(this.now()),
      createdAt: this.iso(),
    };
    this.data = { ...this.data, triggerLogs: [...this.data.triggerLogs, entry] };
    this.persist();
    return entry;
  }

  getTriggers(n?: number): TriggerLog[] {
    const sorted = [...this.data.triggerLogs].sort(byCreatedDesc);
    return n === undefined ? sorted : sorted.slice(0, Math.max(0, n));
  }

  // ── singletons: wellness toolbox + safety plan ─────────────────────────────
  saveToolbox(toolbox: Omit<WellnessToolbox, 'updatedAt'>): WellnessToolbox {
    const next: WellnessToolbox = { ...toolbox, updatedAt: this.iso() };
    this.data = { ...this.data, wellnessToolbox: next };
    this.persist();
    return next;
  }

  getToolbox(): WellnessToolbox | null {
    return this.data.wellnessToolbox;
  }

  saveSafetyPlan(plan: Omit<SafetyPlan, 'updatedAt'>): SafetyPlan {
    const next: SafetyPlan = { ...plan, updatedAt: this.iso() };
    this.data = { ...this.data, safetyPlan: next };
    this.persist();
    return next;
  }

  getSafetyPlan(): SafetyPlan | null {
    return this.data.safetyPlan;
  }

  // ── safety flags (crisis-keyword hits; on-device only) ─────────────────────
  addSafetyFlag(date = toLocalCalendarDate(this.now())): SafetyFlag {
    const flag: SafetyFlag = { date, source: 'keyword', createdAt: this.iso() };
    this.data = { ...this.data, safetyFlags: [...this.data.safetyFlags, flag] };
    this.persist();
    return flag;
  }

  getSafetyFlags(): SafetyFlag[] {
    return [...this.data.safetyFlags];
  }

  /** Full read-only snapshot — for insights/report aggregation. */
  snapshot(): PersistedJournal {
    return this.data;
  }

  // ── internals ──────────────────────────────────────────────────────────────
  private iso(): string {
    return this.now().toISOString();
  }

  private assertMood(v: number, field: string): void {
    this.assertRange(v, MOOD_MIN, MOOD_MAX, field);
  }

  private assertEmotion(v: number, field: string): void {
    this.assertRange(v, EMOTION_MIN, EMOTION_MAX, field);
  }

  private assertRange(v: number, lo: number, hi: number, field: string): void {
    if (!Number.isInteger(v) || v < lo || v > hi) {
      throw new ClarityJournalValidationError(`${field} must be an integer ${lo}..${hi}, got ${String(v)}`);
    }
  }

  private assertPair(v: readonly [number, number], lo: number, hi: number, field: string): void {
    if (!Array.isArray(v) || v.length !== 2) {
      throw new ClarityJournalValidationError(`${field} must be a 2-item pair`);
    }
    this.assertRange(v[0], lo, hi, `${field}[0]`);
    this.assertRange(v[1], lo, hi, `${field}[1]`);
  }

  private assertLen(v: string, max: number, field: string): void {
    if (typeof v !== 'string' || v.length > max) {
      throw new ClarityJournalValidationError(`${field} exceeds ${max} characters`);
    }
  }

  private persist(): void {
    this.storage.set(STORAGE_KEY, serialize(this.data));
  }

  private load(): void {
    const raw = this.storage.get(STORAGE_KEY);
    const outcome = migrate(raw);
    this.data = outcome.value;
    if (outcome.status === 'anomaly') {
      const detectedAtIso = this.iso();
      const quarantineKey = `${QUARANTINE_KEY_PREFIX}${detectedAtIso}-${this.generateId()}`;
      this.storage.set(quarantineKey, outcome.raw);
      this.anomaly = { reason: outcome.reason, quarantineKey, detectedAtIso };
      this.persist(); // reset primary key to the clean recovered shape
      return;
    }
    const canonical = serialize({ ...emptyStore(), ...outcome.value, version: SCHEMA_VERSION });
    if (raw !== canonical) this.storage.set(STORAGE_KEY, serialize(this.data));
  }
}

function upsert<T>(list: readonly T[], item: T, match: (e: T) => boolean): T[] {
  const idx = list.findIndex(match);
  if (idx === -1) return [...list, item];
  const next = [...list];
  next[idx] = item;
  return next;
}

function sortByDateDesc<T extends { date: LocalCalendarDate }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function byWeekDesc(a: { weekStart: string }, b: { weekStart: string }): number {
  return a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0;
}
