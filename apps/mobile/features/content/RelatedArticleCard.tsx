import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { ArtPanel } from '@/features/learn/ArtPanel';
import type { ArticleListItem } from '@/lib/articles';
import { openArticle } from '@/lib/nav';

// One card in the horizontal "Related reading" rail (P22). Fixed width so several
// sit side by side and swipe; a 16:9 hero (ArtPanel — blur-filled, token gradient
// fallback) over the category + title. Non-scaling type (label/caption) keeps the
// rail layout stable under the reading-text-size setting. Tapping opens the reader.
export const RelatedArticleCard = memo(function RelatedArticleCard({
  article,
}: {
  article: ArticleListItem;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={article.title}
      testID={`related-card-${article.slug}`}
      onPress={() => openArticle(article.slug)}
      className="w-[260px] overflow-hidden rounded-2xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <ArtPanel artKey={article.slug} imageUrl={article.heroImageUrl} className="aspect-[16/9] w-full" />
      <View className="gap-1 px-3 py-3">
        <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
          {article.categoryName}
        </Text>
        <Text variant="label" numberOfLines={2} className="text-text-primary dark:text-text-primary-dark">
          {article.title}
        </Text>
      </View>
    </Pressable>
  );
});
