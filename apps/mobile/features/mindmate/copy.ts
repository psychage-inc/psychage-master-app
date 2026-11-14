// MindMate UI copy. Person-first, educational, NEVER diagnostic (SR-2/SR-3).
// No "you have", "you are", "diagnosed with". The mascot fronts the intro.
// FIXTURE — clinically reviewed (Dr. Dobson) before ship; not final.

export const MINDMATE_COPY = {
  title: 'MindMate',
  // The session greeting (counsel text) lives in consent-copy.ts.
  inputPlaceholder: 'Share what’s on your mind',
  sendLabel: 'Send message',
  // Calm, non-clinical states.
  signInTitle: 'Sign in to chat with MindMate',
  signInBody: 'MindMate is available once you’re signed in.',
  signInCta: 'Sign in',
  errorRetry: 'Try again',
  // Crisis card — mirrors the web tone; routes to the full crisis surface (S11).
  crisisTitle: 'It sounds like you’re going through something really hard',
  crisisBody:
    'You deserve support right now, and you don’t have to face this alone. Trained people are ready to listen.',
  crisisCta: 'Get crisis support',
  // Crisis card — region hotline call action. `{name}` is filled with the line name.
  crisisCallPrefix: 'Call',
  // Message-list fail-safe (D-01). Shown INSIDE the chat area only when the list
  // itself fails to render; the header Help-now pill and the inline crisis card sit
  // outside that boundary and stay up. PROVISIONAL — needs Dr. Dobson's review.
  listFallback: 'This conversation couldn’t be shown right now. Help is still available above.',
  // Sources / citations — the articles the reply drew on.
  sourcesLabel: 'Sources',
  // Consent banner — opt-in to save conversations. Plain-language, non-diagnostic,
  // explains what is saved and that it's optional. Default OFF.
  consentTitle: 'Save your conversations?',
  consentBody:
    'Keep your chats so you can pick up where you left off. They’re saved to your account and only you can read them. Off by default — you can turn this off anytime.',
  consentToggleLabel: 'Save my conversations',
  // Consent-gate states + Settings > Privacy > MindMate support strings. NOT counsel
  // text (that is consent-copy.ts) — PROVISIONAL, needs review before ship.
  consentLoadingLabel: 'Checking MindMate consent',
  consentLoadFailed: 'MindMate couldn’t check your consent status.',
  consentRetry: 'Retry',
  consentActionFailed: 'That didn’t go through. Please try again.',
  policyOpenFailed: 'The privacy policy couldn’t be opened. Please try again.',
  deleteConfirmBody: 'This deletes all of your MindMate conversations. It can’t be undone.',
  deleteConfirmCancel: 'Cancel',
  deleteConfirmDelete: 'Delete',
  deleteDone: 'All MindMate conversations were deleted.',
  privacySignedOut: 'Sign in to manage MindMate consent.',
} as const;
