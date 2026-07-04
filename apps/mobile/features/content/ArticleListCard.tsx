import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { ArtPanel } from '@/features/learn/ArtPanel';
import type { ArticleListItem } from '@/lib/articles';
import { openArticle } from '@/lib/nav';

// One article card in a category/search list — a single unified card where the
// image and its information belong together: a 16:9 hero (blur-filled, uncropped
// via ArtPanel; token gradient as fallback) with an integrated rectangular info
// container of the SAME width carrying only the sub-title (seoDescription).
// Tapping opens the native reader (S22). memo'd — FlashList re-renders on scroll.
export const ArticleListCard = memo(function ArticleListCard({ article }: { article: ArticleListItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={article.title}
      testID={`article-card-${article.slug}`}
      onPress={() => openArticle(article.slug)}
      className="overflow-hidden rounded-2xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <ArtPanel artKey={article.slug} imageUrl={article.heroImageUrl} className="aspect-[16/9] w-full" />
      {article.seoDescription ? (
        <View className="border-t border-border px-4 py-3 dark:border-border-dark">
          <Text
            variant="caption"
            numberOfLines={2}
            className="text-text-secondary dark:text-text-secondary-dark"
          >
            {article.seoDescription}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});
