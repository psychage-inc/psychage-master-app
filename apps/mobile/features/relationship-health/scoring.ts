import { checkDVSafety, checkSocialIsolation } from './alerts';
import { generateBlueprint } from './narrative';
import { detectPatterns } from './patterns';
import { getSubDimensionQuestions, QUESTIONS } from './questions';
import {
  type DomainScores,
  type FourHorsemenResult,
  type RelationshipDomain,
  type RelationshipHealthResult,
  type RelationshipTier,
  type SubDimension,
  type SubDimensionScores,
  SUB_DIMENSION_META,
} from './types';

const DOMAINS: RelationshipDomain[] = ['partner', 'family', 'friends', 'community'];

// ── Domain scoring (preserved logic) ────────────────────────────────────────

/**
 * Compute the score for a single domain (0–100).
 * Reverse-scored items are inverted (6 - rawValue).
 *
 * PR-020: scored over ANSWERED items only. The web port assumed complete answers
 * and defaulted every missing item to neutral 3; mobile's Skip button records
 * nothing, so skipped items were silently scored as real "Neutral" responses —
 * dragging genuine answers toward 50 and fabricating data the user never gave.
 * A domain with zero answered items falls back to 50 (the same value the old
 * all-defaults path produced), and the flow refuses to build a result from a
 * fully skipped run before scoring is ever reached.
 */
export function computeDomainScore(
  answers: Record<string, number>,
  domain: RelationshipDomain,
): number {
  const domainQuestions = QUESTIONS.filter((q) => q.domain === domain);
  const answered = domainQuestions.filter((q) => answers[q.id] !== undefined);
  if (answered.length === 0) return domainQuestions.length === 0 ? 0 : 50;

  let total = 0;
  for (const q of answered) {
    const raw = answers[q.id] as number;
    const value = q.reverseScored ? 6 - raw : raw;
    total += value;
  }

  const min = answered.length; // all 1s
  const max = answered.length * 5; // all 5s
  return Math.round(((total - min) / (max - min)) * 100);
}

/**
 * Compute all domain scores.
 */
export function computeAllDomainScores(answers: Record<string, number>): DomainScores {
  return {
    partner: computeDomainScore(answers, 'partner'),
    family: computeDomainScore(answers, 'family'),
    friends: computeDomainScore(answers, 'friends'),
    community: computeDomainScore(answers, 'community'),
  };
}

/**
 * Compute the composite score (average of active domains).
 */
export function computeCompositeScore(domainScores: DomainScores, skipPartner: boolean): number {
  const activeDomains: RelationshipDomain[] = skipPartner
    ? ['family', 'friends', 'community']
    : DOMAINS;

  const sum = activeDomains.reduce((acc, d) => acc + domainScores[d], 0);
  return Math.round(sum / activeDomains.length);
}

/**
 * Assign a tier based on the composite score.
 */
export function getTier(compositeScore: number): RelationshipTier {
  if (compositeScore >= 80) return 'thriving';
  if (compositeScore >= 60) return 'healthy';
  if (compositeScore >= 40) return 'mixed';
  if (compositeScore >= 20) return 'strained';
  return 'isolated';
}

// ── Sub-dimension scoring ────────────────────────────────────────────────────

/**
 * Compute the score for a single sub-dimension (0–100).
 * Each sub-dimension has exactly 2 items.
 */
export function computeSubDimensionScore(
  answers: Record<string, number>,
  subDimension: SubDimension,
): number {
  const items = getSubDimensionQuestions(subDimension);
  // PR-020: answered items only — see computeDomainScore.
  const answered = items.filter((q) => answers[q.id] !== undefined);
  if (answered.length === 0) return items.length === 0 ? 0 : 50;

  let total = 0;
  for (const q of answered) {
    const raw = answers[q.id] as number;
    const value = q.reverseScored ? 6 - raw : raw;
    total += value;
  }

  const min = answered.length; // all 1s
  const max = answered.length * 5; // all 5s
  return Math.round(((total - min) / (max - min)) * 100);
}

/**
 * Compute all sub-dimension scores grouped by domain.
 */
export function computeAllSubDimensionScores(
  answers: Record<string, number>,
): SubDimensionScores {
  const result: Record<RelationshipDomain, Record<string, number>> = {
    partner: {},
    family: {},
    friends: {},
    community: {},
  };

  for (const meta of SUB_DIMENSION_META) {
    result[meta.domain][meta.key] = computeSubDimensionScore(answers, meta.key);
  }

  return result as unknown as SubDimensionScores;
}

// ── Four Horsemen scoring (partner only) ─────────────────────────────────────

/**
 * Compute Four Horsemen risk indicators from partner conflict/appreciation items.
 *
 * Mapping:
 * - Criticism: p_cq_01 (forward) — low score = criticism present
 * - Stonewalling: p_cq_02 (forward) — low score = stonewalling present
 * - Contempt: p_ap_02 (reverse) — high raw = contempt present
 * - Defensiveness: derived from p_cq_02 (shares item with stonewalling)
 *
 * Score interpretation: 1-2 = not detected, 3 = mild, 4-5 = present
 */
