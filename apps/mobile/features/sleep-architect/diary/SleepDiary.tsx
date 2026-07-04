import { FlashList } from '@shopify/flash-list';
import { Pressable, View } from 'react-native';

import { calculateMetrics, formatDuration, type SleepEntry } from '@psychage/shared/sleep';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { CT4_SLEEP } from '@/features/sleep-architect/copy';

// Diary list (S-diary). FlashList per the stack rule (any list >20 items). Each row
// shows the night's date, measured sleep length, and self-rated quality — facts the
// user logged, no scoring. Newest first.

type SleepDiaryProps = {
  entries: readonly SleepEntry[]; // newest-first
  onLog: () => void;
  onSelect: (entry: SleepEntry) => void;
};

export function SleepDiary({ entries, onLog, onSelect }: SleepDiaryProps) {
  const t = CT4_SLEEP.diary;

  return (
    <View className="flex-1 gap-3">
      <Button variant="primary" className="w-full" onPress={onLog}>
        {t.logToday}
      </Button>

      {entries.length === 0 ? (
        <Card className="gap-1 px-4 py-6">
          <Text variant="label">{t.emptyTitle}</Text>
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            {t.emptyBody}
          </Text>
        </Card>
      ) : (
        <FlashList
          data={entries as SleepEntry[]}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => <DiaryRow entry={item} onPress={() => onSelect(item)} />}
        />
      )}
    </View>
  );
}

function DiaryRow({ entry, onPress }: { entry: SleepEntry; onPress: () => void }) {
  const metrics = calculateMetrics(entry);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.date}, ${formatDuration(metrics.total_sleep_minutes)} asleep`}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <View className="flex-1 gap-0.5 pr-3">
        <Text variant="bodyLarge">{entry.date}</Text>
        <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
          {CT4_SLEEP.diary.quality}: {entry.sleep_quality}/5
        </Text>
      </View>
      <Text variant="label">{formatDuration(metrics.total_sleep_minutes)}</Text>
    </Pressable>
  );
}
