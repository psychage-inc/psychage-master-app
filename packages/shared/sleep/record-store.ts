// SleepRecordStore — the typed boundary for the native Sleep Architect. The diary,
// dashboard, tools, and insights screens all read/write through this.
//
// LOCAL-ONLY. Writes to the injected Storage seam and nowhere else — no Supabase,
// no network, no sync (SR-4), no analytics, no Sentry. Sleep data never leaves the
// device.
//
// THE TWO DATE RULES (the wrong-day bug class this store exists to prevent), same
// contract as @psychage/shared/check-in:
//   1. saveToday keys to the DEVICE'S LOCAL CALENDAR DAY AT SAVE TIME. A night
//      logged at 00:30 Wednesday is Wednesday's entry.
//   2. editEntry keys to THE ENTRY'S STORED DATE, never the edit-time clock. The
//      id, date, and created_at minted at creation are immutable; an edit
//      overwrites only the input fields.
// At most one entry exists per calendar day (saveToday overwrites today's).

import { toLocalCalendarDate } from './dates';
import {
  type AnomalyReason,
  compareByDate,
  migrate,
  type PersistedSleep,
  QUARANTINE_KEY_PREFIX,
  sanitizeSettings,
  SCHEMA_VERSION,
  serialize,
  STORAGE_KEY,
} from './migrate';
import {
  type LocalCalendarDate,
  SLEEP_NOTE_MAX,
  type SleepEntry,
  type SleepEntryInput,
  SleepEntryNotFoundError,
  type SleepSettings,
  type SleepStoreDeps,
  type Storage,
  SleepValidationError,
} from './types';

/**
 * A surfaced load anomaly. The raw blob is preserved verbatim at `quarantineKey`;
 * the store continued on a best-effort recovered subset of `recoveredEntryCount`
 * entries. Surfaced (not swallowed) so a later recovery UI / telemetry can act.
 */
export interface SleepAnomaly {
  readonly reason: AnomalyReason;
  readonly quarantineKey: string;
  readonly recoveredEntryCount: number;
  readonly detectedAtIso: string;
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function cloneEntry(entry: SleepEntry): SleepEntry {
  return { ...entry, naps: entry.naps.map((n) => ({ ...n })), substances: { ...entry.substances } };
}

export class SleepRecordStore {
  private readonly storage: Storage;
  private readonly now: () => Date;
  private readonly generateId: () => string;

  private readonly byDate = new Map<LocalCalendarDate, SleepEntry>();
  private settingsValue: SleepSettings;
  private anomaly: SleepAnomaly | null = null;

  constructor(deps: SleepStoreDeps) {
    this.storage = deps.storage;
    this.now = deps.now;
    this.generateId = deps.generateId;
    this.settingsValue = sanitizeSettings(undefined);
    this.load();
  }

  // ── reads ────────────────────────────────────────────────────────────────

  /** Today's entry (device-local calendar day), or undefined. */
  getToday(): SleepEntry | undefined {
    const entry = this.byDate.get(this.todayKey());
    return entry ? cloneEntry(entry) : undefined;
  }

  /** The entry with `id`, or undefined. */
  getEntry(id: string): SleepEntry | undefined {
    const entry = this.findById(id);
    return entry ? cloneEntry(entry) : undefined;
  }

  /** The `n` most recent entries, newest first. `n <= 0` ⇒ []. */
  getRecent(n: number): SleepEntry[] {
    if (!Number.isInteger(n) || n <= 0) return [];
    return this.sortedAscending().reverse().slice(0, n).map(cloneEntry);
  }

  /** All entries, oldest first. */
  getAll(): SleepEntry[] {
    return this.sortedAscending().map(cloneEntry);
  }

  /** Entries within `[from, to]` inclusive, oldest first. Inverted bounds yield []. */
  getRange(from: LocalCalendarDate, to: LocalCalendarDate): SleepEntry[] {
    return this.sortedAscending()
      .filter((entry) => entry.date >= from && entry.date <= to)
      .map(cloneEntry);
  }

