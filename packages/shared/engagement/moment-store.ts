// MomentStore — the local-first source of truth for the Moments engine. The capture
// flow, history, reflection, compass, insights, and the therapist export all read
// through this (the day-based surfaces via `dayRollup`).
//
// LOCAL-FIRST. Writes to the injected Storage seam immediately. The mobile
// SyncingMomentStore wraps this with a background, consent-gated push (on append)
// and pull/restore (`ingestRemote`) — but this class never does I/O beyond Storage.
//
// Moments are EVENT-BASED and APPEND-ONLY: many per day, no edit path in V1. `id`
// and `timestamp` are minted at capture and immutable. The id is client-minted so
// the cloud push upserts on the primary key (re-push updates, never duplicates).

import {
  compareByTimestamp,
  type AnomalyReason,
  migrate,
  normalizeMoments,
  QUARANTINE_KEY_PREFIX,
  type PersistedMoments,
  SCHEMA_VERSION,
  serialize,
  STORAGE_KEY,
} from './migrate';
import { timestampToLocalCalendarDate } from './dates';
import {
  type DayRollup,
  type EngagementStore,
  type LocalCalendarDate,
  MAX_LABELS,
  MAX_STORED_MOMENTS,
  type Moment,
  type MomentDraft,
  type MomentSource,
  type MomentStoreDeps,
  type MomentValence,
  MomentValidationError,
  NOTE_MAX_LENGTH,
  type Storage,
} from './types';

/**
 * A surfaced load anomaly. The raw blob is preserved verbatim at `quarantineKey`;
 * the store continued on a best-effort recovered subset of `recoveredMomentCount`
 * moments. Surfaced (not swallowed) so a later recovery UI / telemetry can act —
 * nothing the user wrote is lost.
 */
export interface MomentAnomaly {
  readonly reason: AnomalyReason;
  readonly quarantineKey: string;
  readonly recoveredMomentCount: number;
  readonly detectedAtIso: string;
}

function cloneMoment(moment: Moment): Moment {
  return {
    ...moment,
    labels: [...moment.labels],
    context: [...moment.context],
  };
}

/**
 * Merge remote moments into a local set. Last-write-wins by id; since moments are
 * append-only (no edits), a shared id means the local and remote copies are the
 * same capture — local wins the tie (it is the source of truth). Remote-only ids
 * are adopted (this is what restores history after a reinstall). Pure: used by the
 * store's `ingestRemote` and unit-testable in isolation.
 */
export function mergeMoments(local: readonly Moment[], remote: readonly Moment[]): Moment[] {
  const byId = new Map<string, Moment>();
  for (const m of remote) byId.set(m.id, cloneMoment(m));
  for (const m of local) byId.set(m.id, cloneMoment(m)); // local overlays remote on tie
  return [...byId.values()].sort(compareByTimestamp);
}

export class MomentStore implements EngagementStore {
  private readonly storage: Storage;
  private readonly now: () => Date;
  private readonly generateId: () => string;

  private readonly byId = new Map<string, Moment>();
  private anomaly: MomentAnomaly | null = null;

  constructor(deps: MomentStoreDeps) {
    this.storage = deps.storage;
    this.now = deps.now;
    this.generateId = deps.generateId;
    this.load();
  }

  // ── reads ────────────────────────────────────────────────────────────────

  /** All moments, oldest first. */
  getAll(): Moment[] {
    return this.sortedAscending().map(cloneMoment);
  }

  /** The `n` most recent moments, newest first. `n <= 0` ⇒ []. */
  getRecent(n: number): Moment[] {
    if (!Number.isInteger(n) || n <= 0) return [];
    return this.sortedAscending().reverse().slice(0, n).map(cloneMoment);
  }

  /** Moments whose LOCAL calendar day is within `[from, to]` inclusive, oldest first. */
  getRange(from: LocalCalendarDate, to: LocalCalendarDate): Moment[] {
    return this.sortedAscending()
      .filter((m) => {
        const day = timestampToLocalCalendarDate(m.timestamp);
        return day >= from && day <= to;
      })
      .map(cloneMoment);
  }

