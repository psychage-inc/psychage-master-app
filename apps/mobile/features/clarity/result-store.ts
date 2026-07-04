// ClarityResultStore — the local-only history of completed Clarity snapshots.
//
// LOCAL-ONLY (SR-4). Writes to the injected Storage seam and nowhere else: no
// Supabase, no network, no sync, no analytics, no Sentry. Assessment tool results stay
// on the device, full stop.
//
// WHAT IS PERSISTED: composite (0–100), tier, the five domain scores, a device-local
// calendar date, and an id. The raw item-level `answers` are NEVER persisted.
//
// SCHEMA v2 (web-parity override): tier vocabulary is now the web's
// (thriving/balanced/struggling/distressed/crisis) and domain keys are the web's
// (emotional/vitality/social/cognitive/functioning). A forward-only v1→v2 migrator
// upgrades pre-override snapshots in place (SR-13): old tiers map mixed→struggling,
// strained→distressed, reachOut→crisis; old domain keys map wellbeing→vitality,
// stress→cognitive. Anything unrecognizable is quarantined verbatim, never lost.

import type { Storage } from '@/lib/adapters/storage';

import type { ClarityDomainScores, ClarityResult, ScoreTier } from './types';

type ClarityTierLocal = ScoreTier;

export const CLARITY_STORAGE_KEY = 'mobile:clarity-results';
export const CLARITY_QUARANTINE_PREFIX = `${CLARITY_STORAGE_KEY}:quarantine:`;
export const CLARITY_SCHEMA_VERSION = 2 as const;
/** Keep at most this many snapshots locally (newest retained). */
export const CLARITY_HISTORY_CAP = 100;

const TIERS: ReadonlySet<string> = new Set<ClarityTierLocal>([
  'thriving',
  'balanced',
  'struggling',
  'distressed',
  'crisis',
]);
const DOMAIN_KEYS = ['emotional', 'vitality', 'social', 'cognitive', 'functioning'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── v1 (pre-override) vocab, for the migrator only ───────────────────────────────
const V1_TIERS = ['thriving', 'balanced', 'mixed', 'strained', 'reachOut'] as const;
type V1Tier = (typeof V1_TIERS)[number];
const V1_DOMAIN_KEYS = ['emotional', 'wellbeing', 'social', 'stress', 'functioning'] as const;
const V1_TIER_MAP: Record<V1Tier, ClarityTierLocal> = {
  thriving: 'thriving',
  balanced: 'balanced',
  mixed: 'struggling',
  strained: 'distressed',
  reachOut: 'crisis',
};

/** One persisted assessment result. `id` + `date` are minted at save and immutable. */
export interface ClaritySnapshot {
  readonly id: string;
  /** Device-local calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  readonly composite: number;
  readonly tier: ScoreTier;
  readonly domains: ClarityDomainScores;
}

interface PersistedClarity {
  readonly version: number;
  readonly entries: ClaritySnapshot[];
}

export interface ClarityStoreDeps {
  readonly storage: Storage;
  readonly now: () => Date;
  readonly generateId: () => string;
}

/** Local-calendar day (`YYYY-MM-DD`) from a Date, using LOCAL accessors (not UTC). */
function toLocalDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isDomainScores(value: unknown): value is ClarityDomainScores {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return DOMAIN_KEYS.every((k) => typeof v[k] === 'number' && Number.isFinite(v[k] as number));
}

function isSnapshot(value: unknown): value is ClaritySnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.date === 'string' &&
    DATE_RE.test(v.date) &&
    typeof v.composite === 'number' &&
    Number.isFinite(v.composite) &&
    typeof v.tier === 'string' &&
    TIERS.has(v.tier) &&
    isDomainScores(v.domains)
  );
}

/** Strip unknown keys from a validated snapshot (defends against hand-edited blobs). */
function canonical(s: ClaritySnapshot): ClaritySnapshot {
  return {
    id: s.id,
    date: s.date,
    composite: s.composite,
    tier: s.tier,
    domains: {
      emotional: s.domains.emotional,
      vitality: s.domains.vitality,
      social: s.domains.social,
      cognitive: s.domains.cognitive,
      functioning: s.domains.functioning,
    },
  };
}

/** Migrate one v1 entry (old tier vocab + old domain keys) to a v2 snapshot, or null. */
function migrateV1Entry(value: unknown): ClaritySnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return null;
  if (typeof v.date !== 'string' || !DATE_RE.test(v.date)) return null;
  if (typeof v.composite !== 'number' || !Number.isFinite(v.composite)) return null;
  if (typeof v.tier !== 'string' || !(V1_TIERS as readonly string[]).includes(v.tier)) return null;

  const d = v.domains;
  if (typeof d !== 'object' || d === null) return null;
  const dv = d as Record<string, unknown>;
  if (!V1_DOMAIN_KEYS.every((k) => typeof dv[k] === 'number' && Number.isFinite(dv[k] as number))) {
    return null;
  }

  return {
    id: v.id,
    date: v.date,
    composite: v.composite,
    tier: V1_TIER_MAP[v.tier as V1Tier],
    domains: {
      emotional: dv.emotional as number,
      vitality: dv.wellbeing as number, // renamed
      social: dv.social as number,
      cognitive: dv.stress as number, // renamed
      functioning: dv.functioning as number,
    },
  };
}

