// CT4 FIXTURE — Relationship Health user-facing copy. Centralized here (no real
// i18n catalog yet; packages/i18n is not created) so the screens stay free of
// inline strings and a later lift to i18next is mechanical. Educational framing
// throughout (SR-3): never tells the user what they "are" — only reflects back
// their responses and points to resources.
const FIXTURE = 'FIXTURE — not final copy' as const;

export const CT4_RELATIONSHIP = {
  _fixture: 'CT4' as const,
  _marker: FIXTURE,

  title: 'Relationship Health',
  back: 'Back',
  helpNow: 'Help now',

  landing: {
    heading: 'Take stock of your connections',
    intro:
      'A structured reflection grounded in validated relationship science. It looks at the health of your connections across four areas of life. Educational, not diagnostic.',
    info: [
      {
        title: 'What it looks at',
        body: '17 sub-dimensions across four relationship areas, drawn from Gottman, EFT, and attachment research.',
      },
      {
        title: 'How it works',
        body: 'Up to 34 short statements rated on a simple scale. It surfaces patterns like the Four Horsemen and pursue-withdraw cycles.',
      },
      {
        title: 'What to expect',
        body: 'Around 5–10 minutes. You receive an overall score, area breakdowns, patterns, and evidence-based next steps.',
      },
    ],
    chooseHeading: 'Start here: are you with a partner?',
    chooseSub: 'Your answer sets which relationship areas you reflect on.',
    withPartner: { title: 'I have a partner', sub: '34 statements · 4 areas' },
    withoutPartner: { title: 'Not currently', sub: '24 statements · 3 areas' },
    timeNote: 'Takes about 5 minutes. Your answers stay on this device.',
    viewHistory: 'View past reflections',
    disclaimerHeading: 'Before you begin',
    disclaimer: [
      'This is not a diagnostic tool — it is a self-reflection exercise grounded in validated research.',
      'Your responses stay on this device and are never sent to a server.',
      'Results are educational and cannot replace a professional assessment.',
      'If you are in an unsafe situation, tap Help now at any time for support resources.',
      'Use this as a starting point for self-awareness — not a final answer.',
    ],
  },

  wizard: {
    of: 'of',
    skipQuestion: 'Skip',
    next: 'Next',
    finish: 'See results',
    cancel: 'Cancel',
    areaLabel: {
      partner: 'Romantic Partner',
      family: 'Family',
      friends: 'Friends',
      community: 'Community',
    },
  },

  results: {
    overallHeading: 'Overall connection',
    areasHeading: 'By area',
    whatThisMeansHeading: 'What this means',
    howAffectsHeading: 'How it affects you',
    howToImproveHeading: 'How to improve',
    relatedHeading: 'Related reading',
    // Plain-language, educational read of the composite tier (SR-3: reflects
    // responses, never asserts a condition). Shown above the generated narrative.
    meaning: {
      thriving:
        'Your responses point to strong, supportive connections across the areas you reflected on. Connections like these are a common foundation for resilience — worth tending so they stay strong.',
      healthy:
        'Your responses suggest a solid base of connection, with one or two areas that could use more care. Small, steady investment in those areas is a common way people deepen the relationships that matter.',
      mixed:
        'Your responses show a mixed picture — some connections feel steady while others feel less certain. This is common, and it often points to a specific area worth a little focused attention.',
      strained:
        'Your responses suggest several connections feel strained right now. Many people move through stretches like this; the breakdown below points to where small changes tend to help most.',
      isolated:
        'Your responses suggest connection feels thin across most areas at the moment. Feeling this way is more common than it seems, and reaching out — even in a small way — is often where people start.',
    },
    noPatterns:
      'No specific patterns stood out in your responses. The area breakdown above is a good place to notice what shapes how connected things feel day to day.',
    save: 'Save reflection',
    saved: 'Saved',
    retake: 'Start over',
    viewHistory: 'Past reflections',
  },

  safety: {
    title: 'You’re not alone',
    body: 'Some of your responses suggest you may be going through difficulty in a relationship. Whatever you are facing, support is available — and reaching out is a sign of strength.',
    dvTitle: 'National DV Hotline',
    dvSub: '1-800-799-7233 (24/7, confidential)',
    dvTel: 'tel:18007997233',
    textTitle: 'Text support',
    textSub: 'Text START to 88788',
    textSms: 'sms:88788?body=START',
    moreTitle: 'More support resources',
    moreSub: 'See all available options',
    dismiss: 'Continue to my results',
    bannerLead: 'Support is available.',
    bannerBody: 'If you or someone you know is in an unsafe situation, tap Help now for confidential resources.',
    // Isolation variant (PR-029) — shown when ONLY the social-isolation alert fired.
    // The DV hotline is the wrong first resource for a lonely, no-partner user;
    // this variant offers general support lines instead. NEEDS_CLINICAL_REVIEW.
    isolationTitle: 'Connection can grow again',
    isolationBody:
      'Some of your responses suggest you may be feeling disconnected from the people around you. Feeling this way is more common than it seems, and support is available.',
    lifelineTitle: '988 Suicide & Crisis Lifeline',
    lifelineSub: 'Call or text 988 — free, 24/7, confidential',
    lifelineTel: 'tel:988',
  },

  history: {
    title: 'Past reflections',
    empty: 'No saved reflections yet. Complete a reflection to keep it here, on this device.',
    delete: 'Delete',
    startNew: 'Start a new reflection',
    onDevice: 'Saved on this device only.',
  },
} as const;
