import { describe, expect, it } from 'vitest';

import {
  computeAllDomainScores,
  computeAllSubDimensionScores,
  computeCompositeScore,
  computeDomainScore,
  computeFourHorsemen,
  computeResult,
  computeSubDimensionScore,
  getTier,
} from '@/features/relationship-health/scoring';
import { QUESTIONS } from '@/features/relationship-health/questions';

// Build answers so every item's EFFECTIVE (post-reverse) value equals `effective`:
// forward items get `effective`, reverse items get `6 - effective` (which inverts
// back to `effective`). So effective=5 → every domain 100, effective=1 → 0.
function answersEffective(effective: number): Record<string, number> {
  const a: Record<string, number> = {};
  for (const q of QUESTIONS) a[q.id] = q.reverseScored ? 6 - effective : effective;
  return a;
}

// All raw answers equal `raw` (reverse items NOT compensated).
function answersRaw(raw: number): Record<string, number> {
  const a: Record<string, number> = {};
  for (const q of QUESTIONS) a[q.id] = raw;
  return a;
}

describe('relationship scoring — domain/composite/sub-dimension', () => {
  it('all effective-5 answers yield 100 across every domain and composite', () => {
    const a = answersEffective(5);
    expect(computeAllDomainScores(a)).toEqual({ partner: 100, family: 100, friends: 100, community: 100 });
    expect(computeCompositeScore(computeAllDomainScores(a), false)).toBe(100);
  });

  it('all effective-1 answers yield 0 across every domain and composite', () => {
    const a = answersEffective(1);
    expect(computeAllDomainScores(a)).toEqual({ partner: 0, family: 0, friends: 0, community: 0 });
    expect(computeCompositeScore(computeAllDomainScores(a), false)).toBe(0);
  });

  it('neutral raw-3 answers yield 50 (reverse items invert to 3 too)', () => {
    const a = answersRaw(3);
    expect(computeAllDomainScores(a)).toEqual({ partner: 50, family: 50, friends: 50, community: 50 });
    expect(computeCompositeScore(computeAllDomainScores(a), false)).toBe(50);
  });

  it('reverse-scored items are inverted (6 - raw)', () => {
    // p_ap_02 is the only reverse item in the partner appreciation sub-dimension.
    // p_ap_01 forward=5, p_ap_02 raw=1 → value 5 → sub score 100.
    const a = answersRaw(3);
    a.p_ap_01 = 5;
    a.p_ap_02 = 1;
    expect(computeSubDimensionScore(a, 'appreciation')).toBe(100);
    // Flip: forward low, reverse high → 0.
    a.p_ap_01 = 1;
    a.p_ap_02 = 5;
    expect(computeSubDimensionScore(a, 'appreciation')).toBe(0);
  });

  it('a fully unanswered domain falls back to 50 (explicit, not fabricated per-item)', () => {
    expect(computeDomainScore({}, 'family')).toBe(50);
  });

  it('PR-020: skipped items are EXCLUDED, not scored as neutral 3', () => {
    // One strong answer + everything else skipped must score that answer alone
    // (100), not be dragged toward 50 by fabricated neutrals.
    const family = QUESTIONS.filter((q) => q.domain === 'family');
    const first = family[0];
    if (!first) throw new Error('no family questions');
    const answers = { [first.id]: first.reverseScored ? 1 : 5 };
    expect(computeDomainScore(answers, 'family')).toBe(100);
  });

  it('skipPartner averages only the 3 non-partner domains', () => {
    const a = answersEffective(5);
    for (const q of QUESTIONS) if (q.domain === 'partner') a[q.id] = q.reverseScored ? 5 : 1; // partner → 0
    const ds = computeAllDomainScores(a);
    expect(ds.partner).toBe(0);
    expect(computeCompositeScore(ds, true)).toBe(100); // (100+100+100)/3
    expect(computeCompositeScore(ds, false)).toBe(75); // (0+100+100+100)/4
  });

  it('sub-dimension scores cover all 17 keys', () => {
    const sub = computeAllSubDimensionScores(answersRaw(3));
    expect(Object.keys(sub.partner)).toHaveLength(5);
    expect(Object.keys(sub.family)).toHaveLength(4);
    expect(Object.keys(sub.friends)).toHaveLength(4);
    expect(Object.keys(sub.community)).toHaveLength(4);
  });
});

describe('relationship scoring — tier thresholds', () => {
  it('maps composite scores to tiers at the exact boundaries', () => {
    expect(getTier(80)).toBe('thriving');
    expect(getTier(79)).toBe('healthy');
    expect(getTier(60)).toBe('healthy');
    expect(getTier(59)).toBe('mixed');
    expect(getTier(40)).toBe('mixed');
    expect(getTier(39)).toBe('strained');
    expect(getTier(20)).toBe('strained');
    expect(getTier(19)).toBe('isolated');
    expect(getTier(0)).toBe('isolated');
  });
});

describe('relationship scoring — Four Horsemen', () => {
  it('PR-020: skipped conflict items detect nothing (no fabricated mild pattern)', () => {
    const fh = computeFourHorsemen({});
    expect(fh.overallRisk).toBe('low');
    expect(fh.activeCount).toBe(0);
    expect(fh.criticism.present).toBe(false);
    expect(fh.contempt.present).toBe(false);
    expect(fh.stonewalling.present).toBe(false);
    expect(fh.defensiveness.present).toBe(false);
  });

  it('neutral answers are moderate risk (all scores at the mild threshold)', () => {
    const fh = computeFourHorsemen({ p_cq_01: 3, p_cq_02: 3, p_ap_02: 3 });
    expect(fh.overallRisk).toBe('moderate');
    expect(fh.activeCount).toBe(0);
  });

  it('strong positive answers are low risk', () => {
    const fh = computeFourHorsemen({ p_cq_01: 5, p_cq_02: 5, p_ap_02: 1 });
    expect(fh.overallRisk).toBe('low');
  });

  it('contempt (p_ap_02 high) alone is elevated', () => {
    const fh = computeFourHorsemen({ p_cq_01: 5, p_cq_02: 5, p_ap_02: 5 });
    expect(fh.contempt.present).toBe(true);
    expect(fh.overallRisk).toBe('elevated');
  });

  it('low conflict-quality (criticism present) is elevated', () => {
    const fh = computeFourHorsemen({ p_cq_01: 1, p_cq_02: 3, p_ap_02: 1 });
    expect(fh.criticism.present).toBe(true);
    expect(fh.overallRisk).toBe('elevated');
  });
});

describe('relationship scoring — full result', () => {
  it('skipPartner result has null fourHorsemen and a non-triggered DV alert', () => {
    const r = computeResult(answersEffective(5), true);
    expect(r.fourHorsemen).toBeNull();
    expect(r.dvAlert.triggered).toBe(false);
    expect(r.version).toBe(2);
    // purity: the pure result carries no persistence stamps
    expect((r as Record<string, unknown>).id).toBeUndefined();
    expect((r as Record<string, unknown>).createdAt).toBeUndefined();
  });

  it('with-partner result computes a Four Horsemen block and a blueprint', () => {
    const r = computeResult(answersEffective(5), false);
    expect(r.fourHorsemen).not.toBeNull();
    expect(r.tier).toBe('thriving');
    expect(r.blueprint.length).toBeGreaterThan(0);
  });
});
