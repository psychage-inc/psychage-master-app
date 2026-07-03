import { Award, BookOpen, ChevronDown, ClipboardList, Layers } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useReducedMotion } from '@/lib/motion';
import { useThemeColors } from '@/lib/use-theme-colors';

import { DIMENSION_META, DIMENSION_ORDER } from '../../dimensions';
import { TIER_DESCRIPTIONS } from '../../results-content';
import type { DomainKey, ScoreTier } from '../../types';
import { TierBadge } from '../TierBadge';

// ScoreGuideTab — faithful RN port of the web ScoreGuideTab: an overview stat grid, a
// "how scoring works" dimension sum, collapsible tier explanations (current tier
// highlighted), and the validated-instrument reference list.

const CARD = 'rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark';

const TIER_ORDER: readonly ScoreTier[] = ['thriving', 'balanced', 'struggling', 'distressed', 'crisis'];

const OVERVIEW: ReadonlyArray<{ icon: LucideIcon; title: string; desc: string }> = [
  { icon: ClipboardList, title: '20 Questions', desc: 'Covering five wellness dimensions' },
  { icon: Layers, title: '0–100 Scale', desc: 'Sum of five dimension sub-scores' },
  // Names must match DIMENSION_META (../../dimensions.ts) — the actual five dimensions.
  { icon: Award, title: '5 Dimensions', desc: 'Emotional, Overall Wellbeing, Social, Stress Load, Daily Functioning' },
  { icon: BookOpen, title: '4 Instruments', desc: 'PHQ-4, WHO-5, UCLA-3, PSS-4' },
];

const INSTRUMENTS: ReadonlyArray<{ badge: string; name: string; measures: string; dimensionKey: DomainKey }> = [
  {
    badge: 'PHQ-4',
    name: 'Patient Health Questionnaire-4',
    measures:
      'Screens for depression and anxiety symptoms. Four items covering feeling down, loss of interest, nervousness, and uncontrollable worry.',
    dimensionKey: 'emotional',
  },
  {
    badge: 'WHO-5',
    name: 'World Health Organization Well-Being Index',
    measures:
      'Measures general subjective well-being across five items: cheerfulness, calm, energy, rest quality, and daily interest.',
    dimensionKey: 'vitality',
  },
  {
    badge: 'UCLA-3',
    name: 'UCLA 3-Item Loneliness Scale',
    measures:
      'Assesses perceived loneliness through three items about companionship, feeling left out, and isolation.',
    dimensionKey: 'social',
  },
  {
    badge: 'PSS-4',
    name: 'Perceived Stress Scale (4-Item)',
    measures:
      'Evaluates perceived stress levels, sense of control, confidence in problem-solving, and whether difficulties feel manageable.',
    dimensionKey: 'cognitive',
  },
];

export interface ScoreGuideTabProps {
  readonly currentTier?: ScoreTier;
}

