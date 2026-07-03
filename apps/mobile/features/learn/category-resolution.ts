// Category-id → article-slug-list resolution for the category articles screen.
// Pure (no React Native imports) so it unit-tests under Vitest.
//
// `id` is normally a curated topic id (anxiety | sleep | … | more). When it is not,
// treat it as a raw content category slug (article_categories.slug) so the "all
// categories" list can open ANY of the 30 categories — including the wellness ones
// that have no /conditions overview (P19). Curated ids and content slugs are disjoint.
//
// Third tier (PR-084): the Browse grid's manifest carries slugs that exist in the
// live article_categories table but are NOT in the peaf closed set (e.g.
// neurodivergence-adhd-autism, life-transitions). Resolving only via peaf sent 7 of
// 32 Browse cards to a permanent "No articles here yet" over published content —
// fall through to the manifest so its slug is trusted as-is.

import { getCategoryBySlug } from '@psychage/shared/peaf';

import { BROWSE_CARDS } from '@/features/learn/browse-manifest';
import { getLearnCategory } from '@/features/learn/categories';

export function resolveCategoryArticleList(id: string): {
  slugs: readonly string[];
  title: string;
} {
  const curated = getLearnCategory(id);
  const contentCategory = curated ? undefined : getCategoryBySlug(id);
  const browseCard =
    curated || contentCategory ? undefined : BROWSE_CARDS.find((card) => card.slug === id);
  return {
    slugs:
      curated?.slugs ??
      (contentCategory ? [contentCategory.slug] : browseCard ? [browseCard.slug] : []),
    title: curated?.label ?? contentCategory?.name ?? browseCard?.title ?? 'Articles',
  };
}
