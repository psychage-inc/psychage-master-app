import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DomainRadar } from '@/components/ui/charts';
import { ScoreGauge } from '@/components/ui/charts';
import { Text } from '@/components/ui/Text';
import { RelatedArticleCard } from '@/features/content/RelatedArticleCard';
import { getLearnCategory } from '@/features/learn/categories';
import { type ArticleListItem, listArticlesByCategorySlugs } from '@/lib/articles';

import { CT4_RELATIONSHIP } from '../copy';
import { getTopInterventions } from '../interventions';
import type { ComputedRelationshipResult } from '../scoring';
import {
  DOMAIN_META,
  type DetectedPattern,
  type PatternSeverity,
  type RelationshipDomain,
} from '../types';
import { SafetyAlert, SafetyBanner } from './SafetyAlert';

export interface ResultsViewProps {
  readonly result: ComputedRelationshipResult;
  readonly saved: boolean;
  readonly onSave: () => void;
  readonly onRetake: () => void;
  readonly onViewHistory: () => void;
  readonly onCrisis: () => void;
}

const ALL_DOMAINS: RelationshipDomain[] = ['partner', 'family', 'friends', 'community'];

const SEVERITY_DOT: Record<PatternSeverity, string> = {
  concern: 'bg-crisis',
  warning: 'bg-warning dark:bg-warning-dark',
  info: 'bg-primary dark:bg-primary-dark',
};

function PatternCard({ pattern }: { pattern: DetectedPattern }) {
  return (
    <Card>
      <View className="mb-1.5 flex-row items-center gap-2">
        <View className={`h-2 w-2 rounded-full ${SEVERITY_DOT[pattern.severity]}`} />
        <Text variant="bodyLarge" className="flex-1 text-[15px]">
          {pattern.title}
        </Text>
      </View>
      <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark leading-5">
        {pattern.description}
      </Text>
      <Text variant="caption" className="mt-2 text-text-tertiary dark:text-text-tertiary-dark leading-4">
        {pattern.scienceNote}
      </Text>
    </Card>
  );
}

// Related published articles for the relationship topic — read-only from
// Supabase via the shared repo. The relationship category slugs are the single
// source of truth in the Learn taxonomy. Drops silently when empty/offline.
function RelatedReading({ heading }: { heading: string }) {
  const slugs = getLearnCategory('relationships')?.slugs ?? [];
  const { data } = useQuery({
    queryKey: ['relationship-related', slugs],
    queryFn: () => listArticlesByCategorySlugs(slugs),
    enabled: slugs.length > 0,
  });
  const items = (data ?? []).slice(0, 5);
  if (items.length === 0) return null;

  return (
    <View className="gap-3" testID="relationship-related">
      <Text variant="h2" className="text-lg" accessibilityRole="header">
        {heading}
      </Text>
      <FlashList
        horizontal
        data={items}
        keyExtractor={(a: ArticleListItem) => a.slug}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View className="w-3" />}
        renderItem={({ item }: { item: ArticleListItem }) => <RelatedArticleCard article={item} />}
      />
    </View>
  );
}

export function ResultsView({ result, saved, onSave, onRetake, onViewHistory, onCrisis }: ResultsViewProps) {
  const t = CT4_RELATIONSHIP.results;
  const safetyTriggered = result.dvAlert.triggered || result.isolationAlert.triggered;
  const [alertVisible, setAlertVisible] = useState(safetyTriggered);

  const domains = ALL_DOMAINS.filter((d) => !(result.skipPartner && d === 'partner'));
  const radarPoints = domains.map((d) => ({ label: DOMAIN_META[d].shortName, value: result.domainScores[d] }));
  const interventions = getTopInterventions(result.patterns, 4);
  const blueprintParas = result.blueprint.split('\n\n').filter(Boolean);

  return (
    <View className="flex-1">
      <SafetyAlert
        visible={alertVisible}
        onDismiss={() => setAlertVisible(false)}
        onCrisis={onCrisis}
        // DV takes precedence when both fire; isolation-only runs get the
        // connection-focused variant instead of DV hotline copy (PR-029).
        variant={result.dvAlert.triggered ? 'dv' : 'isolation'}
      />

      <ScrollView
        className="flex-1 px-4"
        contentContainerClassName="gap-6 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {safetyTriggered ? <SafetyBanner onCrisis={onCrisis} /> : null}

        {/* Overall — shared score gauge + tier read */}
        <View className="items-center gap-3 pt-2">
          <Text
            variant="caption"
            className="uppercase tracking-wider text-text-tertiary dark:text-text-tertiary-dark font-sans-medium"
          >
            {t.overallHeading}
          </Text>
          <ScoreGauge value={result.compositeScore} />
          <Text
            variant="bodyLarge"
            className="px-6 text-center text-text-secondary dark:text-text-secondary-dark"
          >
            {result.tierLabel}
          </Text>
        </View>

        {/* By area — shared radar + compact per-area scores */}
        <View className="gap-3">
          <Text variant="h2" className="text-lg" accessibilityRole="header">
            {t.areasHeading}
          </Text>
          <View className="items-center">
            <DomainRadar points={radarPoints} />
          </View>
          <View className="flex-row flex-wrap justify-center gap-2">
            {domains.map((d) => (
              <View
                key={d}
                className="rounded-lg border border-border bg-surface px-3 py-2 dark:border-border-dark dark:bg-surface-dark"
              >
                <Text variant="caption" className="font-sans-medium">
                  {`${DOMAIN_META[d].shortName} · ${result.domainScores[d]}`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* What this means — plain-language tier read + generated reflection */}
        <View className="gap-2">
          <Text variant="h2" className="text-lg" accessibilityRole="header">
            {t.whatThisMeansHeading}
          </Text>
          <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark leading-6">
            {t.meaning[result.tier]}
          </Text>
          {blueprintParas.map((para) => (
            <Text
              key={para}
              variant="body"
              className="text-text-secondary dark:text-text-secondary-dark leading-6"
            >
              {para}
            </Text>
          ))}
        </View>

        {/* How it affects you — detected patterns (or a gentle fallback) */}
        <View className="gap-3">
          <Text variant="h2" className="text-lg" accessibilityRole="header">
            {t.howAffectsHeading}
          </Text>
          {result.patterns.length > 0 ? (
            result.patterns.map((p) => <PatternCard key={p.key} pattern={p} />)
          ) : (
            <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark leading-6">
              {t.noPatterns}
            </Text>
          )}
        </View>

        {/* How to improve — evidence-based next steps */}
        {interventions.length > 0 ? (
          <View className="gap-3">
            <Text variant="h2" className="text-lg" accessibilityRole="header">
              {t.howToImproveHeading}
            </Text>
            {interventions.map((iv) => (
              <Card key={iv.id} className="gap-2">
                <Text variant="bodyLarge" className="text-[15px]">
                  {iv.title}
                </Text>
                <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark leading-5">
                  {iv.description}
                </Text>
                <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
                  {`${iv.difficulty} · ${iv.timeEstimate}`}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Related reading — published articles on relationships */}
        <RelatedReading heading={t.relatedHeading} />

        {/* Actions */}
        <View className="gap-2.5 pt-2">
          <Button variant="primary" onPress={onSave} disabled={saved} className="w-full">
            {saved ? t.saved : t.save}
          </Button>
          <View className="flex-row gap-2.5">
            <Button variant="secondary" onPress={onViewHistory} className="flex-1">
              {t.viewHistory}
            </Button>
            <Button variant="ghost" onPress={onRetake} className="flex-1">
              {t.retake}
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