export function ScoreGuideTab({ currentTier }: ScoreGuideTabProps) {
  const reduced = useReducedMotion();
  const tc = useThemeColors();
  const [expanded, setExpanded] = useState<ScoreTier | null>(currentTier ?? null);

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(300)} className="gap-6">
      {/* Understanding */}
      <View className={CARD}>
        <View className="mb-5 flex-row items-center gap-2">
          <BookOpen size={20} color="#1A9B8C" />
          <Text variant="h2">Understanding Your Clarity Score</Text>
        </View>
        <View className="flex-row flex-wrap gap-3">
          {OVERVIEW.map((item) => {
            const ItemIcon = item.icon;
            return (
              <View
                key={item.title}
                className="rounded-xl border border-border p-4 dark:border-border-dark"
                style={{ width: '47%' }}
              >
                <ItemIcon size={18} color="#1A9B8C" />
                <Text variant="bodyLarge" className="mt-2 text-[14px]">
                  {item.title}
                </Text>
                <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                  {item.desc}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* How scoring works */}
      <View className={CARD}>
        <Text variant="h2" className="mb-4">
          How Scoring Works
        </Text>
        <Text variant="caption" className="mb-5 text-text-secondary dark:text-text-secondary-dark">
          Each of the 20 questions uses a validated scale appropriate to its instrument. Your responses
          map to five wellness dimensions, each producing a sub-score from 0 to 20. The composite Clarity
          Score is the sum of all five dimension scores, giving a range of 0 to 100. Higher scores
          indicate greater overall wellness.
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          {DIMENSION_ORDER.map((key, i) => (
            <View key={key} className="flex-row items-center gap-2">
              <View
                className="flex-row items-center gap-1.5 rounded-lg px-2.5 py-2"
                style={{ backgroundColor: `${DIMENSION_META[key].hexColor}1A` }}
              >
                <Text style={{ color: DIMENSION_META[key].hexColor, fontSize: 12, fontWeight: '600' }}>
                  {DIMENSION_META[key].shortName}
                </Text>
                <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                  0–20
                </Text>
              </View>
              {i < DIMENSION_ORDER.length - 1 ? <Text className="text-text-secondary">+</Text> : null}
            </View>
          ))}
          <Text className="text-text-secondary">=</Text>
          <View className="rounded-lg px-3 py-2" style={{ backgroundColor: tc.ink }}>
            <Text style={{ color: tc.ink === '#FFFFFF' ? '#000' : '#fff', fontSize: 12, fontWeight: '700' }}>
              Clarity Score 0–100
            </Text>
          </View>
        </View>
      </View>

      {/* Score tiers explained */}
      <View className={CARD}>
        <Text variant="h2" className="mb-4">
          Score Tiers Explained
        </Text>
        <View className="gap-3">
          {TIER_ORDER.map((tierKey) => {
            const td = TIER_DESCRIPTIONS[tierKey];
            const isExpanded = expanded === tierKey;
            const isCurrent = tierKey === currentTier;
            return (
              <View
                key={tierKey}
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: isCurrent ? '#1A9B8C' : tc.inkTertiary }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  onPress={() => setExpanded(isExpanded ? null : tierKey)}
                  className="min-h-[44px] flex-row items-center justify-between p-4"
                >
                  <View className="flex-row items-center gap-3">
                    <TierBadge tier={tierKey} size="md" />
                    <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                      {td.range}
                    </Text>
                    {isCurrent ? (
                      <Text variant="caption" style={{ color: '#1A9B8C', fontWeight: '700' }}>
                        Your tier
                      </Text>
                    ) : null}
                  </View>
                  <ChevronDown
                    size={18}
                    color={tc.inkSecondary}
                    style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                  />
                </Pressable>
                {isExpanded ? (
                  <View className="gap-3 border-t border-border p-4 dark:border-border-dark">
                    <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                      {td.description}
                    </Text>
                    <View className="gap-2">
                      <Text variant="caption" style={{ color: '#10b981' }}>
                        What's Working
                      </Text>
                      <Text variant="caption">{td.whatsWorking}</Text>
                      <Text variant="caption" style={{ color: '#f59e0b' }} className="mt-1">
                        Watch For
                      </Text>
                      <Text variant="caption">{td.watchFor}</Text>
                      <Text variant="caption" style={{ color: '#1A9B8C' }} className="mt-1">
                        Professional Guidance
                      </Text>
                      <Text variant="caption">{td.professionalGuidance}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      {/* Validated instruments */}
      <View className={CARD}>
        <Text variant="h2" className="mb-4">
          Validated Instruments
        </Text>
        <View className="gap-4">
          {INSTRUMENTS.map((inst) => {
            const m = DIMENSION_META[inst.dimensionKey];
            const DimIcon = m.icon;
            return (
              <View key={inst.badge} className="flex-row items-start gap-4 rounded-xl border border-border p-4 dark:border-border-dark">
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: `${m.hexColor}1A`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <DimIcon size={18} color={m.hexColor} />
                </View>
                <View className="flex-1">
                  <Text variant="bodyLarge" className="text-[14px]">
                    {inst.badge} — {inst.name}
                  </Text>
                  <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                    {inst.measures}
                  </Text>
                </View>
              </View>
            );
          })}
          <View className="flex-row items-start gap-4 rounded-xl border border-border p-4 dark:border-border-dark">
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: `${DIMENSION_META.functioning.hexColor}1A`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DIMENSION_META.functioning.icon size={18} color={DIMENSION_META.functioning.hexColor} />
            </View>
            <View className="flex-1">
              <Text variant="bodyLarge" className="text-[14px]">
                Custom — WHODAS-adapted Daily Functioning Items
              </Text>
              <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                Four items adapted from the WHO Disability Assessment Schedule measuring symptom
                interference, relationship difficulty, responsibility management, and mental-physical
                health connection.
              </Text>
            </View>
          </View>
        </View>
        <Text variant="caption" className="mt-5 text-text-secondary dark:text-text-secondary-dark">
          This tool is built on published, validated screening instruments — the PHQ-4, WHO-5, UCLA-3,
          and PSS-4 — each widely used in research and clinical practice. It offers educational insight,
          not a diagnosis.
        </Text>
      </View>
    </Animated.View>
  );
}
