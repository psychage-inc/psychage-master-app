// Maps an article's category to ONE related self-help tool, so the reader offers a
// forward action instead of dead-ending at the references (experience-architecture
// audit H1 — the highest-traffic dead end). Educational, NOT prescriptive: framed as
// "somewhere to go next", never "you have X" (Sacred Rule #2/#3). Pure module — no
// React Native imports, so the mapping is unit-testable under Vitest.
//
// CT4 — labels are placeholders pending Dr. Dobson review (same gate as CT4_CONTENT).

export type ToolIconKey = 'anchor' | 'moon' | 'heart' | 'notebook' | 'compass';

// Route is a literal union (mirrors COMPASS_ROUTES) so router.push() type-checks
// under Expo Router typed routes.
export type RelatedTool = {
  readonly route: '/navigator' | '/toolkit' | '/tools/sleep' | '/tools/relationship-health' | '/';
  readonly label: string;
  readonly sub: string;
  readonly iconKey: ToolIconKey;
};

// Falls back to the Symptom Navigator — the general "make sense of what you feel"
// entry, the right default for an education-first product.
const DEFAULT_TOOL: RelatedTool = {
  route: '/navigator',
  label: 'Make sense of what you’re feeling',
  sub: 'Symptom Navigator',
  iconKey: 'compass',
};

// Keyed by the real `article_categories.slug` (see features/learn/categories.ts).
const BY_CATEGORY = {
  'anxiety-stress': {
    route: '/toolkit',
    label: 'Steady yourself with a short exercise',
    sub: 'Toolkit',
    iconKey: 'anchor',
  },
  'sleep-body-connection': {
    route: '/tools/sleep',
    label: 'Understand your sleep',
    sub: 'Sleep Architect',
    iconKey: 'moon',
  },
  'relationships-social': {
    route: '/tools/relationship-health',
    label: 'Take stock of your connections',
    sub: 'Relationship Health',
    iconKey: 'heart',
  },
  'loneliness-connection': {
    route: '/tools/relationship-health',
    label: 'Take stock of your connections',
    sub: 'Relationship Health',
    iconKey: 'heart',
  },
  'depression-mood': {
    // Mood Journal was folded into Moments (PR #173); '/tools/mood-journal' 404'd (PR-023).
    route: '/',
    label: 'Notice what comes up',
    sub: 'Moments',
    iconKey: 'notebook',
  },
  'emotional-regulation': {
    route: '/',
    label: 'Notice what comes up',
    sub: 'Moments',
    iconKey: 'notebook',
  },
} as const satisfies Readonly<Record<string, RelatedTool>>;

/** The related self-help tool for an article's category, or the Navigator fallback. */
export function toolForCategory(categorySlug: string): RelatedTool {
  return BY_CATEGORY[categorySlug as keyof typeof BY_CATEGORY] ?? DEFAULT_TOOL;
}
