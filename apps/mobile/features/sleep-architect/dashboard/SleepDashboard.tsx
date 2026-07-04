import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import {
  bandForScore,
  calculateMetrics,
  calculateSleepScore,
  calculateStreak,
  formatDuration,
  type SleepEntry,
  type SleepScoreBand,
  type SleepSettings,
  toLocalCalendarDate,
  windowByDays,
} from '@psychage/shared/sleep';

import { Card } from '@/components/ui/Card';
import { TrendLine } from '@/components/ui/charts/TrendLine';
import { Text } from '@/components/ui/Text';
import { CT4_SLEEP } from '@/features/sleep-architect/copy';

import { QualityMoodTrend } from './QualityMoodTrend';
import { ScoreBand } from './ScoreBand';
import { WeeklyDigest } from './WeeklyDigest';

// Patterns/Dashboard tab. The composite score reaches the UI only as a band
// (SR-1). Raw measured metrics (length, efficiency, latency) are factual data and
// ARE shown, like the web. All computed locally from the on-device store (SR-4).

type SleepDashboardProps = {
  entries: readonly SleepEntry[]; // newest-first
  settings: SleepSettings;
};

const DOT_CLASS: Record<SleepScoreBand, string> = {
  rested: 'bg-teal-500',
  steady: 'bg-success',
  uneven: 'bg-warning',
  low: 'bg-charcoal-400',
};

// Scoring window options (7/30/90 days, default 7). DELIBERATE web divergence
// (PR-037): web's useSleepScore keeps an inclusive today-N cutoff (8 calendar
// days for "7"); mobile windows are exactly N days so the dashboard, weekly
// digest, and export all agree. Same data can therefore score slightly
// differently on web until web adopts the fix.
const RANGE_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

export function SleepDashboard({ entries, settings }: SleepDashboardProps) {
  const { width } = useWindowDimensions();
  const [rangeDays, setRangeDays] = useState<number>(7);
  const t = CT4_SLEEP.metrics;

  if (entries.length === 0) {
    return (
      <Card className="gap-1 px-4 py-6">
        <Text variant="label">{CT4_SLEEP.dashboard.emptyTitle}</Text>
        <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
          {CT4_SLEEP.dashboard.emptyBody}
        </Text>
      </Card>
    );
  }

  // Window by calendar days (web parity), not a fixed entry count. Streak still
  // walks the full history; only the dashboard's scored/averaged set is windowed.
  const today = toLocalCalendarDate(new Date());
  const windowed = windowByDays(entries, today, rangeDays);
  const streak = calculateStreak(entries, today);
  const rangeSelector = (
    <RangeSelector value={rangeDays} onChange={setRangeDays} />
  );

  if (windowed.length === 0) {
    return (
      <View className="gap-4">
        {rangeSelector}
        <Card className="gap-1 px-4 py-6">
          <Text variant="label">{CT4_SLEEP.dashboard.emptyTitle}</Text>
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            No nights logged in the last {rangeDays} days.
          </Text>
        </Card>
      </View>
    );
  }

  const chronological = [...windowed].reverse();
  const metrics = windowed.map(calculateMetrics);
  const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

  const avgDuration = avg(metrics.map((m) => m.total_sleep_minutes));
  const avgEfficiency = avg(metrics.map((m) => m.sleep_efficiency));
  const avgLatency = avg(metrics.map((m) => m.sleep_latency_minutes));

  const score = calculateSleepScore(windowed, settings.age_range);
  const band = bandForScore(score.overall);

  // Factual sleep-length trend (minutes per night, oldest → newest). Plotted on the
  // shared TrendLine — the axis is unlabelled, so minutes vs hours give the same shape.
  // Auto-scaled (no fixed min) to keep night-to-night variation visible.
  const trend = chronological.map((e, i) => ({
    x: i,
    y: calculateMetrics(e).total_sleep_minutes,
  }));

  const components: { key: keyof typeof CT4_SLEEP.componentLabels; value: number }[] = [
    { key: 'duration', value: score.duration },
    { key: 'efficiency', value: score.efficiency },
    { key: 'quality', value: score.quality },
    { key: 'consistency', value: score.consistency },
    { key: 'latency', value: score.latency },
  ];

  return (
    <View className="gap-4">
      {rangeSelector}
      <ScoreBand band={band} caption={CT4_SLEEP.scoreCaption} />

      <View className="flex-row flex-wrap gap-3">
        <MetricCard label={t.avgSleep} value={formatDuration(Math.round(avgDuration))} />
        <MetricCard label={t.efficiency} value={`${Math.round(avgEfficiency)}%`} />
        <MetricCard label={t.latency} value={`${Math.round(avgLatency)} min`} />
        <MetricCard label={t.streak} value={String(streak.current)} />
      </View>

      <WeeklyDigest entries={entries} />

      {trend.length >= 2 ? (
        <Card className="gap-2 px-4 py-4">
          <Text variant="caption" className="uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark">
            {t.trendTitle}
          </Text>
          <TrendLine
            data={trend}
            width={Math.max(0, width - 64)}
            accessibilityLabel={t.trendTitle}
          />
        </Card>
      ) : null}

      <QualityMoodTrend entries={chronological} />

      <View className="gap-2">
        {components.map((c) => (
          <View key={c.key} className="min-h-[44px] flex-row items-center justify-between rounded-lg border border-border bg-surface px-4 py-2 dark:border-border-dark dark:bg-surface-dark">
            <Text variant="caption">{CT4_SLEEP.componentLabels[c.key]}</Text>
            <View className="flex-row items-center gap-2">
              <View className={`h-2 w-2 rounded-full ${DOT_CLASS[bandForScore(c.value)]}`} />
              <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                {CT4_SLEEP.bands[bandForScore(c.value)].label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[44%] flex-1 gap-1 px-4 py-3">
      <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
        {label}
      </Text>
      <Text variant="label">{value}</Text>
    </Card>
  );
}

function RangeSelector({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row gap-2 self-start rounded-lg border border-border bg-surface p-1 dark:border-border-dark dark:bg-surface-dark"
    >
      {RANGE_OPTIONS.map((opt) => {
        const active = opt.days === value;
        return (
          <Pressable
            key={opt.days}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            onPress={() => onChange(opt.days)}
            className={`min-h-[36px] items-center justify-center rounded-md px-3 ${
              active ? 'bg-primary dark:bg-primary-dark' : 'bg-transparent'
            }`}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text
              variant={active ? 'label' : 'caption'}
              className={
                active ? 'text-white' : 'text-text-secondary dark:text-text-secondary-dark'
              }
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
