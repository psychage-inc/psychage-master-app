import { Award, Calendar, Clock, Layers, TrendingUp } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { TrendLine } from '@/components/ui/charts/TrendLine';
import { useReducedMotion } from '@/lib/motion';

import { DIMENSION_META, DIMENSION_ORDER } from '../../dimensions';
import { getScoreLabel } from '../../scoring';
import type { ClarityHistoryItem, ClarityScoreResult } from '../../types';
import { TierBadge } from '../TierBadge';

// HistoryTab — faithful RN port of the web HistoryTab: composite score trend, change
// summary, pattern insights, assessment list, and milestones. The web's secondary 5-line
// per-dimension trend chart is omitted (the shared TrendLine is single-series; the
// composite trend + per-entry data carry the same information). Data is local-only.

const CARD = 'rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark';

interface Milestone {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly earned: boolean;
  readonly description: string;
}

// `history` must be the FULL stored history (newest first — the route passes
// getRecent(CLARITY_HISTORY_CAP)): the "since your first assessment" comparisons
// here and in computeMilestones read the oldest entry as the true first snapshot.
function computeInsights(history: ClarityHistoryItem[]) {
  if (history.length < 2) return null;
  const latest = history[0];
  const oldest = history[history.length - 1];
  const previous = history[1];
  if (!latest || !oldest || !previous) return null;

  const totalChange = latest.score - oldest.score;
  const recentChange = latest.score - previous.score;

  let bestImproving: string | null = null;
  let bestDelta = -Infinity;
  if (latest.domainScores && oldest.domainScores) {
    for (const key of DIMENSION_ORDER) {
      const delta = (latest.domainScores[key] ?? 0) - (oldest.domainScores[key] ?? 0);
      if (delta > bestDelta) {
        bestDelta = delta;
        bestImproving = DIMENSION_META[key].name;
      }
    }
  }
  return { totalChange, recentChange, bestImproving, bestDelta };
}

function computeMilestones(history: ClarityHistoryItem[], currentResult: ClarityScoreResult): Milestone[] {
  const hasHistory = history.length > 0;
  const oldest = history[history.length - 1];
  const latest = history[0];

  let spanMonths = 0;
  if (hasHistory && oldest && latest) {
    const oldDate = new Date(oldest.date).getTime();
    const newDate = new Date(latest.date).getTime();
    spanMonths = Math.floor((newDate - oldDate) / (1000 * 60 * 60 * 24 * 30));
  }
  const improvement = hasHistory && oldest && latest ? latest.score - oldest.score : 0;
  const allBalanced = DIMENSION_ORDER.every((key) => currentResult.domainScores[key] >= 12);

  return [
    { label: 'First Assessment', icon: Award, earned: hasHistory, description: 'Completed your first Clarity Score' },
    { label: '+10 Points', icon: TrendingUp, earned: improvement >= 10, description: 'Improved 10+ points from first assessment' },
    { label: '3-Month Streak', icon: Calendar, earned: spanMonths >= 3, description: 'Tracking wellness for 3+ months' },
    { label: 'All Balanced', icon: Award, earned: allBalanced, description: 'All dimensions scoring 12 or above' },
  ];
}

