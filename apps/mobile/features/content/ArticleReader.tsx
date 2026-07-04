import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';

import { GlobalHeader } from '@/components/GlobalHeader';
import { ScreenEntrance } from '@/components/ui/ScreenEntrance';
import { AppLoader } from '@/components/ui/AppLoader';
import { Text } from '@/components/ui/Text';
import { BookmarkSaveSlot } from '@/features/bookmarks/BookmarkSaveSlot';
import { ArticleBody } from '@/features/content/blocks/ArticleBody';
import { ArticleNextSteps } from '@/features/content/ArticleNextSteps';
import { ListenButton } from '@/features/content/ListenButton';
import { buildReadAloudSegments } from '@/features/content/read-aloud';
import { ArtPanel } from '@/features/learn/ArtPanel';
import { Citations } from '@/features/content/Citations';
import { CT4_CONTENT } from '@/features/content/copy';
import { MedicalDisclaimer } from '@/features/content/MedicalDisclaimer';
import { ReviewedByCredit } from '@/features/content/ReviewedByCredit';
import { getArticleBySlug } from '@/lib/articles';
import { goBackOr } from '@/lib/nav';
import { useReadingProgressTracker } from '@/lib/reading-progress-tracker';
import { ReadingTextSizeProvider } from '@/lib/reading-text-size-context';
import { useThemeColors } from '@/lib/use-theme-colors';

// S22 Article reader — NATIVE chrome + NATIVE body. Pushed over the tabs, so it
// renders the GlobalHeader itself (Help-now pill reachable, SR-2) plus a native
// back row. Article CONTENT is the real, clinician-reviewed body fetched live from
// the shared Supabase and rendered verbatim via ArticleBody (HTML → native PEAF
// blocks), inside the ReadingTextSizeProvider so the reader's text-size control
// applies. The byline mirrors the web exactly: author "Psychage Team · Editor"
// plus the full Dr. Dobson reviewer credit (ReviewedByCredit, the single
// enforcement point). An educational MedicalDisclaimer (SR-3) sits above the body
// and the article's References (article_citations) render below it. A missing
// article reports its absence — never placeholder prose.
export function ArticleReader({ slug }: { slug: string }) {
  const t = CT4_CONTENT;
  const tc = useThemeColors();

  const { data: article, isLoading } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => getArticleBySlug(slug),
    enabled: slug.length > 0,
  });

  // Record real reading progress as the user scrolls, tagged with the title +
  // read-time so the Today "Pick up where you left off" rail renders real data.
  const { onScroll } = useReadingProgressTracker(slug, {
    title: article?.title,
    readTime: article?.readTime ?? undefined,
  });

  // P21 — ordered read-aloud segments (title → subtitle → every body block).
  const listenSegments = useMemo(
    () =>
      article
        ? buildReadAloudSegments({
            title: article.title,
            subtitle: article.subtitle,
            contentHtml: article.contentHtml,
          })
        : [],
    [article],
  );

  const scrollProgressVal = useSharedValue(0);

  const runOnScrollJS = (offsetY: number, contentHeight: number, layoutHeight: number) => {
    // Rebuilt from the worklet's scalars — only the fields the tracker reads exist.
    const fakeEvent = {
      nativeEvent: {
        contentOffset: { y: offsetY, x: 0 },
        contentSize: { height: contentHeight, width: 0 },
        layoutMeasurement: { height: layoutHeight, width: 0 },
      },
    } as unknown as NativeSyntheticEvent<NativeScrollEvent>;
    onScroll(fakeEvent);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const offsetY = event.contentOffset.y;
      const contentHeight = event.contentSize.height;
      const layoutHeight = event.layoutMeasurement.height;
      const scrollable = contentHeight - layoutHeight;
      let progress = 0;
      if (scrollable > 0) {
        progress = offsetY / scrollable;
      } else {
        progress = 1;
      }
      scrollProgressVal.value = Math.max(0, Math.min(1, progress));
      runOnJS(runOnScrollJS)(offsetY, contentHeight, layoutHeight);
    },
  });

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${scrollProgressVal.value * 100}%`,
    };
  });

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <GlobalHeader />
      <View className="flex-row items-center justify-between px-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.back}
          onPress={() => goBackOr('/learn')}
          hitSlop={8}
          testID="article-back"
          className="min-h-[44px] flex-row items-center gap-1 px-2 active:scale-[0.96]"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ChevronLeft size={20} color={tc.inkSecondary} strokeWidth={2} />
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            {t.back}
          </Text>
        </Pressable>
        {/* Save this article — resource_id is the slug (T-007). */}
        <BookmarkSaveSlot resourceType="article" resourceId={slug} testID="article-save" />
      </View>

      <View className="h-1 w-full bg-border/20 dark:bg-border-dark/20 overflow-hidden" testID="reading-progress-container">
        <Animated.View
          style={[
            { height: '100%' },
            animatedProgressStyle,
          ]}
          className="bg-primary dark:bg-primary-dark"
          testID="reading-progress-bar"
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center" testID="article-loading">
          <AppLoader />
        </View>
      ) : !article ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text
            variant="body"
            className="text-center text-text-secondary dark:text-text-secondary-dark"
          >
            This article isn’t available.
          </Text>
        </View>
      ) : (
        <ReadingTextSizeProvider>
          <Animated.ScrollView
            contentContainerClassName="gap-3 px-5 pb-12"
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            <ScreenEntrance staggerMs={80}>
              {article.heroImageUrl ? (
                <ArtPanel
                  artKey={article.slug}
                  imageUrl={article.heroImageUrl}
                  className="aspect-[16/9] rounded-xl"
                />
              ) : null}

              <View className="flex-row items-center gap-2">
                <Text
                  variant="caption"
                  className="rounded-full bg-surface-active px-2 py-0.5 text-text-secondary dark:bg-surface-active-dark dark:text-text-secondary-dark"
                >
                  {article.categoryName}
                </Text>
                {article.readTime ? (
                  <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
                    {`${article.readTime} min read`}
                  </Text>
                ) : null}
              </View>

              <Text variant="h1">{article.title}</Text>
              {article.subtitle ? (
                <Text
                  variant="bodyLarge"
                  className="text-text-secondary dark:text-text-secondary-dark"
                >
                  {article.subtitle}
                </Text>
              ) : null}

              <View className="gap-0.5">
                <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                  {`${article.authorName} · ${article.authorRole}`}
                </Text>
                <ReviewedByCredit />
              </View>

              <MedicalDisclaimer />

              <ListenButton segments={listenSegments} />

              <ArticleBody html={article.contentHtml} />

              <Citations items={article.citations} />

              <ArticleNextSteps
                slug={article.slug}
                categorySlug={article.categorySlug}
                tags={article.tags}
              />
            </ScreenEntrance>
          </Animated.ScrollView>
        </ReadingTextSizeProvider>
      )}
    </View>
  );
}
