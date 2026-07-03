import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { GlobalHeader } from '@/components/GlobalHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { Text } from '@/components/ui/Text';
import { ArticleListCard } from '@/features/content/ArticleListCard';
import { resolveCategoryArticleList } from '@/features/learn/category-resolution';
import { type ArticleListItem, listArticlesByCategorySlugs } from '@/lib/articles';
import { colors } from '@/lib/colors';

// S6→list: a category's real articles (FlashList, ~hundreds at the full corpus).
// Pushed over the tabs, so it renders the GlobalHeader (Help-now pill reachable,
// SR-2) + a native back row itself. Content is fetched live from the shared
// Supabase via TanStack Query — never placeholder. Empty/error states report the
// absence; they never fabricate articles.
export function CategoryArticlesView({ id }: { id: string }) {
  // Resolution chain (curated topic → peaf slug → Browse manifest slug) lives in
  // category-resolution.ts (pure, Vitest-covered — PR-084).
  const { slugs, title } = resolveCategoryArticleList(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['articles', 'category', id],
    queryFn: () => listArticlesByCategorySlugs(slugs),
    enabled: slugs.length > 0,
  });

  const articles = data ?? [];

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <GlobalHeader />
      <View className="flex-row items-center px-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={8}
          testID="category-back"
          className="min-h-[44px] flex-row items-center gap-1 px-2"
        >
          <ChevronLeft size={20} color={colors.charcoal[600]} strokeWidth={2} />
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            Back
          </Text>
        </Pressable>
      </View>

      <FlashList
        data={articles}
        keyExtractor={(item: ArticleListItem) => item.slug}
        contentContainerClassName="px-4 pb-12"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <Text variant="h1" className="py-3">
            {title}
          </Text>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center py-12">
              <AppLoader />
            </View>
          ) : (
            <Text
              variant="body"
              className="px-1 py-8 text-center text-text-secondary dark:text-text-secondary-dark"
            >
              {isError
                ? 'These articles could not be loaded right now. Please try again.'
                : 'No articles here yet.'}
            </Text>
          )
        }
        renderItem={({ item }: { item: ArticleListItem }) => <ArticleListCard article={item} />}
      />
    </View>
  );
}
