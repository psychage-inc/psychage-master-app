// Content taxonomy integrity — every cross-reference between categories must
// resolve. Category 22 was merged into Category 31, and a stale `22` in a
// relatedCategories list produced a dead link (getCategoryByNumber(22) is
// undefined). This guard fails on any future merge that leaves a dangling number.

import { describe, expect, it } from 'vitest';

import {
  CONTENT_CATEGORIES,
  getCategoryByNumber,
} from '@/lib/article-framework/content-architecture';

describe('CONTENT_CATEGORIES — relatedCategories integrity', () => {
  it('every relatedCategories entry resolves via getCategoryByNumber (no dead links)', () => {
    for (const category of CONTENT_CATEGORIES) {
      for (const related of category.relatedCategories) {
        expect(
          getCategoryByNumber(related),
          `category ${category.number} (${category.slug}) references missing category ${related}`,
        ).toBeDefined();
      }
    }
  });

  it('no category lists itself as related', () => {
    for (const category of CONTENT_CATEGORIES) {
      expect(
        category.relatedCategories.includes(category.number),
        `category ${category.number} (${category.slug}) references itself`,
      ).toBe(false);
    }
  });
});
