// Moments engine — domain types + the injected capability seams.
//
// Moments are the EVOLVED daily check-in: momentary, EVENT-BASED affect capture
// (many per day, each with its own instant) replacing the one-per-calendar-day
// check-in. The store sits on the same three injected capabilities the check-in
// store used, so packages/shared stays dependency-free (CLAUDE.md: "No runtime
// dependencies") and the logic stays unit-testable without a device or real clock:
//
//   - Storage    — the key-value seam (mobile injects its MMKV adapter; tests
//                  inject an in-memory Map). Structural mirror of
//                  apps/mobile/lib/adapters/storage — never imported from the app.
//   - Clock      — a `() => Date` source. A moment's `timestamp` is the FULL instant
//                  at capture (not a calendar day): event-based, time matters. The
//                  day-rollup derives the local calendar day from it (dates.ts).
//   - IdFactory  — a UUID minter. The id is CLIENT-MINTED so the cloud push can
//                  upsert on the primary key for idempotency (re-push updates, not
//                  duplicates). Tests inject a deterministic counter.
//
// LOCAL-FIRST. The MMKV store is the source of truth; sync is a background, consent-
// gated backup + restore (ADR-001 / SR-4 carve-out — user-owned data, NOT telemetry).

/**
 * A 5-point affect valence. 1 = lowest, 5 = highest. Stored as 1..5 to match the
 * server `valence` column directly (no local↔server remap, unlike the old check-in
 * 0..4↔mood_score mapping). Labels/colors are a UI concern, not the store's.
 */
export type MomentValence = 1 | 2 | 3 | 4 | 5;

/**
 * A device-local calendar day in `YYYY-MM-DD` form (zero-padded, fixed width so
 * lexical comparison equals chronological comparison). Branded to keep a raw
 * time-bearing ISO string out of a slot that means "the local day". Construct only
 * through dates.ts (`toLocalCalendarDate` / `asLocalCalendarDate`).
 */
export type LocalCalendarDate = string & { readonly __brand: 'LocalCalendarDate' };

/**
 * Where a moment was captured — provenance only, NEVER affect. `today` = the home
 * surface, `compass` = the Compass tool surface (the old Mood Journal entry point,
 * folded in by the unify migration), `prompt` = the "How are you right now?" return
 * prompt. Local-only: the sync mapper does not read it, so it never leaves the device.
 */
export type MomentSource = 'today' | 'compass' | 'prompt';

/** The closed set of valid sources (the load-validation surface). */
export const MOMENT_SOURCES: ReadonlySet<string> = new Set<MomentSource>([
  'today',
  'compass',
  'prompt',
]);

/**
 * One captured Moment. `id` and `timestamp` are minted AT CAPTURE and immutable —
 * moments are append-only (there is no edit path in V1). `routedToSupport` records
 * that the acute-handoff predicate fired before this moment was persisted (a
 * service-quality flag; never crisis content).
 */
export interface Moment {
  readonly id: string;
  /** Full capture instant, ISO-8601 (`new Date().toISOString()`). The UI calls this "createdAt". */
  readonly timestamp: string;
  readonly valence: MomentValence;
  /**
   * The "feeling words" (the UI calls these descriptors). 0..MAX_LABELS on a fresh
   * capture; records folded in from the Mood Journal by the unify migration may carry
   * more (up to STORED_MAX_LABELS), which is why load-validation uses the wider ceiling.
   */
  readonly labels: readonly string[];
  /** The associations / "biggest impact" (the UI calls these impacts). 0..n keys. */
  readonly context: readonly string[];
  /** Optional free text, ≤ NOTE_MAX_LENGTH UTF-16 units. Absent ⇒ no note. */
  readonly note?: string;
  /** True when the acute predicate routed this capture to crisis support. */
  readonly routedToSupport: boolean;
  /**
   * Which surface captured this moment (provenance; never synced). Set on every local
   * capture (`append` defaults it to `today`) and on folded-in Mood Journal entries
   * (`compass`). OPTIONAL because a moment restored from the cloud carries no origin —
   * the server has no `source` column — so the pull mapper leaves it absent. Keeping it
   * optional is what lets the ADR-001 sync mapper stay untouched.
   */
  readonly source?: MomentSource;
  /**
   * MIGRATION-ONLY. The original 1–10 Mood Journal valence, preserved verbatim when a
   * journal entry was folded in (the unified scale is 1–5; this keeps the finer
   * original from being lost). Never shown, never set on a fresh capture, never synced.
   */
  readonly legacyValence10?: number;
}

