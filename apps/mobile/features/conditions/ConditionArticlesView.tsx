import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { View } from 'react-native';

import { GlobalHeader } from '@/components/GlobalHeader';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { AppLoader } from '@/components/ui/AppLoader';
import { Text } from '@/components/ui/Text';
import { ArticleListCard } from '@/features/content/ArticleListCard';
import { CONDITIONS_COPY } from '@/features/conditions/copy';
import { useConditionArticles, useConditionGuide } from '@/lib/conditions/hooks';
import type { ArticleListItem } from '@/lib/articles';
import { colors } from '@/lib/colors';

// "See all" target for a condition's related articles (/conditions/[slug]/articles),
// mirroring the web ConditionArticlesPage: the full condition↔article join (vs the
// guide's top-6 preview). Pushed route → GlobalHeader (Help-now, SR-2) + back row.
// Articles read live via the linked_condition_ids join; FlashList for the list.
export function ConditionArticlesView({ slug }: { slug: string }) {
  const t = CONDITIONS_COPY;
  const { data: condition, isLoading: guideLoading } = useConditionGuide(slug);
  const { data: articles, isLoading: articlesLoading } = useConditionArticles(condition?.id);

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <GlobalHeader />
      <View className="flex-row items-center px-2">
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={t.back}
          onPress={() => router.back()}
          hitSlop={8}
          testID="condition-articles-back"
          className="min-h-[44px] flex-row items-center gap-1 px-2"
          haptic="tab"
        >
          <ChevronLeft size={20} color={colors.charcoal[600]} strokeWidth={2} />
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            {t.back}
          </Text>
        </AnimatedPressable>
      </View>

      {condition == null ? (
        // Guide still resolving = loading (the articles query is disabled until the
        // id resolves, so its isLoading alone would flash the empty state); a resolved
        // miss (unknown slug) gets a real not-found, mirroring ConditionGuideView.
        guideLoading ? (
          <View className="items-center py-12">
            <AppLoader label="Loading articles" />
          </View>
        ) : (
          <View className="px-5 pt-4" testID="condition-articles-not-found">
            <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark">
              {t.notFound}
            </Text>
          </View>
        )
      ) : (
        <FlashList
          data={articles ?? []}
          keyExtractor={(item: ArticleListItem) => item.slug}
          contentContainerClassName="px-5 pb-12"
          ItemSeparatorComponent={() => <View className="h-3.5" />}
          ListHeaderComponent={
            <View className="gap-1.5 pb-4">
              <Text variant="h1">{condition.name}</Text>
              <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark">
                {t.articlesIntro}
              </Text>
            </View>
          }
          ListEmptyComponent={
            articlesLoading ? (
              <View className="items-center py-12">
                <AppLoader label="Loading articles" />
              </View>
            ) : (
              <Text variant="body" className="py-10 text-center text-text-tertiary dark:text-text-tertiary-dark">
                {t.articlesEmpty}
              </Text>
            )
          }
          renderItem={({ item }: { item: ArticleListItem }) => <ArticleListCard article={item} />}
        />
      )}
    </View>
  );
}