type LoadOutcome =
  | { status: 'clean'; entries: ClaritySnapshot[]; migrated: boolean }
  | { status: 'anomaly'; entries: ClaritySnapshot[]; raw: string };

/** Parse + validate the persisted blob. v2 is current; v1 is migrated forward. */
function loadBlob(raw: string | null): LoadOutcome {
  if (raw === null) return { status: 'clean', entries: [], migrated: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'anomaly', entries: [], raw };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { status: 'anomaly', entries: [], raw };
  }

  const env = parsed as { version?: unknown; entries?: unknown };

  // v1 → v2 forward migration.
  if (env.version === 1) {
    if (!Array.isArray(env.entries)) return { status: 'anomaly', entries: [], raw };
    const entries: ClaritySnapshot[] = [];
    let dropped = false;
    for (const candidate of env.entries) {
      const migrated = migrateV1Entry(candidate);
      if (migrated) entries.push(migrated);
      else dropped = true;
    }
    // A clean migration re-persists as v2; a partial one also quarantines the raw v1 blob.
    return dropped
      ? { status: 'anomaly', entries, raw }
      : { status: 'clean', entries, migrated: true };
  }

  if (env.version !== CLARITY_SCHEMA_VERSION) {
    // Missing / older-unknown / newer version: no migration path — preserve, recover none.
    return { status: 'anomaly', entries: [], raw };
  }
  if (!Array.isArray(env.entries)) {
    return { status: 'anomaly', entries: [], raw };
  }

  const entries: ClaritySnapshot[] = [];
  let dropped = false;
  for (const candidate of env.entries) {
    if (isSnapshot(candidate)) entries.push(canonical(candidate));
    else dropped = true;
  }
  return dropped
    ? { status: 'anomaly', entries, raw }
    : { status: 'clean', entries, migrated: false };
}

export class ClarityResultStore {
  private readonly storage: Storage;
  private readonly now: () => Date;
  private readonly generateId: () => string;
  private entries: ClaritySnapshot[] = []; // oldest → newest

  constructor(deps: ClarityStoreDeps) {
    this.storage = deps.storage;
    this.now = deps.now;
    this.generateId = deps.generateId;
    this.load();
  }

  /** Persist a completed result as a new snapshot; returns the stored snapshot. */
  save(result: ClarityResult): ClaritySnapshot {
    const snapshot: ClaritySnapshot = {
      id: this.generateId(),
      date: toLocalDate(this.now()),
      composite: result.totalScore,
      tier: result.tier,
      domains: result.domainScores,
    };
    this.entries.push(snapshot);
    if (this.entries.length > CLARITY_HISTORY_CAP) {
      this.entries = this.entries.slice(-CLARITY_HISTORY_CAP);
    }
    this.persist();
    return { ...snapshot };
  }

  /**
   * Replace the MOST RECENT snapshot with a re-scored result from the same
   * sitting (BACK from results → re-answer → results again). Keeps the
   * one-row-per-run invariant while making the persisted record match what
   * the user is looking at (second-pass review of PR-024). Falls back to a
   * plain save when the store is empty.
   */
  replaceLatest(result: ClarityResult): ClaritySnapshot {
    if (this.entries.length === 0) return this.save(result);
    const prev = this.entries[this.entries.length - 1] as ClaritySnapshot;
    const snapshot: ClaritySnapshot = {
      id: prev.id,
      date: toLocalDate(this.now()),
      composite: result.totalScore,
      tier: result.tier,
      domains: result.domainScores,
    };
    this.entries[this.entries.length - 1] = snapshot;
    this.persist();
    return { ...snapshot };
  }

  /** The `n` most recent snapshots, newest first. `n <= 0` ⇒ []. */
  getRecent(n: number): ClaritySnapshot[] {
    if (!Number.isInteger(n) || n <= 0) return [];
    return this.entries.slice(-n).reverse().map((s) => ({ ...s }));
  }

  /** Total stored snapshots. */
  get count(): number {
    return this.entries.length;
  }

  private persist(): void {
    const payload: PersistedClarity = { version: CLARITY_SCHEMA_VERSION, entries: this.entries };
    this.storage.set(CLARITY_STORAGE_KEY, JSON.stringify(payload));
  }

  private load(): void {
    const raw = this.storage.get(CLARITY_STORAGE_KEY);
    const outcome = loadBlob(raw);
    this.entries = outcome.entries;

    if (outcome.status === 'anomaly') {
      // Preserve the raw blob (never silently lose user data) under a unique key,
      // then rewrite the primary key to the recovered subset so the next launch is clean.
      const stamp = `${this.now().toISOString()}-${this.generateId()}`;
      this.storage.set(`${CLARITY_QUARANTINE_PREFIX}${stamp}`, outcome.raw);
      this.persist();
    } else if (outcome.migrated) {
      // Clean v1→v2 upgrade: rewrite the primary key as a v2 envelope.
      this.persist();
    }
  }
}
