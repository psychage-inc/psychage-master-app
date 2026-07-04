import { describe, expect, it } from 'vitest';

import { classifyCorrelation, correlate, type DatedValue, pearson } from '../correlations';

describe('pearson', () => {
  it('is +1 for a perfectly increasing relationship', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
  });

  it('is −1 for a perfectly decreasing relationship', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it('returns 0 for fewer than 3 points or zero variance', () => {
    expect(pearson([1, 2], [1, 2])).toBe(0);
    expect(pearson([5, 5, 5], [1, 2, 3])).toBe(0);
  });

  it('truncates both series to the paired length — trailing extras cannot skew the mean', () => {
    // The old implementation averaged over the FULL longer array while iterating
    // only n pairs, producing a wrong coefficient for unequal-length inputs.
    expect(pearson([1, 2, 3, 1000], [1, 2, 3])).toBe(pearson([1, 2, 3], [1, 2, 3]));
    expect(pearson([1, 2, 3, 1000], [1, 2, 3])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3], [2, 4, 6, -500])).toBeCloseTo(1, 10);
  });
});

describe('classifyCorrelation', () => {
  it('bands by absolute magnitude', () => {
    expect(classifyCorrelation(0.7)).toBe('strong');
    expect(classifyCorrelation(-0.5)).toBe('moderate');
    expect(classifyCorrelation(0.3)).toBe('weak');
    expect(classifyCorrelation(0.1)).toBe('none');
  });
});

describe('correlate — date-joined, sample-gated', () => {
  function series(n: number, fn: (i: number) => number): DatedValue[] {
    return Array.from({ length: n }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      value: fn(i),
    }));
  }

  it('joins two series by date and reports r + sample size', () => {
    const a = series(14, (i) => i);
    const b = series(14, (i) => i * 2 + 1);
    const result = correlate(a, b);
    expect(result).not.toBeNull();
    expect(result?.sample_size).toBe(14);
    expect(result?.coefficient).toBe(1);
    expect(result?.significance).toBe('strong');
  });

  it('returns null when fewer than minPairs days overlap', () => {
    const a = series(10, (i) => i);
    const b = series(10, (i) => i);
    expect(correlate(a, b)).toBeNull(); // default minPairs 14
    expect(correlate(a, b, 10)).not.toBeNull();
  });

  it('only counts dates present in BOTH series', () => {
    const a = series(20, (i) => i);
    // b shares only 12 dates with a (offset start)
    const b = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-06-${String(i + 5).padStart(2, '0')}`,
      value: i,
    }));
    expect(correlate(a, b)).toBeNull(); // 12 overlap < 14
    expect(correlate(a, b, 12)?.sample_size).toBe(12);
  });
});
