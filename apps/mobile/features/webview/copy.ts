// CT4 FIXTURE — WebView chrome copy (S23/S24/S26/S27/S29–S32). NOT final. The
// "Still loading…" and load-error lines are the C-WV-LOAD spec strings, routed
// through CT4 like everything else.
export const CT4_WEBVIEW = {
  _fixture: 'CT4' as const,
  _marker: 'FIXTURE — not final copy',
  back: 'Back',
  stillLoading: 'Still loading…',
  loadError: "We couldn't load this. Try again",
  retry: 'Try again',
  unavailableTitle: 'Not available here yet',
  unavailableBody:
    'This section is coming to the app soon. For now, you can find it on psychage.com.',
  titles: {
    library: 'Library',
    librarySearch: 'Search the library',
    directory: 'Find care',
    provider: 'Provider',
    sleep: 'Sleep Architect',
    medTracker: 'Med Tracker',
    clarity: 'Clarity Score',
  } as Record<string, string>,
} as const;
