// One call to make every live in-memory holder of user data reflect a freshly
// wiped disk (S48 delete / privacy "clear on-device data"). wipeLocalData() only
// clears the storage seam; without this, cached singletons keep serving deleted
// data for the rest of the session and their next save() re-persists the whole
// stale snapshot — silently resurrecting what the user asked to erase (PR-013).
//
// Two families:
//   1. Record-store singletons (reset = drop instance; next getXxxStore()
//      re-constructs and re-load()s from the now-empty disk).
//   2. Reactive persistence caches (reload = null the cache + notify
//      subscribers, so mounted UI re-renders from the empty disk immediately).
//
// Keep in sync when a new live store or reactive cache lands — the wipe test
// (__tests__/wipe-registry-coverage.test.ts) documents the expected set.

import { reloadBookmarksFromDisk } from '@/features/bookmarks/store';
import { reloadChatConsentFromDisk } from '@/features/mindmate/persistence/chat-consent';
import { resetClarityJournalStore } from '@/lib/clarity-journal-store';
import { resetClarityStore } from '@/lib/clarity-store';
import { resetMomentStore } from '@/lib/moment-store';
import { resetNavigatorStore } from '@/lib/navigator-store';
import { reloadAppearanceFromDisk } from '@/lib/persistence/appearance';
import { reloadDirectoryLocationFromDisk } from '@/lib/persistence/directory-location';
import { reloadMyProvidersFromDisk } from '@/lib/persistence/my-providers';
import { reloadReadingTextSizeFromDisk } from '@/lib/persistence/reading-text-size';
import { reloadRecentlyViewedFromDisk } from '@/lib/persistence/recently-viewed';
import { reloadSyncConsentFromDisk } from '@/lib/persistence/sync-consent';
import { resetRelationshipStore } from '@/lib/relationship-store';
import { resetSleepStore } from '@/lib/sleep-store';

export function resetLiveState(): void {
  // Record-store singletons.
  resetMomentStore();
  resetSleepStore();
  resetClarityStore();
  resetNavigatorStore();
  resetRelationshipStore();
  resetClarityJournalStore();
  // Reactive persistence caches.
  reloadBookmarksFromDisk();
  reloadChatConsentFromDisk();
  reloadAppearanceFromDisk();
  reloadDirectoryLocationFromDisk();
  reloadMyProvidersFromDisk();
  reloadReadingTextSizeFromDisk();
  reloadRecentlyViewedFromDisk();
  reloadSyncConsentFromDisk();
}
