// Sleep Architect — correlation math. Ported from the Pearson core of psychage-v2
// `calculateSleepMoodCorrelations`, but generalized: web correlated sleep metrics
// against a 4-axis web mood journal. Mobile has no such journal, so this module is
// SOURCE-AGNOSTIC — it correlates two dated numeric series the screen supplies
// (e.g. a sleep metric vs. the entry's own morning_mood, or vs. the local
// check-in series). Pairing is by exact local-date string; no network, no I/O.

export type CorrelationSignificance = 'strong' | 'moderate' | 'weak' | 'none';

export interface DatedValue {
  readonly date: string; // YYYY-MM-DD
  readonly value: number;
}

export interface CorrelationResult {
  readonly coefficient: number; // Pearson r, rounded to 2dp
  readonly sample_size: number; // number of paired days used
  readonly significance: CorrelationSignificance;
}

/** Pearson product-moment correlation. Returns 0 for n < 3 or zero variance. */
export function pearson(x: readonly number[], y: readonly number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  // Truncate both series to the paired length BEFORE computing means — a mean over
  // the full (longer) array would skew the coefficient for unequal-length inputs.
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - meanX;
    const dy = (ys[i] ?? 0) - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  if (denominator === 0) return 0;
  return sumXY / denominator;
}

/** Strength band for an r value (by absolute magnitude). */
export function classifyCorrelation(r: number): CorrelationSignificance {
  const abs = Math.abs(r);
  if (abs >= 0.6) return 'strong';
  if (abs >= 0.4) return 'moderate';
  if (abs >= 0.2) return 'weak';
  return 'none';
}

/**
 * Correlate two dated series by inner-joining on date. Returns null when fewer
 * than `minPairs` days overlap (default 14 — matches the web's sample-size gate),
 * so the screen can show an "keep logging" state instead of a noisy coefficient.
 */
export function correlate(
  seriesA: readonly DatedValue[],
  seriesB: readonly DatedValue[],
  minPairs = 14,
): CorrelationResult | null {
  const byDate = new Map<string, number>();
  for (const point of seriesB) byDate.set(point.date, point.value);

  const a: number[] = [];
  const b: number[] = [];
  for (const point of seriesA) {
    const match = byDate.get(point.date);
    if (match !== undefined) {
      a.push(point.value);
      b.push(match);
    }
  }

  if (a.length < minPairs) return null;

  const r = pearson(a, b);
  return {
    coefficient: Math.round(r * 100) / 100,
    sample_size: a.length,
    significance: classifyCorrelation(r),
  };
}
