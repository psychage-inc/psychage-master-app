import type { Storage } from '@/lib/adapters/storage';

import { isQuarantineKey, KNOWN_LOCAL_KEYS } from './known-keys';

// S48 local delete — HARD-IMMEDIATE, no recovery window. Erases every key the app
// owns through the storage seam. Pure + synchronous + Vitest-testable.
//
// THE LOCAL/REMOTE BOUNDARY (explicit):
//   - LOCAL (this function) is real and complete: the static KNOWN_LOCAL_KEYS plus
//     the dynamic `…:quarantine:*` residue (reached via getAllKeys enumeration).
//     The caller (delete-confirm.tsx / privacy.tsx) then calls resetLiveState() so
//     every live store instance and reactive cache reflects the now-empty disk.
//   - REMOTE/account cascade is the SYNC layer — see
//     lib/persistence/account-deletion.ts (delete_account() RPC).
export function wipeLocalData(storage: Storage): void {
  for (const key of KNOWN_LOCAL_KEYS) {
    storage.remove(key);
  }
  // Reach the dynamically-suffixed `…:quarantine:<iso>-<uuid>` residue — keys with
  // no static KNOWN_LOCAL_KEYS entry (see known-keys.ts QUARANTINE_KEY_PREFIX). The
  // matcher also catches fixed-name `…:quarantine` keys (no trailing colon), which
  // the previous `includes(':quarantine:')` check missed (PR-007). Both production
  // adapters expose getAllKeys; a double without it simply skips the sweep.
  for (const key of storage.getAllKeys?.() ?? []) {
    if (isQuarantineKey(key)) {
      storage.remove(key);
    }
  }
}
