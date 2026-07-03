import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsToggleRow } from '@/components/settings/SettingsToggleRow';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { CT4_SETTINGS } from '@/features/settings/copy';
import { dateToHhmm, formatReminderTime, hhmmToDate } from '@/features/settings/format-time';
import { storage } from '@/lib/adapters/storage';
import {
  loadReminderSettings,
  saveReminderSettings,
} from '@/lib/persistence/reminder-settings';

// S43 Reminders. The reminder doctrine: ONE daily reminder, evening default, a
// system time picker, and "Not now / Never" — Never is PERMANENT. NO re-
// engagement campaigns, no "we miss you."
//
// PLATFORM BOUNDARY: the OS notification scheduling hand-off (SYS push /
// expo-notifications) is the platform layer. This screen owns the user-facing
// setting only; the schedule wiring is flagged, not implemented, in Wave B2.

type LastAction = 'none' | 'set' | 'never';

export default function RemindersScreen() {
  const t = CT4_SETTINGS.reminders;
  const [settings, setSettings] = useState(() => loadReminderSettings(storage));
  const [showPicker, setShowPicker] = useState(false);
  const [lastAction, setLastAction] = useState<LastAction>('none');

  const persist = (next: { enabled: boolean; time: string; neverAsked: boolean }) => {
    setSettings(saveReminderSettings(storage, next));
  };

  const onToggleEnabled = (enabled: boolean) => {
    persist({ enabled, time: settings.time, neverAsked: settings.neverAsked });
    setLastAction(enabled ? 'set' : 'none');
  };

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    // Android's picker is a one-shot dialog: it fires once ('set' or 'dismissed'),
    // so close it either way. iOS's inline spinner fires a 'set' on EVERY wheel
    // detent — keep it open and commit the value live (the time row toggles it away).
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type !== 'set' || !date) return;
    persist({ enabled: true, time: dateToHhmm(date), neverAsked: settings.neverAsked });
    setLastAction('set');
  };

  const onNotNow = () => {
    persist({ enabled: false, time: settings.time, neverAsked: false });
    setLastAction('none');
  };

  // "Never" — PERMANENT. neverAsked stays true forever; the app never re-prompts.
  const onNever = () => {
    persist({ enabled: false, time: settings.time, neverAsked: true });
    setLastAction('never');
  };

  return (
    <ScreenShell edges={['bottom']}>
      <ScrollView contentContainerClassName="gap-4 py-4" showsVerticalScrollIndicator={false}>
        <Text variant="body" className="px-1 text-text-secondary dark:text-text-secondary-dark">
          {t.intro}
        </Text>

        <SettingsSection>
          <SettingsToggleRow
            label={t.enabledLabel}
            value={settings.enabled}
            onValueChange={onToggleEnabled}
            testID="reminder-enabled-toggle"
          />
          {settings.enabled ? (
            <SettingsRow
              label={t.timeLabel}
              value={formatReminderTime(settings.time)}
              chevron={false}
              onPress={() => setShowPicker((visible) => !visible)}
              testID="reminder-time-row"
            />
          ) : null}
        </SettingsSection>

        {lastAction === 'set' ? (
          <Text variant="caption" className="px-1 text-text-secondary dark:text-text-secondary-dark">
            {t.setConfirmation}
          </Text>
        ) : null}

        {settings.neverAsked ? (
          <Text
            variant="caption"
            className="px-1 text-text-secondary dark:text-text-secondary-dark"
            testID="reminder-never-confirmation"
          >
            {t.neverConfirmation}
          </Text>
        ) : (
          <View className="flex-row gap-4 px-1 pt-2">
            <Pressable accessibilityRole="button" onPress={onNotNow} testID="reminder-not-now">
              <Text variant="bodyLarge" className="text-text-tertiary dark:text-text-tertiary-dark">
                {t.notNow}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onNever} testID="reminder-never">
              <Text variant="bodyLarge" className="text-text-tertiary dark:text-text-tertiary-dark">
                {t.never}
              </Text>
            </Pressable>
          </View>
        )}

        {showPicker ? (
          <DateTimePicker
            value={hhmmToDate(settings.time, new Date())}
            mode="time"
            display="spinner"
            onChange={onPickerChange}
            testID="reminder-time-picker"
          />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}
