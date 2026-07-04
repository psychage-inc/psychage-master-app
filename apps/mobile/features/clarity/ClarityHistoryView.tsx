import { ScrollView, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenEntrance } from '@/components/ui/ScreenEntrance';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';

import { TierBadge } from './components/TierBadge';
import type { ClaritySnapshot } from './result-store';

// S-history — past Clarity snapshots, newest first. Web-parity override: each snapshot
// shows its raw composite (0–100) and tier badge, matching the dashboard's History tab
// list. Read-only, local-only. Crisis stays reachable via the chrome's Help-now pill
// (this view is composed inside ToolScreen).

const TITLE = 'Your snapshots';
const EMPTY = "No snapshots yet. When you finish a Clarity assessment, it'll show up here.";

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM-DD` → `15 Jun 2026`, parsed from parts (no Date/TZ ambiguity). */
function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  const month = MONTHS[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

export interface ClarityHistoryViewProps {
  /** Newest first. */
  readonly snapshots: readonly ClaritySnapshot[];
  readonly onStartNew: () => void;
}

export function ClarityHistoryView({ snapshots, onStartNew }: ClarityHistoryViewProps) {
  return (
    <ScrollView contentContainerClassName="gap-5 px-4 pb-12 pt-2" showsVerticalScrollIndicator={false}>
      <ScreenEntrance>
        <Text variant="h1" accessibilityRole="header">
          {TITLE}
        </Text>

        {snapshots.length === 0 ? (
          <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark">
            {EMPTY}
          </Text>
        ) : (
          snapshots.map((s) => (
            <Card key={s.id} className="flex-row items-center gap-4">
              <View className="h-12 w-12 items-center justify-center rounded-full border border-border dark:border-border-dark">
                <Text variant="label">{s.composite}</Text>
              </View>
              <View className="flex-1">
                <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                  {formatDate(s.date)}
                </Text>
                <TierBadge tier={s.tier} size="sm" />
              </View>
            </Card>
          ))
        )}

        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Take a new assessment"
          onPress={onStartNew}
          hitSlop={6}
          className="min-h-[44px] justify-center"
          haptic="tab"
        >
          <Text variant="bodyLarge" className="text-primary dark:text-primary-dark">
            Take a new assessment
          </Text>
        </AnimatedPressable>
      </ScreenEntrance>
    </ScrollView>
  );
}
