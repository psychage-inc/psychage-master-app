// PR-084 regression guard: every card on the Learn Browse grid must resolve to a
// non-empty slug list. Before the manifest fall-through, 7 of 32 cards (slugs in
// the live article_categories table but outside the peaf closed set) resolved to
// [] — the article query stayed disabled and the card dead-ended at "No articles
// here yet" over published content.

import { describe, expect, it } from 'vitest';

import { BROWSE_CARDS } from '@/features/learn/browse-manifest';
import { resolveCategoryArticleList } from '@/features/learn/category-resolution';

describe('Browse card category resolution (PR-084)', () => {
  it.each(BROWSE_CARDS.map((card) => [card.slug, card.title]))(
    'card %s resolves to a queryable slug list',
    (slug, title) => {
      const resolved = resolveCategoryArticleList(slug);
      expect(resolved.slugs.length).toBeGreaterThan(0);
      // A resolvable card must never fall back to the generic screen title.
      expect(resolved.title).not.toBe('Articles');
      expect(typeof title).toBe('string');
    },
  );

  it('a truly unknown id still resolves to the disabled/empty state', () => {
    const resolved = resolveCategoryArticleList('definitely-not-a-category');
    expect(resolved.slugs).toEqual([]);
    expect(resolved.title).toBe('Articles');
  });
});
