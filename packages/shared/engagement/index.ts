// ============================================================================
// Moments engine — Public API (@psychage/shared/engagement)
// ============================================================================
//
// The typed, local-first boundary for the Moments feature (the evolved daily
// check-in). The capture flow, history, and the day-based surfaces (reflection,
// terrain, compass, insights, therapist export) consume the store through this
// barrel; deep imports into sibling modules are not part of the public surface.
//
// LOCAL-FIRST by construction: the store writes to the injected Storage seam.
// Sync (push on append + pull/restore via ingestRemote) is a background, consent-
// gated backup the mobile layer wraps around this — gated behind ADR-001 / SR-4.
// Storage/Clock/IdFactory are injected so the package stays dependency-free and the
// logic stays device-free testable.

// Store + adapter interface
export { MomentStore, type MomentAnomaly, mergeMoments } from './moment-store';

// Domain contract + injected seams + errors
export {
  type Moment,
  type MomentDraft,
  type MomentSource,
  type MomentValence,
  type DayRollup,
  type EngagementStore,
  type MomentStoreDeps,
  type Clock,
  type IdFactory,
  type LocalCalendarDate,
  type Storage,
  MAX_LABELS,
  MAX_STORED_MOMENTS,
  NOTE_MAX_LENGTH,
  MomentValidationError,
} from './types';

// Local-calendar-date construction (consumers build day-rollup range bounds with these)
export {
  asLocalCalendarDate,
  isLocalCalendarDate,
  toLocalCalendarDate,
  timestampToLocalCalendarDate,
} from './dates';

// Schema surface (observability — the migrator itself is internal to the store).
// STORAGE_KEY is deliberately NOT exported: a consumer holding it plus a Storage
// instance could write past the store's validation. The store owns its key.
export { type AnomalyReason, SCHEMA_VERSION } from './migrate';

// Cumulative milestones — pure threshold model (the reward side of the habit loop).
export {
  MILESTONE_THRESHOLDS,
  type MilestoneThreshold,
  SILENT_MILESTONE,
  reachedAt,
  detectNewMilestones,
  isCelebratedMilestone,
} from './milestones';
