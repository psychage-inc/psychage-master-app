// Drift guard for the 30-term person-first sensitivity list (Sacred Rule #5).
// PEAF's quality gate and the sensitivity module MUST scan the identical set —
// PEAF previously carried its own copy, which could drift silently. The list now
// has a single source (sensitivity/terms.ts, re-exported by peaf/constants.ts);
// this test pins the two public surfaces to the same terms so a future re-copy
// or one-sided edit fails loudly.

import { describe, expect, it } from 'vitest';

import { SENSITIVITY_TERMS as PEAF_TERMS } from '@/lib/article-framework/constants';
import { SENSITIVITY_TERMS as SENSITIVITY_MODULE_TERMS } from '../../sensitivity/terms';

describe('sensitivity term list — single source across peaf and sensitivity', () => {
  it('the PEAF surface and the sensitivity module expose the identical term set', () => {
    expect(PEAF_TERMS).toEqual(SENSITIVITY_MODULE_TERMS);
  });

  it('the canonical list holds the documented 30 terms', () => {
    expect(SENSITIVITY_MODULE_TERMS).toHaveLength(30);
  });
});
