// The registry of every namespaced local storage key the app writes, so a
// "delete my record" (S48) can erase all of it through the {get,set,remove}
// storage seam — which has NO key enumeration.

// The Moments store's storage key. RE-DECLARED here, NOT imported: the shared barrel
// (packages/shared/engagement) deliberately does NOT export STORAGE_KEY, to stop a
// consumer WRITING past the store's validators. We only ever .remove() it (a delete,
// not a write), so that foot-gun does not apply.
export const MOMENTS_STORAGE_KEY = 'mobile:moments';

// Every namespaced key the app owns. Keep in sync when a new persisted key lands.
// Coupling is by string match; a store rename must update both sites. The registry-
// coverage test (__tests__/wipe-registry-coverage.test.ts) fails when a module's
// exported STORAGE_KEY is missing here — add new keys THERE first.
export const KNOWN_LOCAL_KEYS = [
  MOMENTS_STORAGE_KEY, // Moments engine entries (re-declared above)
  'mobile:tier-flags', // A1 lib/persistence/tier-flags
  'mobile:reflection-row-opened', // A1 lib/persistence/reflection-row
  'mobile:haptics-enabled', // A1 haptics (key reserved by the storage adapter)
  'mobile:reminder-settings', // B2 lib/persistence/reminder-settings
  'mobile:appearance', // B2 lib/persistence/appearance
  'mobile:personalization', // B2 lib/persistence/personalization
  'mobile:sync-consent', // settings lib/persistence/sync-consent (moment + check-in consent)
  'mobile:reading-text-size', // settings lib/persistence/reading-text-size
  'mobile:directory-location', // find lib/persistence/directory-location (home browse scope)
  'mobile:recently-viewed-providers', // find lib/persistence/recently-viewed (directory rail)
  'mobile:tour-seen', // first-run cross-tab tour flag (lib/persistence/tour)
  'mobile:onboarding-seen', // first-run onboarding flag (lib/persistence/onboarding)
  'mobile:welcome-seen', // front-door welcome flag (lib/persistence/onboarding)
  'mobile:my-providers', // saved/manual providers incl. names + phones (lib/persistence/my-providers)
  'mobile:milestones', // reached engagement milestones (lib/persistence/milestones)
  'mobile:bookmarks', // saved items, local-first (features/bookmarks/store) — replaces the old DB FK CASCADE
  'mobile:mindmate-consent', // MindMate chat cloud-persist consent (features/mindmate/persistence/chat-consent)
  'mobile:crisis-region', // crisis region override, country code only (features/crisis/region)
  'mobile:crisis-cache', // crisis dataset network cache, public reference data (lib/crisis/store)
  // Local-only assessment/tool result stores (SR-4). Each is also re-declared in its
  // own store module; these literals were previously MISSING here (and two carried
  // WRONG names — 'mobile:relationship-health-results' / 'mobile:sleep-architect-entries'
  // — that no store ever wrote, so "delete my record" left the real keys on disk;
  // PR-007), so "delete my record" left the data on disk — now closed.
  'mobile:clarity-results', // features/clarity/result-store (CLARITY_STORAGE_KEY)
  'mobile:navigator-results', // features/navigator/result-store (NAVIGATOR_STORAGE_KEY)
  'mobile:relationship-health', // features/relationship-health/migrate STORAGE_KEY
  'mobile:clarity-journal', // shared clarity-journal record-store (packages/shared/clarity-journal/migrate)
  'mobile:mood-journal-moments', // shared mood-journal moment-store (retired source, folded into Moments)
  'mobile:sleep-entries', // shared sleep record-store (packages/shared/sleep/migrate STORAGE_KEY)
  // Legacy pre-namespace-convention keys ('psychage:' prefix predates 'mobile:').
  'psychage:reads', // article reading progress + titles (lib/reading-progress-store)
  'psychage:tool_usage', // tool-open timestamps for the dormant nudge (lib/tool-usage-store)
  // Mood-journal → Moments migration bookkeeping (lib/moments-migration). The done
  // flag is safe to wipe: source + destination are wiped in the same pass, so a
  // re-run after deletion is a no-op. The quarantine key holds RAW journal entries
  // and MUST be wiped (its fixed name ends in ':quarantine' with no trailing colon,
  // so the dynamic-suffix sweep below does not reach it).
  'mobile:moments-migration:mood-journal:done',
  'mobile:moments-migration:mood-journal:quarantine',
] as const;

// DELIBERATELY NOT LISTED — survives "delete my record":
//   'mobile:device-id' (lib/device-id): NON-PII stable install identifier for the
//   audit_events trail; per its module doc it exists so audit rows from one install
//   correlate, including across account deletion. Decision logged in AUDIT_LOG PR-039.

// The Moments store quarantines a corrupt blob under a dynamically-suffixed key
// `${MOMENTS_STORAGE_KEY}:quarantine:<iso>-<uuid>`. These have no static entry here,
// so wipeLocalData reaches them by enumerating getAllKeys() and removing any key
// carrying a `:quarantine:` segment or a fixed `:quarantine` suffix.
export const QUARANTINE_KEY_PREFIX = `${MOMENTS_STORAGE_KEY}:quarantine:`;

/** True for any store's quarantine residue key (dynamic suffix or fixed name). */
export function isQuarantineKey(key: string): boolean {
  return key.includes(':quarantine:') || key.endsWith(':quarantine');
}