function MilestoneRow({ milestones }: { milestones: Milestone[] }) {
  return (
    <View className={CARD}>
      <View className="mb-4 flex-row items-center gap-2">
        <Award size={16} color="#1A9B8C" />
        <Text variant="label" className="text-[14px]">
          Milestones
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-3">
        {milestones.map((m) => {
          const MIcon = m.icon;
          return (
            <View
              key={m.label}
              className="items-center rounded-xl border border-border p-4 dark:border-border-dark"
              style={{ width: '47%', opacity: m.earned ? 1 : 0.5 }}
            >
              <MIcon size={18} color={m.earned ? '#10b981' : '#9ca3af'} />
              <Text variant="caption" className="mt-2 text-center" style={{ fontWeight: '600' }}>
                {m.label}
              </Text>
              <Text variant="caption" className="mt-0.5 text-center text-text-secondary dark:text-text-secondary-dark">
                {m.description}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export interface HistoryTabProps {
  readonly history: ClarityHistoryItem[];
  readonly currentResult: ClarityScoreResult;
}

export function HistoryTab({ history, currentResult }: HistoryTabProps) {
  const reduced = useReducedMotion();
  const chronological = [...history].reverse();
  const insights = computeInsights(history);
  const milestones = computeMilestones(history, currentResult);

  const Wrap = ({ children }: { children: ReactNode }) => (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(300)} className="gap-6">
      {children}
    </Animated.View>
  );

  // Empty
  if (history.length === 0) {
    return (
      <Wrap>
        <View className={`items-center ${CARD}`}>
          <Clock size={28} color="#1A9B8C" />
          <Text variant="h1" className="mt-4 text-center">
            Track Your Clarity Over Time
          </Text>
          <Text variant="body" className="mt-2 text-center text-text-secondary dark:text-text-secondary-dark">
            Results stay on your device unless you choose to save them.
          </Text>
          <Text variant="caption" className="mt-2 text-center text-text-secondary dark:text-text-secondary-dark">
            Retake in 2 weeks to start seeing trends.
          </Text>
        </View>
      </Wrap>
    );
  }

  // Single entry
  if (history.length === 1) {
    const only = history[0];
    return (
      <Wrap>
        <View className={`items-center ${CARD}`}>
          <Clock size={28} color="#1A9B8C" />
          <Text variant="h2" className="mt-4 text-center">
            Your First Assessment is Recorded
          </Text>
          <Text variant="body" className="mt-2 text-center text-text-secondary dark:text-text-secondary-dark">
            Score: {only?.score} — {only?.label ?? (only ? getScoreLabel(only.score).label : '')}
          </Text>
          <Text variant="caption" className="mt-2 text-center text-text-secondary dark:text-text-secondary-dark">
            Retake in 2 weeks to see how your wellness changes over time. Trend charts appear after 2 or
            more assessments.
          </Text>
        </View>
        <MilestoneRow milestones={milestones} />
      </Wrap>
    );
  }

  // Full
  return (
    <Wrap>
      <View className={CARD}>
        <View className="mb-4 flex-row items-center gap-2">
          <TrendingUp size={18} color="#1A9B8C" />
          <Text variant="label">Score Trend</Text>
        </View>
        <View className="items-center">
          <TrendLine data={chronological.map((h) => ({ x: h.date, y: h.score }))} width={300} height={180} />
        </View>
      </View>

      {insights ? (
        <View className="flex-row flex-wrap gap-3">
          <View className={`flex-1 items-center ${CARD}`} style={{ minWidth: '28%' }}>
            <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
              Overall Change
            </Text>
            <Text variant="h1">
              {insights.totalChange > 0 ? '+' : ''}
              {insights.totalChange} pts
            </Text>
          </View>
          <View className={`flex-1 items-center ${CARD}`} style={{ minWidth: '28%' }}>
            <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
              Assessments
            </Text>
            <Text variant="h1">{history.length}</Text>
          </View>
          <View className={`flex-1 items-center ${CARD}`} style={{ minWidth: '28%' }}>
            <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
              Since Last
            </Text>
            <Text variant="h1">
              {insights.recentChange > 0 ? '+' : ''}
              {insights.recentChange} pts
            </Text>
          </View>
        </View>
      ) : null}

      {insights?.bestImproving ? (
        <View className={CARD}>
          <View className="mb-3 flex-row items-center gap-2">
            <TrendingUp size={16} color="#1A9B8C" />
            <Text variant="label" className="text-[14px]">
              Pattern Insights
            </Text>
          </View>
          <View className="gap-2">
            {insights.totalChange > 0 ? (
              <Text variant="caption">
                Your overall score has improved {insights.totalChange} points since your first assessment.
              </Text>
            ) : null}
            {insights.totalChange === 0 ? (
              <Text variant="caption">Your overall score has remained stable across assessments.</Text>
            ) : null}
            {insights.totalChange < 0 ? (
              <Text variant="caption">
                Your score has decreased {Math.abs(insights.totalChange)} points. Consider exploring what
                may have changed.
              </Text>
            ) : null}
            {insights.bestDelta > 0 ? (
              <Text variant="caption">
                {insights.bestImproving} is your most improved dimension (+{Math.round(insights.bestDelta)}{' '}
                points).
              </Text>
            ) : null}
            <Text variant="caption">
              Recommended: Retake in 2 weeks for the most meaningful comparison.
            </Text>
          </View>
        </View>
      ) : null}

      <View className={CARD}>
        <View className="mb-4 flex-row items-center gap-2">
          <Layers size={16} color="#1A9B8C" />
          <Text variant="label" className="text-[14px]">
            Assessment History
          </Text>
        </View>
        <View className="gap-3">
          {history.map((entry, i) => {
            const { tier } = getScoreLabel(entry.score);
            return (
              <View
                key={entry.id}
                className="flex-row items-center gap-4 rounded-xl border border-border p-3 dark:border-border-dark"
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: '#9ca3af55',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="label">{entry.score}</Text>
                </View>
                <View className="flex-1">
                  <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                    {entry.date}
                  </Text>
                  <TierBadge tier={tier} size="sm" />
                </View>
                {i === 0 ? (
                  <Text variant="caption" style={{ color: '#1A9B8C', fontWeight: '600' }}>
                    Latest
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <MilestoneRow milestones={milestones} />
    </Wrap>
  );
}
