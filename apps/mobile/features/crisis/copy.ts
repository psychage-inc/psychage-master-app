// Crisis surface copy (Flow 6, S11) — VERBATIM from PSYCHAGE_MOBILE_CT4_COPY.md §8.
// PLAIN register, zero whimsy. Externalized from CrisisView (CT4 copy-application
// task). The helpline ROWS themselves are CT3 data (helplines.*.ts), never copy —
// not touched here. EN-only at ship.
//
// FLAGGED divergence (COPY_CONFLICTS_APPLIED.md, List B): `heading` is the shipped,
// clinically-reviewed "Help now." (with period); the deck §8 heading is "Help now"
// (no period). Crisis copy is a required Dr. Dobson review surface, so the shipped
// Flow-Book string is preserved verbatim and the period is flagged, not silently cut.
export const CRISIS_COPY = {
  heading: 'Help now.', // §8 [FINAL] — period flagged vs deck "Help now"
  lead:
    'If you are in danger, or thinking about ending your life, you deserve help right now. You are not alone in this.', // §8 [FINAL]
  callEmergency: 'Call your local emergency number', // §8 [FINAL]
  helplinesIntro: 'Free, confidential helplines are also available in most countries.', // §8 [FINAL]
  // §8 [FINAL] dataset-gap state. Region is interpolated, not a translatable string.
  gapState: (regionName: string): string =>
    `We don't yet have verified helplines for ${regionName}. Your local emergency number works right now.`,
  // §8 [FINAL] region switch link. Region is interpolated.
  notInRegion: (regionName: string): string => `Not in ${regionName}?`,
  back: 'Back',
} as const;
