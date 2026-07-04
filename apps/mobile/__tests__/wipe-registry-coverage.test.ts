// PR-007 regression guard: the KNOWN_LOCAL_KEYS registry must contain the REAL
// storage key of every persisting module. Two entries had drifted to names no
// store ever wrote ('mobile:relationship-health-results', 'mobile:sleep-architect-
// entries') and ~11 keys were missing entirely, so "delete my record" left user
// data on disk. Each module's key is imported (or deep-imported for shared
// packages whose barrels deliberately don't export it) so a future rename breaks
// THIS test instead of silently breaking deletion.

import { describe, expect, it } from 'vitest';

// Deep imports on purpose: the shared barrels withhold STORAGE_KEY from consumers
// (write-past-validator foot-gun); a delete-only registry test is the sanctioned
// reader. Paths break loudly if the module moves.
import { STORAGE_KEY as CLARITY_JOURNAL_KEY } from '../../../packages/shared/clarity-journal/migrate';
import { STORAGE_KEY as ENGAGEMENT_MOMENTS_KEY } from '../../../packages/shared/engagement/migrate';
import { STORAGE_KEY as SLEEP_ENTRIES_KEY } from '../../../packages/shared/sleep/migrate';
import { STORAGE_KEY as BOOKMARKS_KEY } from '@/features/bookmarks/store';
import { CLARITY_STORAGE_KEY } from '@/features/clarity/result-store';
import { STORAGE_KEY as CRISIS_REGION_KEY } from '@/features/crisis/region';
import { STORAGE_KEY as CHAT_CONSENT_KEY } from '@/features/mindmate/persistence/chat-consent';
import { NAVIGATOR_STORAGE_KEY } from '@/features/navigator/result-store';
import { STORAGE_KEY as RELATIONSHIP_KEY } from '@/features/relationship-health/migrate';
import { isQuarantineKey, KNOWN_LOCAL_KEYS, MOMENTS_STORAGE_KEY } from '@/lib/persistence/known-keys';
import { STORAGE_KEY as APPEARANCE_KEY } from '@/lib/persistence/appearance';
import { STORAGE_KEY as DIRECTORY_LOCATION_KEY } from '@/lib/persistence/directory-location';
import { STORAGE_KEY as MILESTONES_KEY } from '@/lib/persistence/milestones';
import { STORAGE_KEY as MY_PROVIDERS_KEY } from '@/lib/persistence/my-providers';
import { STORAGE_KEY as ONBOARDING_KEY, WELCOME_STORAGE_KEY } from '@/lib/persistence/onboarding';
import { STORAGE_KEY as PERSONALIZATION_KEY } from '@/lib/persistence/personalization';
import { STORAGE_KEY as READING_TEXT_SIZE_KEY } from '@/lib/persistence/reading-text-size';
import { STORAGE_KEY as RECENTLY_VIEWED_KEY } from '@/lib/persistence/recently-viewed';
import { STORAGE_KEY as REFLECTION_ROW_KEY } from '@/lib/persistence/reflection-row';
import { STORAGE_KEY as REMINDER_KEY } from '@/lib/persistence/reminder-settings';
import { STORAGE_KEY as SYNC_CONSENT_KEY } from '@/lib/persistence/sync-consent';
import { STORAGE_KEY as TIER_FLAGS_KEY } from '@/lib/persistence/tier-flags';
import { TOUR_STORAGE_KEY } from '@/lib/persistence/tour';

const registry: readonly string[] = KNOWN_LOCAL_KEYS;

describe('KNOWN_LOCAL_KEYS covers every persisting module (PR-007)', () => {
  const importedKeys: Record<string, string> = {
    moments: ENGAGEMENT_MOMENTS_KEY,
    'tier-flags': TIER_FLAGS_KEY,
    'reflection-row': REFLECTION_ROW_KEY,
    'reminder-settings': REMINDER_KEY,
    appearance: APPEARANCE_KEY,
    personalization: PERSONALIZATION_KEY,
    'sync-consent': SYNC_CONSENT_KEY,
    'reading-text-size': READING_TEXT_SIZE_KEY,
    'directory-location': DIRECTORY_LOCATION_KEY,
    'recently-viewed': RECENTLY_VIEWED_KEY,
    tour: TOUR_STORAGE_KEY,
    onboarding: ONBOARDING_KEY,
    welcome: WELCOME_STORAGE_KEY,
    'my-providers': MY_PROVIDERS_KEY,
    milestones: MILESTONES_KEY,
    bookmarks: BOOKMARKS_KEY,
    'chat-consent': CHAT_CONSENT_KEY,
    'crisis-region': CRISIS_REGION_KEY,
    'clarity-results': CLARITY_STORAGE_KEY,
    'navigator-results': NAVIGATOR_STORAGE_KEY,
    'relationship-health': RELATIONSHIP_KEY,
    'clarity-journal': CLARITY_JOURNAL_KEY,
    'sleep-entries': SLEEP_ENTRIES_KEY,
  };

  it.each(Object.entries(importedKeys))('registry contains the %s key', (_name, key) => {
    expect(registry).toContain(key);
  });

  it('moments key re-declaration matches the shared store', () => {
    expect(MOMENTS_STORAGE_KEY).toBe(ENGAGEMENT_MOMENTS_KEY);
  });

  // These modules keep their keys module-private, so the literals are pinned here.
  // If one of these fails, the module's key changed — update BOTH the registry and
  // this pin in the same commit.
  it('registry contains the private-key literals', () => {
    for (const key of [
      'mobile:crisis-cache', // lib/crisis/store CACHE_KEY
      'psychage:reads', // lib/reading-progress-store
      'psychage:tool_usage', // lib/tool-usage-store
      'mobile:moments-migration:mood-journal:done', // lib/moments-migration
      'mobile:moments-migration:mood-journal:quarantine', // lib/moments-migration (raw journal blob)
    ]) {
      expect(registry).toContain(key);
    }
  });

  it('device-id is deliberately NOT wiped (documented decision, PR-039)', () => {
    expect(registry).not.toContain('mobile:device-id');
  });

  it('quarantine matcher catches both dynamic-suffix and fixed-name keys (PR-007c)', () => {
    expect(isQuarantineKey('mobile:moments:quarantine:2026-01-01T00:00:00.000Z-abc')).toBe(true);
    expect(isQuarantineKey('mobile:moments-migration:mood-journal:quarantine')).toBe(true);
    expect(isQuarantineKey('mobile:moments')).toBe(false);
    expect(isQuarantineKey('mobile:quarantine-notes')).toBe(false);
  });
});