  /** The current sleep settings (defensive copy). */
  getSettings(): SleepSettings {
    return { ...this.settingsValue };
  }

  /** The most recent surfaced load anomaly, or null when the last load was clean. */
  get lastAnomaly(): SleepAnomaly | null {
    return this.anomaly;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  /**
   * Create today's entry, or OVERWRITE if today already has one. A same-day
   * re-save is an EDIT, not a second entry: the existing id / date / created_at
   * are preserved (Date Rule 1 minted them once); only the input fields change.
   */
  saveToday(input: SleepEntryInput): SleepEntry {
    this.assertValidInput(input);

    const date = this.todayKey();
    const existing = this.byDate.get(date);
    const id = existing ? existing.id : this.generateId();
    const created_at = existing ? existing.created_at : this.now().toISOString();
    const entry = makeEntry(id, date, created_at, input);

    this.byDate.set(date, entry);
    this.persist();
    return cloneEntry(entry);
  }

  /**
   * Overwrite the identified entry's input fields. NEVER re-dates (Date Rule 2):
   * the entry keeps its stored date and created_at regardless of the edit-time
   * clock. Throws SleepEntryNotFoundError if `id` is unknown.
   */
  editEntry(id: string, input: SleepEntryInput): SleepEntry {
    this.assertValidInput(input);

    const existing = this.findById(id);
    if (!existing) throw new SleepEntryNotFoundError(id);

    const entry = makeEntry(existing.id, existing.date, existing.created_at, input);
    this.byDate.set(existing.date, entry);
    this.persist();
    return cloneEntry(entry);
  }

  /** Merge a partial settings patch and persist. Result is re-sanitized to a valid shape. */
  saveSettings(patch: Partial<SleepSettings>): SleepSettings {
    this.settingsValue = sanitizeSettings({ ...this.settingsValue, ...patch });
    this.persist();
    return { ...this.settingsValue };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private todayKey(): LocalCalendarDate {
    return toLocalCalendarDate(this.now());
  }

  private findById(id: string): SleepEntry | undefined {
    for (const entry of this.byDate.values()) {
      if (entry.id === id) return entry;
    }
    return undefined;
  }

  private sortedAscending(): SleepEntry[] {
    return [...this.byDate.values()].sort(compareByDate);
  }

  private assertValidInput(input: SleepEntryInput): void {
    const time = (label: string, value: string) => {
      if (!HHMM_RE.test(value)) {
        throw new SleepValidationError(`${label} must be HH:MM (00:00–23:59), got "${value}"`);
      }
    };
    time('bedtime', input.bedtime);
    time('lights_out', input.lights_out);
    time('wake_time', input.wake_time);
    time('out_of_bed_time', input.out_of_bed_time);

    const nonNegInt = (label: string, value: number) => {
      if (!Number.isInteger(value) || value < 0) {
        throw new SleepValidationError(`${label} must be a non-negative integer, got ${value}`);
      }
    };
    nonNegInt('sleep_onset_minutes', input.sleep_onset_minutes);
    nonNegInt('night_wakings', input.night_wakings);
    nonNegInt('night_waking_duration_minutes', input.night_waking_duration_minutes);

    const rating = (label: string, value: number) => {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new SleepValidationError(`${label} must be an integer 1..5, got ${value}`);
      }
    };
    rating('sleep_quality', input.sleep_quality);
    rating('morning_mood', input.morning_mood);

    if (typeof input.dream_recall !== 'boolean') {
      throw new SleepValidationError('dream_recall must be a boolean');
    }
    this.assertValidText('dream_notes', input.dream_notes);
    this.assertValidText('notes', input.notes);

    for (const nap of input.naps) {
      if (!HHMM_RE.test(nap.start) || !HHMM_RE.test(nap.end)) {
        throw new SleepValidationError(`nap times must be HH:MM, got "${nap.start}"–"${nap.end}"`);
      }
    }

    const s = input.substances;
    if (
      typeof s.alcohol !== 'boolean' ||
      typeof s.exercise !== 'boolean' ||
      typeof s.medication_sleep_aid !== 'boolean'
    ) {
      throw new SleepValidationError('substances alcohol/exercise/medication_sleep_aid must be booleans');
    }
    if (s.caffeine_last_time !== undefined && !HHMM_RE.test(s.caffeine_last_time)) {
      throw new SleepValidationError('substances.caffeine_last_time must be HH:MM');
    }
    if (s.exercise_time !== undefined && !HHMM_RE.test(s.exercise_time)) {
      throw new SleepValidationError('substances.exercise_time must be HH:MM');
    }
    // Same bounds the loader enforces (migrate.ts isValidSubstances) — a value that
    // passes the write must survive the next launch's load, never quarantine it.
    const nonNegNumber = (label: string, value: number | undefined) => {
      if (value !== undefined && !(typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
        throw new SleepValidationError(
          `${label} must be a non-negative finite number, got ${String(value)}`,
        );
      }
    };
    nonNegNumber('substances.alcohol_units', s.alcohol_units);
    nonNegNumber('substances.screens_before_bed_minutes', s.screens_before_bed_minutes);
  }

  private assertValidText(label: string, value: string | undefined): void {
    if (value !== undefined && value.length > SLEEP_NOTE_MAX) {
      throw new SleepValidationError(
        `${label} exceeds ${SLEEP_NOTE_MAX} characters (got ${value.length})`,
      );
    }
  }

  private snapshot(): PersistedSleep {
    return { version: SCHEMA_VERSION, settings: this.settingsValue, entries: this.sortedAscending() };
  }

  private persist(): void {
    this.storage.set(STORAGE_KEY, serialize(this.snapshot()));
  }

  private hydrate(value: PersistedSleep): void {
    this.byDate.clear();
    for (const entry of value.entries) this.byDate.set(entry.date, entry);
    this.settingsValue = value.settings;
  }

  /** Read → migrate → quarantine-if-anomalous → hydrate → restamp-if-needed. */
  private load(): void {
    const raw = this.storage.get(STORAGE_KEY);
    const outcome = migrate(raw);

    if (outcome.status === 'anomaly') {
      // Preserve the raw blob (never silently lose user data), then continue on the
      // best-effort recovered subset and surface the anomaly. The UUID suffix keeps
      // two same-instant anomalies from clobbering each other on a blind put.
      const detectedAtIso = this.now().toISOString();
      const quarantineKey = `${QUARANTINE_KEY_PREFIX}${detectedAtIso}-${this.generateId()}`;
      this.storage.set(quarantineKey, outcome.raw);
      this.hydrate(outcome.value);
      this.anomaly = {
        reason: outcome.reason,
        quarantineKey,
        recoveredEntryCount: outcome.value.entries.length,
        detectedAtIso,
      };
      // Reset the primary key to the clean recovered shape so the next launch reads
      // a valid envelope and does not re-quarantine the same blob.
      this.persist();
      return;
    }

    this.hydrate(outcome.value);
    const canonical = serialize(outcome.value);
    if (raw !== canonical) this.storage.set(STORAGE_KEY, canonical);
  }
}

/** Build a canonical entry from minted identity + an input payload. */
function makeEntry(
  id: string,
  date: LocalCalendarDate,
  created_at: string,
  input: SleepEntryInput,
): SleepEntry {
  return {
    id,
    date,
    created_at,
    bedtime: input.bedtime,
    lights_out: input.lights_out,
    sleep_onset_minutes: input.sleep_onset_minutes,
    wake_time: input.wake_time,
    out_of_bed_time: input.out_of_bed_time,
    night_wakings: input.night_wakings,
    night_waking_duration_minutes: input.night_waking_duration_minutes,
    sleep_quality: input.sleep_quality,
    morning_mood: input.morning_mood,
    dream_recall: input.dream_recall,
    naps: input.naps.map((n) => ({ start: n.start, end: n.end })),
    substances: { ...input.substances },
    ...(input.dream_notes !== undefined ? { dream_notes: input.dream_notes } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}