  /**
   * Per-day summaries (oldest first), optionally bounded to `[from, to]`. The bridge
   * for the day-based surfaces: groups the event-based stream by local calendar day and
   * carries the day's RANGE — `low`/`high` are the lowest/highest valence that day and
   * `valence` is worst-of-day (== `low`). NEVER the latest tap, NEVER a mean: a rough
   * moment can never be hidden behind a later calm one.
   */
  dayRollup(from?: LocalCalendarDate, to?: LocalCalendarDate): DayRollup[] {
    const byDay = new Map<LocalCalendarDate, Moment[]>();
    for (const m of this.sortedAscending()) {
      const day = timestampToLocalCalendarDate(m.timestamp);
      if (from !== undefined && day < from) continue;
      if (to !== undefined && day > to) continue;
      const bucket = byDay.get(day);
      if (bucket) bucket.push(m);
      else byDay.set(day, [m]);
    }

    const rollups: DayRollup[] = [];
    for (const [date, moments] of byDay) {
      const first = moments[0] as Moment;
      let low: MomentValence = first.valence;
      let high: MomentValence = first.valence;
      const labels = new Set<string>();
      const context = new Set<string>();
      let hasNote = false;
      for (const m of moments) {
        if (m.valence < low) low = m.valence;
        if (m.valence > high) high = m.valence;
        for (const l of m.labels) labels.add(l);
        for (const c of m.context) context.add(c);
        if (m.note !== undefined && m.note.length > 0) hasNote = true;
      }
      rollups.push({
        date,
        valence: low, // worst-of-day scalar
        low,
        high,
        momentCount: moments.length,
        hasNote,
        labels: [...labels],
        context: [...context],
      });
    }
    return rollups.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  /** The most recent surfaced load anomaly, or null when the last load was clean. */
  get lastAnomaly(): MomentAnomaly | null {
    return this.anomaly;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  /**
   * Capture a moment. Mints `id` + `timestamp`, validates, persists, and returns the
   * full Moment. Append-only — a fresh id every call (never overwrites). Throws
   * MomentValidationError on an invalid draft (fail loud, never clamp).
   */
  append(draft: MomentDraft): Moment {
    const labels = draft.labels ?? [];
    const context = draft.context ?? [];
    this.assertValidValence(draft.valence);
    this.assertValidLabels(labels);
    this.assertValidNote(draft.note);

    const moment = makeMoment(
      this.generateId(),
      this.now().toISOString(),
      draft.valence,
      labels,
      context,
      draft.note,
      draft.routedToSupport ?? false,
      draft.source ?? 'today',
    );
    this.byId.set(moment.id, moment);
    this.persist();
    return cloneMoment(moment);
  }

  /**
   * Merge remote moments into the local cache (last-write-wins) and persist. This is
   * the pull/restore half of sync: on a fresh install the local cache is empty and
   * this repopulates it from the user's account (history survives reinstall).
   *
   * Remote rows are validated at this boundary (via the loader's `normalizeMoments`):
   * invalid rows are DROPPED, valid ones kept, and the call never throws — one
   * malformed server row must not poison the blob and quarantine the whole store on
   * the next launch.
   */
  ingestRemote(remote: readonly Moment[]): void {
    const { moments: validRemote } = normalizeMoments(remote);
    const merged = mergeMoments([...this.byId.values()], validRemote);
    const before = this.byId.size;
    this.byId.clear();
    for (const m of merged) this.byId.set(m.id, m);
    // Persist only when the merge actually changed the set (avoids a redundant write
    // when a pull returns nothing new).
    if (this.byId.size !== before || remote.length > 0) this.persist();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private sortedAscending(): Moment[] {
    return [...this.byId.values()].sort(compareByTimestamp);
  }

  private assertValidValence(valence: number): void {
    if (!Number.isInteger(valence) || valence < 1 || valence > 5) {
      throw new MomentValidationError(`valence must be an integer 1..5, got ${String(valence)}`);
    }
  }

  private assertValidLabels(labels: readonly string[]): void {
    if (labels.length > MAX_LABELS) {
      throw new MomentValidationError(`at most ${MAX_LABELS} labels (got ${labels.length})`);
    }
  }

  private assertValidNote(note: string | undefined): void {
    if (note !== undefined && note.length > NOTE_MAX_LENGTH) {
      throw new MomentValidationError(
        `note exceeds ${NOTE_MAX_LENGTH} characters (got ${note.length})`,
      );
    }
  }

  private snapshot(): PersistedMoments {
    return { version: SCHEMA_VERSION, moments: this.sortedAscending() };
  }

  private persist(): void {
    this.enforceCap();
    this.storage.set(STORAGE_KEY, serialize(this.snapshot()));
  }

  /** Growth cap: keep the most recent MAX_STORED_MOMENTS moments, drop the oldest. */
  private enforceCap(): void {
    if (this.byId.size <= MAX_STORED_MOMENTS) return;
    const excess = this.sortedAscending().slice(0, this.byId.size - MAX_STORED_MOMENTS);
    for (const m of excess) this.byId.delete(m.id);
  }

  private hydrate(value: PersistedMoments): void {
    this.byId.clear();
    for (const m of value.moments) this.byId.set(m.id, m);
  }

  /** Read → migrate → quarantine-if-anomalous → hydrate → restamp-if-needed. */
  private load(): void {
    const raw = this.storage.get(STORAGE_KEY);
    const outcome = migrate(raw);

    if (outcome.status === 'anomaly') {
      // Preserve the raw blob (never silently lose user data), then continue on the
      // best-effort recovered subset and surface the anomaly. The key carries a
      // unique suffix from generateId() so two anomalies at the same instant cannot
      // clobber each other (a blind storage.set would otherwise lose the first blob).
      const detectedAtIso = this.now().toISOString();
      const quarantineKey = `${QUARANTINE_KEY_PREFIX}${detectedAtIso}-${this.generateId()}`;
      this.storage.set(quarantineKey, outcome.raw);
      this.hydrate(outcome.value);
      this.anomaly = {
        reason: outcome.reason,
        quarantineKey,
        recoveredMomentCount: outcome.value.moments.length,
        detectedAtIso,
      };
      this.persist();
      return;
    }

    this.hydrate(outcome.value);
    const canonical = serialize(outcome.value);
    if (raw !== canonical) this.storage.set(STORAGE_KEY, canonical);
  }
}

/**
 * Build a canonical moment; omit `note` when absent (overwrite-not-merge semantics).
 * Key order MUST match `canonicalMoment` in migrate.ts so a fresh write reloads
 * without a redundant restamp. A fresh capture never carries `legacyValence10`.
 */
function makeMoment(
  id: string,
  timestamp: string,
  valence: MomentValence,
  labels: readonly string[],
  context: readonly string[],
  note: string | undefined,
  routedToSupport: boolean,
  source: MomentSource,
): Moment {
  const base = {
    id,
    timestamp,
    valence,
    labels: [...labels],
    context: [...context],
    routedToSupport,
    source,
  };
  return note === undefined ? base : { ...base, note };
}