export function computeFourHorsemen(answers: Record<string, number>): FourHorsemenResult {
  // PR-020: a horseman can only be detected from an ANSWERED item. The old
  // `?? 3` default scored every skipped item as 3 (= mild), so skipping all
  // conflict items fabricated mildCount=4 and a "Mild Conflict Pattern" card
  // from zero answers. A skipped item now contributes score 1 (= not detected)
  // and is excluded from the mild/active counts.
  const criticismRaw = answers.p_cq_01;
  const stonewallingRaw = answers.p_cq_02;
  const contemptRaw = answers.p_ap_02;

  // Transform: for forward-scored items, lower response = higher horseman risk
  const criticismScore = criticismRaw === undefined ? 1 : 6 - criticismRaw;
  const stonewallingScore = stonewallingRaw === undefined ? 1 : 6 - stonewallingRaw;
  const contemptScore = contemptRaw ?? 1; // already reverse in question bank — raw high = contempt
  // Defensiveness shares signal with stonewalling (same item captures both)
  const defensivenessScore = stonewallingScore;

  const answeredScores = [
    ...(criticismRaw === undefined ? [] : [criticismScore]),
    ...(contemptRaw === undefined ? [] : [contemptScore]),
    ...(stonewallingRaw === undefined ? [] : [defensivenessScore, stonewallingScore]),
  ];
  const presentThreshold = 4;
  const mildThreshold = 3;

  const activeCount = answeredScores.filter((s) => s >= presentThreshold).length;
  const mildCount = answeredScores.filter((s) => s >= mildThreshold).length;

  let overallRisk: 'low' | 'moderate' | 'elevated' = 'low';
  if (activeCount > 0 || contemptScore >= presentThreshold) {
    overallRisk = 'elevated';
  } else if (mildCount > 0) {
    overallRisk = 'moderate';
  }

  return {
    criticism: { score: criticismScore, present: criticismScore >= presentThreshold },
    contempt: { score: contemptScore, present: contemptScore >= presentThreshold },
    defensiveness: { score: defensivenessScore, present: defensivenessScore >= presentThreshold },
    stonewalling: { score: stonewallingScore, present: stonewallingScore >= presentThreshold },
    overallRisk,
    activeCount,
  };
}

// ── Full result computation ─────────────────────────────────────────────────

const TIER_LABELS: Record<RelationshipTier, string> = {
  thriving: 'Strong connections across your life',
  healthy: 'Solid foundation with areas to nurture',
  mixed: 'A mixed picture with room to grow',
  strained: 'There are some areas to explore',
  isolated: 'Reaching out could make a real difference',
};

/**
 * The deterministic part of a result — everything EXCEPT the persistence-stamped
 * `id` and `createdAt`. PURITY FIX vs web: the web `computeResult` minted those
 * inline via `crypto.randomUUID()` + `new Date()`, which (a) breaks deterministic
 * testing and (b) is not available in RN without a polyfill. Here the store stamps
 * them via the injected IdFactory + Clock seam (apps/mobile CLAUDE.md convention #3),
 * exactly as the check-in RecordStore does.
 */
export type ComputedRelationshipResult = Omit<RelationshipHealthResult, 'id' | 'createdAt'>;

/**
 * Compute the full assessment result from raw answers. Deterministic and pure —
 * same answers + skipPartner always yield the same result.
 */
export function computeResult(
  answers: Record<string, number>,
  skipPartner: boolean,
): ComputedRelationshipResult {
  const domainScores = computeAllDomainScores(answers);
  const subDimensionScores = computeAllSubDimensionScores(answers);
  const compositeScore = computeCompositeScore(domainScores, skipPartner);
  const tier = getTier(compositeScore);

  const fourHorsemen = skipPartner ? null : computeFourHorsemen(answers);

  const dvAlert = skipPartner
    ? { triggered: false, severity: 'warning' as const }
    : checkDVSafety(
        answers,
        domainScores.partner,
        subDimensionScores.partner.trust_safety,
        fourHorsemen,
      );

  const isolationAlert = checkSocialIsolation(compositeScore, domainScores, skipPartner);

  const patterns = detectPatterns(
    domainScores,
    subDimensionScores,
    fourHorsemen,
    answers,
    skipPartner,
  );

  const blueprint = generateBlueprint(
    compositeScore,
    tier,
    domainScores,
    subDimensionScores,
    patterns,
    fourHorsemen,
    skipPartner,
  );

  return {
    version: 2,
    compositeScore,
    domainScores,
    subDimensionScores,
    tier,
    tierLabel: TIER_LABELS[tier],
    skipPartner,
    answers,
    dvAlert,
    isolationAlert,
    patterns,
    fourHorsemen,
    blueprint,
  };
}
