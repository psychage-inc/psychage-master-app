// CT4 FIXTURE — Sleep Architect copy. NOT final wording. Every user-facing string
// that touches sleep "quality" is framed as optimization/education, never a
// verdict or diagnosis (SR-1 / SR-3) — flagged for Dr. Dobson clinical review
// before ship. The composite score is surfaced only as one of four bands; no
// number, gauge, or percentage bar ever reaches the UI (SR-1).
import type { SleepScoreBand } from '@psychage/shared/sleep';

const FIXTURE = 'FIXTURE — not final copy' as const;

export const CT4_SLEEP = {
  _fixture: 'CT4' as const,
  _marker: FIXTURE,

  title: 'Sleep Architect',
  tagline: 'Understand your nights — gently, on your terms',

  // 4-tab IA (P58 redesign): the former Overview, Patterns and Insights tabs are
  // folded into one scrollable Home; Diary, Tools and Wind-down stay. Four items fit
  // without the old horizontal-scroll overflow.
  tabs: {
    home: 'Home',
    diary: 'Diary',
    tools: 'Tools',
    windDown: 'Wind-down',
  },

  // Home tab CTAs. The primary "Log last night" reuses diary.logToday; export is the
  // user-initiated PDF / therapist share (P59), shown only once there is data to share.
  home: {
    exportCta: 'Export / share',
  },

  // Export & share (P59). A PDF the person generates on demand and shares THEMSELVES
  // via the system share sheet — Psychage never transmits it (SR-4). All CT4 — flagged
  // for Dr. Dobson before ship. No diagnostic language; no score number (SR-1).
  export: {
    title: 'Export & share',
    intro:
      'Make a PDF of your logged nights to keep or take to a provider. You pick the range and share it yourself — Psychage never sends it anywhere.',
    nameLabel: 'Your full name',
    nameHint: 'Your provider files the summary by this name',
    rangeLabel: 'What to include',
    range7: 'Last 7 days',
    range30: 'Last 30 days',
    range90: 'Last 90 days',
    rangeAll: 'All nights',
    generate: 'Generate & share',
    cancel: 'Cancel',
    countLine: (nights: number) =>
      `${nights} ${nights === 1 ? 'night' : 'nights'} logged in this range`,
    empty: 'No nights logged in this range yet.',

    // ── PDF document strings (print artifact; plain, factual, non-verdict) ──
    pdfTitle: 'Sleep summary',
    pdfGenerated: (stamp: string) => `Generated ${stamp}`,
    pdfNightsLine: (nights: number) =>
      `${nights} ${nights === 1 ? 'night' : 'nights'} logged`,
    pdfAveragesHeading: 'Typical across these nights',
    pdfNightsHeading: 'Night by night',
    pdfAvgLength: 'Typical length',
    pdfAvgEfficiency: 'Time asleep in bed',
    pdfAvgLatency: 'Time to fall asleep',
    pdfAvgQuality: 'How rested',
    pdfAvgMood: 'Morning mood',
    pdfColDate: 'Date',
    pdfColInBed: 'In bed → out',
    pdfColLength: 'Asleep',
    pdfColRested: 'Rested',
    pdfColMood: 'Mood',
    pdfColNotes: 'Notes',
    pdfEmpty: 'No nights logged in this range.',
    // Footer — verbatim on every page. LOAD-BEARING → CT4. Company name + honest
    // provenance + educational disclaimer; no diagnosis language.
    pdfFooter:
      'Your own sleep record, shared from Psychage with your consent. Educational, not a diagnosis.',
  },

  windDown: {
    intro: 'A few calming options for the hour before bed. Use what helps.',
    breathingTitle: 'Guided breathing',
    breathingBody: 'A short paced-breathing exercise to settle your body.',
    breathingCta: 'Open breathing',
    brainDumpTitle: 'Brain dump',
    brainDumpBody: 'Empty your head onto the page so it’s not on your mind. Stays on this device.',
    brainDumpPlaceholder: 'Whatever’s on your mind…',
    brainDumpClear: 'Clear',
    cbtiTitle: 'About sleep',
    crisisLine: 'If something heavier is on your mind, support is here for you.',
  },

  // CBT-I education cards (ported from the web tool). Educational only — not therapy.
  cbtiCards: [
    {
      id: 'stimulus_control',
      title: 'The bed–sleep connection',
      body: 'Brains link the bed with whatever happens there. Keeping the bed for sleep helps it learn bed = sleep. If you can’t sleep after ~20 minutes, get up, do something quiet, and return when sleepy.',
    },
    {
      id: 'sleep_pressure',
      title: 'How sleep pressure builds',
      body: 'The longer you’re awake, the stronger the drive to sleep. Late naps and afternoon caffeine drain that pressure — so mornings-only caffeine and earlier naps tend to help.',
    },
    {
      id: 'circadian',
      title: 'Your internal clock',
      body: 'Light is the strongest signal for your body clock. Bright light soon after waking and dimmer light before bed, with a steady wake time, keep the rhythm anchored.',
    },
    {
      id: 'cognitive',
      title: 'When sleep thoughts spiral',
      body: 'Worrying about not sleeping makes sleep harder. Noticing the thought — “have I coped after a rough night before?” — can take some of the pressure off.',
    },
  ],

  insights: {
    title: 'Sleep & morning mood',
    intro: 'As you log, this looks for gentle links between your nights and how you feel in the morning. Patterns, not proof.',
    insufficient: 'Keep logging — links appear once there are about two weeks of nights.',
    none: 'No clear links yet. That’s common, and not a problem.',
    pairs: (n: number) => `Based on ${n} nights`,
    strengthLabel: {
      strong: 'Clear link',
      moderate: 'Some link',
      weak: 'Slight link',
      none: 'No clear link',
    },
    metricLabel: {
      duration: 'Sleep length',
      efficiency: 'Sleep efficiency',
      quality: 'Sleep quality',
      latency: 'Time to fall asleep',
    },
    directionUp: 'tends to go with a better morning mood',
    directionDown: 'tends to go with a lower morning mood',
  },

  tools: {
    menuTitle: 'Sleep tools',
    chronotype: { title: 'Chronotype', sub: 'Find your natural sleep window' },
    bedtime: { title: 'Bedtime calculator', sub: 'Work back from your wake time' },
    debt: { title: 'Sleep debt', sub: 'Catch-up across your recent nights' },
    back: 'Back to tools',
    targetsSaved: 'Sleep window saved — your bedtime and wake targets are set.', // CT4

    chronotypeIntro: 'Five quick questions about your natural rhythm. Educational — not a test.',
    chronotypeResult: 'Your pattern',
    chronotypeIdeal: 'A sleep window that often suits this pattern',
    chronotypeSave: 'Use these as my targets',
    chronotypeRetake: 'Retake',

    bedtimeWake: 'When do you want to wake up?',
    bedtimeResult: 'Aim to be asleep around one of these — each lands at the end of a ~90-minute cycle:',
    bedtimeCycles: (cycles: number, hours: string) => `${cycles} cycles · ~${hours}`,

    debtEmpty: 'Log a few nights to estimate recent sleep debt.',
    debtTotal: 'Estimated shortfall, last 14 nights',
    debtRecovery: 'A few steadier nights can ease this gradually.',
  },

  // rMEQ questions (reduced Morningness–Eveningness Questionnaire). Option values
  // feed scoreChronotype; the labels are CT4 content. NOT a clinical instrument.
  chronotypeQuestions: [
    {
      id: 1,
      question: 'If you were free to plan your day, when would you get up?',
      options: [
        { value: 5, label: '5:00–6:30 AM' },
        { value: 4, label: '6:30–7:45 AM' },
        { value: 3, label: '7:45–9:45 AM' },
        { value: 2, label: '9:45–11:00 AM' },
        { value: 1, label: '11:00 AM–12:00 PM' },
      ],
    },
    {
      id: 2,
      question: 'If you were free to plan your evening, when would you go to bed?',
      options: [
        { value: 5, label: '8:00–9:00 PM' },
        { value: 4, label: '9:00–10:15 PM' },
        { value: 3, label: '10:15 PM–12:30 AM' },
        { value: 2, label: '12:30–1:45 AM' },
        { value: 1, label: '1:45–3:00 AM' },
      ],
    },
    {
      id: 3,
      question: 'How alert do you feel in the first half hour after waking?',
      options: [
        { value: 1, label: 'Not at all alert' },
        { value: 2, label: 'Slightly alert' },
        { value: 3, label: 'Fairly alert' },
        { value: 4, label: 'Very alert' },
      ],
    },
    {
      id: 4,
      question: 'Around what time of day do you usually feel your best?',
      options: [
        { value: 5, label: '5:00–8:00 AM' },
        { value: 4, label: '8:00–10:00 AM' },
        { value: 3, label: '10:00 AM–5:00 PM' },
        { value: 2, label: '5:00–10:00 PM' },
        { value: 1, label: '10:00 PM–5:00 AM' },
      ],
    },
    {
      id: 5,
      question: 'Which type do you consider yourself?',
      options: [
        { value: 6, label: 'Definitely a morning type' },
        { value: 4, label: 'More a morning type' },
        { value: 2, label: 'More an evening type' },
        { value: 0, label: 'Definitely an evening type' },
      ],
    },
  ],

  disclaimer:
    'These are estimates based on what you log and typical adult sleep patterns. ' +
    'This is education, not medical advice or a diagnosis. If sleep difficulties ' +
    'persist, a healthcare provider or sleep specialist can help.',

  // SR-1: band id → gentle, non-verdict copy. Order low → rested.
  bands: {
    low: { label: 'Running low', note: 'Recent nights look light. Small steps can help.' },
    uneven: { label: 'A bit uneven', note: 'Your nights vary. Patterns below may show why.' },
    steady: { label: 'Mostly steady', note: 'A fairly steady stretch of nights.' },
    rested: { label: 'Well rested', note: 'Recent nights look steady and full.' },
  } satisfies Record<SleepScoreBand, { label: string; note: string }>,

  scoreCaption: 'Based on your recent nights',
  componentLabels: {
    duration: 'Length',
    efficiency: 'Efficiency',
    quality: 'Quality',
    consistency: 'Consistency',
    latency: 'Falling asleep',
  },

  metrics: {
    avgSleep: 'Typical sleep',
    efficiency: 'Time asleep in bed',
    latency: 'Time to fall asleep',
    streak: 'Nights logged in a row',
    trendTitle: 'Sleep length, recent nights',
  },

  diary: {
    logToday: 'Log last night',
    edit: 'Edit',
    emptyTitle: 'No nights logged yet',
    emptyBody: 'Log last night to start seeing your patterns.',
    quality: 'Quality',
  },

  dashboard: {
    emptyTitle: 'Patterns appear as you log',
    emptyBody: 'A few nights in, you’ll see your typical length, timing, and trend here.',
  },

  // Last-7-nights summary. Descriptive only — counts and a gentle week-over-week
  // comparison of rested time, never a verdict or target (SR-1 / SR-3).
  weeklyDigest: {
    title: 'This week',
    nightsLabel: (n: number) => `${n} ${n === 1 ? 'night' : 'nights'} logged`,
    typicalLabel: 'Typical length',
    moreRested: 'A bit more rested time than the week before.',
    lessRested: 'A bit less rested time than the week before.',
    aboutSame: 'About the same rested time as the week before.',
    emptyWeek: 'No nights logged this week yet.',
  },

  // Quality + morning-mood trends. Self-rated 1–5 lines shown as gentle trends to
  // notice alongside the night, never scored or judged.
  trends: {
    qualityTitle: 'How rested you felt',
    moodTitle: 'Morning mood',
  },

  form: {
    heading: 'Last night',
    bedtime: 'Got into bed',
    lightsOut: 'Tried to sleep',
    onset: 'Minutes to fall asleep',
    wakings: 'Times woke in the night',
    wakeDuration: 'Minutes awake in the night',
    wakeTime: 'Woke up',
    outOfBed: 'Got out of bed',
    quality: 'How rested do you feel?',
    mood: 'Morning mood',
    dreamRecall: 'Remember a dream?',
    dreamNotes: 'Dream notes (optional)',
    substances: 'Before bed',
    alcohol: 'Alcohol',
    exercise: 'Exercised',
    medication: 'Sleep aid',
    caffeine: 'Last caffeine (optional)',
    notes: 'Notes (optional)',
    save: 'Save night',
    cancel: 'Cancel',
    timeHint: 'HH:MM, 24-hour (e.g. 23:30)',
    invalid: 'Please check the highlighted fields — times use HH:MM (00:00–23:59).',
    equalTimes:
      'Getting into bed and out of bed show the same time — please set two different times.',
  },

  ratingScale: ['Poorly', 'Not great', 'Okay', 'Good', 'Very good'] as const,
} as const;
