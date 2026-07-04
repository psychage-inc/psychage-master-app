// CT4 — PLACEHOLDER COPY, NOT FINAL. Therapist-share copy is not Flow-Book-verbatim;
// every string is a labelled placeholder. Person-first, never diagnostic (Sacred Rule
// #2), NO clinical vocabulary (whole-wave hard refusal). Final copy is clinically
// reviewed by Dr. Dobson before ship. PDF_FOOTER is load-bearing → flagged CT4.

export const THERAPIST_COPY = {
  // S39 — linked-provider meta row on the shared PDF (PR-090).
  preparedForLabel: 'Prepared for', // CT4
  // S38 — Why / consent intro.
  consentTitle: 'Share with your provider', // CT4
  consentBody:
    'Your provider sees the days you checked in and how you described each one. No scores, no labels — just your own words and the dates.', // CT4
  consentPrimary: 'Add your provider', // CT4

  // S39 — Add provider (one provider in V1).
  providerNameLabel: 'Provider name', // CT4
  providerNameHint: 'Who you want to share this with', // CT4
  providerContactLabel: 'Email or phone (optional)', // CT4
  addProviderPrimary: 'Save provider', // CT4

  // S40 — Date range.
  rangeTitle: 'What to share', // CT4
  rangeOption7: 'Last 7 days', // CT4
  rangeOption14: 'Last 14 days', // CT4
  rangeOption30: 'Last 30 days', // CT4
  // Honest about what is in the range. e.g. "18 days, 14 entries".
  rangeCountLine: (days: number, entries: number) =>
    `${days} ${days === 1 ? 'day' : 'days'}, ${entries} ${entries === 1 ? 'entry' : 'entries'}`, // CT4
  rangePrimary: 'Preview', // CT4

  // S41 — PDF preview + share.
  previewNameLabel: 'Your full name', // CT4
  previewNameHint: 'Your provider files the summary by this name', // CT4
  sharePrimary: 'Share', // CT4
  emptyRangeLine: 'No entries in this range yet.', // CT4
  // Opt-in to append other tools' summaries (Clarity, Navigator, Relationship,
  // Mood, Sleep). DEFAULT OFF — the default share stays "check-ins only" to match
  // consentBody. Approved by Dr. Dobson (2026-06-17).
  includeToolsLabel: 'Also include my other tool summaries',
  includeToolsHint:
    'Adds a summary of your Clarity Score, Navigator, Relationship, Mood and Sleep data. Numbers and areas only — still no diagnosis.',

  // The PDF footer — verbatim on every page. LOAD-BEARING → CT4. No clinical
  // vocabulary, no diagnosis language; honest about provenance + consent.
  pdfFooter: 'A personal check-in summary, shared from Psychage with your consent.', // CT4

  // ── Shared print-shell furniture ───────────────────────────────────────────
  // The masthead, document title, and meta-grid labels every PDF renders through
  // the shared shell (renderDocument). The wordmark itself is the literal brand
  // name (not copy). Labels are person-first, no clinical vocabulary. All CT4.
  shell: {
    kindLabel: 'Personal summary', // CT4 — masthead tag (top-right of the page)
    metaName: 'Name', // CT4 — the provider files the summary by this
    metaPeriod: 'Period', // CT4
    metaLogged: 'Logged', // CT4 — honest "N days, M entries/moments/nights" line
    metaGenerated: 'Generated', // CT4
    metaExplored: 'Explored', // CT4 — point-in-time run date (Navigator)
  },

  // ── Check-in PDF document chrome ───────────────────────────────────────────
  // Title + table column headers for the daily check-in export. The "How you
  // described it" header is SR-3-safe (no diagnostic verb phrases). CT4.
  checkIn: {
    docTitle: 'Check-in Summary', // CT4
    colDate: 'Date', // CT4
    colState: 'How you described it', // CT4
    colNotes: 'Notes', // CT4
    // A neutral legend for the terrain chart — orients a provider to what the dots mean.
    terrainCaption: 'Each dot is one day; its height shows how the day was described.', // CT4
  },

  // ── Session-prep summary ──────────────────────────────────────────────────
  // A separate on-demand document: the person's own record of the moments they
  // noticed, generated before an appointment and shared by them. Patterns stated
  // plainly — NEVER assessment/diagnosis/severity (Sacred Rule #2/#3). All CT4,
  // load-bearing copy flagged for Dr. Dobson before ship.
  sessionPrep: {
    // Document title on the standalone Moments PDF (the print header, not the screen).
    docTitle: 'Moments Summary', // CT4
    // Entry surface (Settings → Prepare for your session).
    navLabel: 'Prepare for your session', // CT4
    screenTitle: 'Prepare for your session', // CT4
    screenIntro:
      'A summary of what you tracked — your moments, plus sleep and anything you explored — to take to an appointment. You pick the time period and share it yourself; Psychage never sends it anywhere.', // CT4
    // Preview line naming the other tools that will ride along, when present in the
    // window. e.g. "Also includes: Sleep · Symptom Navigator".
    alsoIncludes: (tools: string) => `Also includes: ${tools}`, // CT4
    // Shown under the count when the window holds nothing to export — the button is
    // disabled in this state.
    nothingToExport: 'Nothing tracked in this time period yet.', // CT4
    windowLabel: 'Time period', // CT4
    window14: 'Last 2 weeks', // CT4
    window30: 'Last 30 days', // CT4
    window90: 'Last 90 days', // CT4
    windowSince: 'Since a date', // CT4
    sincePickLabel: 'Choose a start date', // CT4
    nameLabel: 'Your full name', // CT4
    nameHint: 'Your provider files the summary by this name', // CT4
    generate: 'Generate & share', // CT4
    // Honest count for the chosen window. e.g. "30 days, 12 moments noted".
    countLine: (days: number, moments: number) =>
      `${days} ${days === 1 ? 'day' : 'days'}, ${moments} ${moments === 1 ? 'moment' : 'moments'} noted`, // CT4
    empty: 'No moments noted in this window yet.', // CT4

    // Document section headings.
    feelingsHeading: 'Feelings you noted most', // CT4
    contextHeading: 'What was on your mind', // CT4
    spreadHeading: 'How your moments spread', // CT4
    timeHeading: 'When moments happened', // CT4
    notesHeading: 'In your words', // CT4
    notesEmpty: 'No notes added in this window.', // CT4
    // The 5-point affect scale words — the SAME scale as the on-screen terrain
    // edges (Very low … Very good). Neutral affect words, not severity.
    scale: {
      1: 'Very low',
      2: 'Low',
      3: 'Mixed',
      4: 'Good',
      5: 'Very good',
    } as Readonly<Record<1 | 2 | 3 | 4 | 5, string>>, // CT4
    morning: 'Morning', // CT4
    afternoon: 'Afternoon', // CT4
    evening: 'Evening', // CT4
    night: 'Night', // CT4
    // Document footer — verbatim on every page. LOAD-BEARING → CT4. Person-first,
    // honest about provenance; no diagnosis/assessment language.
    footer: 'Your own record of the moments you noticed, shared from Psychage.', // CT4
  },

  // ── Unified export document ───────────────────────────────────────────────
  // ONE print document that bundles every tool with data in the window (Moments,
  // Sleep, Symptom Navigator — summary-only). Header/footer name the COMPANY and the
  // generation time; NO clinician is named (no private-practice implication). All CT4,
  // load-bearing copy flagged for Dr. Dobson before ship. Person-first, non-diagnostic.
  unifiedExport: {
    companyName: 'Psychage', // CT4
    // Document title on the bundled multi-tool export (print header).
    docTitle: 'Personal Summary', // CT4
    // Header generation stamp. e.g. "Generated Jun 22, 2026 · 3:45 PM".
    generated: (stamp: string) => `Generated ${stamp}`, // CT4
    // Document footer — verbatim on every page. LOAD-BEARING → CT4.
    footer: 'Your own record, shared from Psychage with your consent.', // CT4
    // Defensive body when no tool has data in the window (the route disables export
    // in this state, so it should not normally render).
    emptyAll: 'Nothing tracked in this time period yet.', // CT4
    // Document name fallback when the person leaves the name field blank.
    nameFallback: 'Personal summary', // CT4
    // Per-tool section titles.
    momentsTitle: 'Moments', // CT4
    sleepTitle: 'Sleep', // CT4
    navigatorTitle: 'Symptom Navigator', // CT4
    // Per-tool sub-title lines (counts / run date — never assessment or severity).
    momentsMeta: (n: number) => `${n} ${n === 1 ? 'moment' : 'moments'} noted`, // CT4
    sleepMeta: (n: number) => `${n} ${n === 1 ? 'night' : 'nights'} logged`, // CT4
    navigatorMeta: (dateLabel: string) => `Explored ${dateLabel}`, // CT4
  },
} as const;
