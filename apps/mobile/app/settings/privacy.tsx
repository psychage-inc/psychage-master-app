import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsToggleRow } from '@/components/settings/SettingsToggleRow';
import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { CT4_SETTINGS } from '@/features/settings/copy';
import { dailyRollupReader } from '@/lib/daily-rollup';
import { getMomentStore } from '@/lib/moment-store';
import { storage } from '@/lib/adapters/storage';
import { readAllEntries, toCSV, toJSON } from '@/lib/export/record-export';
import { deleteExportedRecordFiles, type ExportFormat, shareRecordFile } from '@/lib/export/share-record';
import { setReadingTextSize } from '@/lib/persistence/reading-text-size';
import { resetLiveState } from '@/lib/persistence/reset-live-state';
import { setMomentSyncConsent } from '@/lib/persistence/sync-consent';
import { wipeLocalData } from '@/lib/persistence/wipe-local-data';
import { useSyncConsent } from '@/lib/use-sync-consent';

// S46 Privacy & your data. A plain trust statement, the CHECK-IN CLOUD-BACKUP
// CONSENT toggle (SR-4 / ADR-001 — the gate the carve-out's "consented self-
// tracking" basis rests on; default OFF, genuinely gates lib/check-in-store
// pushCheckInEntry), transparency about on-device vs backed-up data, export my
// record (CSV/JSON, U3), and a local-only "clear on-device data" reset. Export
// reads the RecordStore and hands a file to the OS share sheet — a user-initiated
// local export, NOT SR-4 exfiltration. The full hard-immediate account deletion
// (S47/S48) lives under Account in the hub — this screen no longer duplicates it.
export default function PrivacyScreen() {
  const t = CT4_SETTINGS.privacy;
  const [busy, setBusy] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [cleared, setCleared] = useState(false);
  const { momentSyncConsent, setMomentSyncConsent: setConsent } = useSyncConsent();

  const onExport = async (format: ExportFormat) => {
    if (busy) return;
    setBusy(true);
    try {
      const entries = readAllEntries(dailyRollupReader(getMomentStore()));
      const content = format === 'json' ? toJSON(entries) : toCSV(entries);
      await shareRecordFile(format, content);
    } finally {
      setBusy(false);
    }
  };

  // Local-only reset: wipe every known on-device key, drop the live check-in store,
  // and reset the preference caches we own back to their defaults (consent → OFF —
  // clearing your data also stops any backup). No remote call, no navigation; the
  // full account/remote cascade is the separate "Delete my record" flow (S47/S48).
  const onClear = () => {
    wipeLocalData(storage);
    deleteExportedRecordFiles();
    resetLiveState();
    setMomentSyncConsent(false);
    setReadingTextSize('default');
    setConfirmingClear(false);
    setCleared(true);
  };

  return (
    <ScreenShell edges={['bottom']}>
      <ScrollView contentContainerClassName="gap-5 py-4" showsVerticalScrollIndicator={false}>
        <Text variant="body" className="px-1 text-text-secondary dark:text-text-secondary-dark">
          {t.trust}
        </Text>

        <SettingsSection title={t.syncSectionLabel}>
          <SettingsToggleRow
            label={t.syncConsentLabel}
            description={t.syncConsentDescription}
            value={momentSyncConsent}
            onValueChange={setConsent}
            testID="sync-consent-toggle"
          />
        </SettingsSection>

        <View className="gap-1">
          <Text variant="bodyLarge" className="px-1">
            {t.onDeviceLabel}
          </Text>
          <Text variant="caption" className="px-1 text-text-secondary dark:text-text-secondary-dark">
            {t.onDeviceBody}
          </Text>
        </View>

        <View className="gap-1">
          <Text variant="bodyLarge" className="px-1">
            {t.syncedLabel}
          </Text>
          <Text variant="caption" className="px-1 text-text-secondary dark:text-text-secondary-dark">
            {t.syncedBody}
          </Text>
        </View>

        <View className="gap-2">
          <Text variant="bodyLarge" className="px-1">
            {t.exportLabel}
          </Text>
          <Text variant="caption" className="px-1 text-text-secondary dark:text-text-secondary-dark">
            {t.exportDescription}
          </Text>
          <Button variant="secondary" onPress={() => onExport('json')} disabled={busy} testID="export-json">
            {t.exportJson}
          </Button>
          <Button variant="secondary" onPress={() => onExport('csv')} disabled={busy} testID="export-csv">
            {t.exportCsv}
          </Button>
        </View>

        <View className="gap-2">
          <Text variant="bodyLarge" className="px-1">
            {t.clearLabel}
          </Text>
          <Text variant="caption" className="px-1 text-text-secondary dark:text-text-secondary-dark">
            {t.clearDescription}
          </Text>
          {cleared ? (
            <Text variant="caption" className="px-1 text-text-secondary dark:text-text-secondary-dark" testID="clear-done">
              {t.clearDone}
            </Text>
          ) : confirmingClear ? (
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button variant="secondary" onPress={onClear} testID="clear-confirm">
                  {t.clearConfirm}
                </Button>
              </View>
              <View className="flex-1">
                <Button variant="ghost" onPress={() => setConfirmingClear(false)} testID="clear-cancel">
                  {t.clearCancel}
                </Button>
              </View>
            </View>
          ) : (
            <Button variant="secondary" onPress={() => setConfirmingClear(true)} testID="clear-on-device">
              {t.clearLabel}
            </Button>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
