import { describe, expect, it } from 'vitest';

import { toolForCategory } from '@/features/content/related-tools';

// H1 content-loop: every article reader ends with a contextual tool. The mapping is
// pure — these pin the category→tool edges and the education-first fallback.
describe('toolForCategory', () => {
  it('maps known categories to their relevant tool', () => {
    expect(toolForCategory('anxiety-stress').route).toBe('/toolkit');
    expect(toolForCategory('sleep-body-connection').route).toBe('/tools/sleep');
    expect(toolForCategory('relationships-social').route).toBe('/tools/relationship-health');
    expect(toolForCategory('loneliness-connection').route).toBe('/tools/relationship-health');
    // PR-023: Mood Journal folded into Moments — the CTA lands on Today ('/').
    expect(toolForCategory('depression-mood').route).toBe('/');
    expect(toolForCategory('emotional-regulation').route).toBe('/');
  });

  it('falls back to the Symptom Navigator for any unmapped category', () => {
    expect(toolForCategory('trauma-healing').route).toBe('/navigator');
    expect(toolForCategory('').route).toBe('/navigator');
  });

  it('never returns diagnostic/prescriptive labels (SR-3, person-first)', () => {
    for (const slug of ['anxiety-stress', 'depression-mood', 'unmapped']) {
      const label = toolForCategory(slug).label.toLowerCase();
      expect(label).not.toContain('you have');
      expect(label).not.toContain('diagnos');
    }
  });
});