/** The caller-supplied fields on capture; the store mints `id` + `timestamp`. */
export interface MomentDraft {
  readonly valence: MomentValence;
  readonly labels?: readonly string[];
  readonly context?: readonly string[];
  readonly note?: string;
  readonly routedToSupport?: boolean;
  /** Capture surface. Optional; the store defaults to `today` when omitted. */
  readonly source?: MomentSource;
}

/**
 * A per-day summary derived from many moments — the bridge that lets the day-based
 * surfaces (reflection, terrain, home-model, therapist export) read the event-based
 * Moments store without a redesign. Carries the day's RANGE: `low`/`high` are the
 * lowest/highest valence that day; `valence` is worst-of-day (== `low`) — the single
 * scalar, NEVER the latest tap, NEVER a mean — so a rough moment can never be hidden
 * behind a later calm one.
 */
export interface DayRollup {
  readonly date: LocalCalendarDate;
  /** Worst-of-day valence (== `low`) — the representative scalar. */
  readonly valence: MomentValence;
  /** Lowest valence among the day's moments (worst-of-day). */
  readonly low: MomentValence;
  /** Highest valence among the day's moments (best-of-day). */
  readonly high: MomentValence;
  readonly momentCount: number;
  readonly hasNote: boolean;
  /** Union of all labels captured that day. */
  readonly labels: readonly string[];
  /** Union of all context domains captured that day. */
  readonly context: readonly string[];
}

/** Maximum labels (feeling words) selectable on a FRESH capture — the append/UI cap. */
export const MAX_LABELS = 3;
/**
 * Maximum labels a STORED moment may carry through load-validation. Wider than
 * MAX_LABELS so Mood Journal entries folded in by the unify migration (up to the 12
 * closed emotion tags) survive `isValidMoment` instead of being quarantined. Fresh
 * captures are still capped at MAX_LABELS by `append`.
 */
export const STORED_MAX_LABELS = 12;
/** Maximum note length, in UTF-16 code units (absorbs the Mood Journal's 280-cap notes). */
export const NOTE_MAX_LENGTH = 280;
/**
 * Growth cap on the persisted store: the most recent MAX_STORED_MOMENTS moments are
 * kept on persist; older ones beyond the cap are dropped (oldest first). Generous —
 * this is the primary engagement record (~5 captures/day for over a year) — but
 * bounded, because every append rewrites and re-sorts the whole blob (the navigator
 * caps at 50, clarity at 100).
 */
export const MAX_STORED_MOMENTS = 2000;

/**
 * Key-value persistence seam. Structurally identical to
 * apps/mobile/lib/adapters/storage's `Storage`; redeclared here because
 * packages/shared must not import from an app. Mobile's adapter satisfies it by
 * structural typing; tests pass a Map-backed literal.
 */
export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Injected clock. Production: `() => new Date()`. Tests: a fixed instant. */
export type Clock = () => Date;

/** Injected UUID minter. Production: expo-crypto. Tests: a deterministic counter. */
export type IdFactory = () => string;

/** The three capabilities the store is constructed with. */
export interface MomentStoreDeps {
  readonly storage: Storage;
  readonly now: Clock;
  readonly generateId: IdFactory;
}

/**
 * The adapter the app codes against: a local cache with a background sync behind it.
 * `MomentStore` implements the local half; the mobile `SyncingMomentStore` adds the
 * push (on append) and pull/restore (`ingestRemote`) without changing this surface.
 */
export interface EngagementStore {
  /** Capture a moment. Writes local immediately and returns the minted Moment. */
  append(draft: MomentDraft): Moment;
  /** The `n` most recent moments, newest first. `n <= 0` ⇒ []. */
  getRecent(n: number): Moment[];
  /** Moments whose local calendar day is within `[from, to]` inclusive, oldest first. */
  getRange(from: LocalCalendarDate, to: LocalCalendarDate): Moment[];
  /** All moments, oldest first. */
  getAll(): Moment[];
  /** Per-day summaries (oldest first), optionally bounded to `[from, to]`. */
  dayRollup(from?: LocalCalendarDate, to?: LocalCalendarDate): DayRollup[];
  /** Merge remote moments into the local cache (last-write-wins; restores on reinstall). */
  ingestRemote(remote: readonly Moment[]): void;
}

/**
 * Thrown when a write would violate the moment contract (valence out of 1..5, more
 * than MAX_LABELS labels, note over NOTE_MAX_LENGTH). Writes fail loud rather than
 * silently truncate/clamp — silent mutation of user input is the failure mode
 * user-data code must avoid.
 */
export class MomentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MomentValidationError';
  }
}
