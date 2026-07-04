import { router } from 'expo-router';
import { useRef } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { DestructivePair } from '@/components/settings/DestructivePair';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { CT4_SETTINGS } from '@/features/settings/copy';
import { storage } from '@/lib/adapters/storage';
import { deleteExportedRecordFiles } from '@/lib/export/share-record';
import { clearAuthSessionLocal, requestRemoteAccountDeletion } from '@/lib/persistence/account-deletion';
import { resetLiveState } from '@/lib/persistence/reset-live-state';
import { wipeLocalData } from '@/lib/persistence/wipe-local-data';

// S48 Delete — confirm. The final confirm. On confirm the LOCAL/REMOTE boundary
// is explicit and ordered:
//   1. requestRemoteAccountDeletion() — server-side cascade FIRST, while the
//      secure-store session is still live (delete_account() RPC erases the synced
//      check_ins + personal-data tables + the auth.users row). Awaited, NOT
//      fire-and-forget: we branch on the result so a failure is surfaced.
//   2. wipeLocalData(storage) — HARD-IMMEDIATE local erase of all known keys + the
//      `:quarantine:*` residue; deleteExportedRecordFiles() removes any exported
//      record file from the cache dir (the MMKV wipe never touches the filesystem).
//   3. resetLiveState()      — drop EVERY live store singleton + reactive cache so
//      reads reflect the empty disk and no stale snapshot can re-persist (PR-013).
//   4. on success: clearAuthSessionLocal() + replace the route (no back-button into
//      a deleted state). On failure: surface that server data may remain — deletion
//      must never SILENTLY half-complete (rules/auth.md §7). No undo, no soft-delete.
export default function DeleteConfirmScreen() {
  const t = CT4_SETTINGS.deleteConfirm;
  // Re-entrancy guard: the confirm handler awaits a network cascade, and the
  // destructive button stays pressable during that window — a rapid second tap
  // must not start a parallel deletion (double RPC, double wipe, double replace).
  // Reset only on the failure branch so the surfaced retry path still works.
  const deleting = useRef(false);

  const onConfirm = async () => {
    if (deleting.current) return;
    deleting.current = true;
    const remote = await requestRemoteAccountDeletion();
    // Local wipe always runs: the on-device record is erased hard-immediate.
    wipeLocalData(storage);
    deleteExportedRecordFiles();
    resetLiveState();
    if (remote.ok) {
      // Account is gone server-side (or there was nothing to delete) — drop the
      // now-dead local session, then leave no route back into a deleted state.
      await clearAuthSessionLocal();
      router.replace('/');
      return;
    }
    // Server cascade FAILED. On-device data is gone, but tell the user their server
    // data may still exist. Keep the session so a later attempt can retry.
    deleting.current = false;
    Alert.alert(t.serverFailTitle, t.serverFailBody, [
      { text: t.serverFailAck, onPress: () => router.replace('/') },
    ]);
  };

  return (
    <ScreenShell edges={['bottom']}>
      <ScrollView contentContainerClassName="gap-5 py-4" showsVerticalScrollIndicator={false}>
        <Text variant="h2" className="px-1">
          {t.heading}
        </Text>
        <Text variant="body" className="px-1 text-text-secondary dark:text-text-secondary-dark">
          {t.body}
        </Text>
        <View className="pt-2">
          <DestructivePair
            destructLabel={t.confirmLabel}
            keepLabel={t.keepLabel}
            onDestruct={onConfirm}
            onKeep={() => router.back()}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
