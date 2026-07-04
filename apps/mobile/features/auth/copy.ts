// CT4 — PLACEHOLDER COPY, NOT FINAL. Auth copy is not Flow-Book-verbatim like the
// core loop; every string here is a labelled placeholder. Person-first, never
// diagnostic (Sacred Rule #2), never clinical. Final copy is clinically reviewed by
// Dr. Dobson before ship (rules/auth.md §10 names this file as the copy home).
//
// rules/auth.md §10: "Specific UI copy lives in features/auth/copy.ts ... here we
// describe intent only." These strings exist so the screens are navigable in
// isolation; do not treat them as final.

export const AUTH_COPY = {
  // S33 — Why / keep-this-safe. The honest persistence framing.
  whyTitle: 'Keep your check-ins safe', // CT4
  whyBody:
    'An account lets your check-ins move with you — a new phone, a lost phone. It is not required to use Psychage.', // CT4
  whyPrimary: 'Use my email', // CT4
  whySecondary: 'Not now', // CT4

  // S34 — Email + password (rules/auth.md §3: email+password is the V1 method).
  signUpTitle: 'Use your email', // CT4
  emailLabel: 'Email', // CT4
  emailHint: 'The email you want your check-ins kept under', // CT4
  passwordLabel: 'Password', // CT4
  passwordHint: 'At least 8 characters', // CT4
  signUpPrimary: 'Create account', // CT4
  signInPrimary: 'Sign in', // CT4
  // P15 — make signup reachable from the standalone sign-in screen.
  signUpLink: "Don't have an account? Sign up", // CT4
  emailEmptyLine: 'Enter your email', // CT4
  emailInvalidLine: 'That email does not look right', // CT4
  passwordEmptyLine: 'Enter a password', // CT4
  passwordShortLine: 'Use at least 8 characters', // CT4
  // Generic — never leaks whether an account exists (Procedure-B security checklist).
  credentialsLine: 'Those details did not match. Check and try again.', // CT4

  // /migrate — account data migration (deep-link surface; PR-058 made it explicit-start).
  migrateIntro:
    'Bring the check-ins on this phone (the last 7 days) into your account. Nothing moves until you start.', // CT4
  migrateStartLabel: 'Start', // CT4
  migrateExitLabel: 'Done', // CT4

  // S35 — Check your email + verification (rules/auth.md §3: verification required).
  verifyTitle: 'Check your email', // CT4
  verifyBody: 'We sent a link to confirm it is you. Tap it, then come back here.', // CT4
  resendLabel: 'Did not get it? Resend', // CT4
  resendCooldownLabel: (seconds: number) => `Resend in ${seconds}s`, // CT4

  // S36 — Migration. Honest, calm, no spinner-theatre.
  migrateSettleLine: 'Settling your check-ins into your account…', // CT4
  migrateDoneLine: 'Your check-ins are with your account.', // CT4
  migrateConflictNote: 'A same-day entry was kept at its newest version.', // CT4
  migrateEmptyLine: 'Nothing to move yet — you are all set.', // CT4

  // S37 — Sign out. Reversible; not destructive.
  signOutTitle: 'Sign out?', // CT4
  signOutBody: 'You can sign back in any time with your email.', // CT4
  signOutPrimary: 'Sign out', // CT4
  signOutCancel: 'Cancel', // CT4

  // Shared offline state — auth needs the network; honest, not a spinner.
  offlineLine: 'You are offline. Reconnect to continue.', // CT4

  // ── Amendment 2026-06-16 (auth-experience pass) — all CT4, Dr. Dobson review ──

  // S0 — Front-door Welcome gate. Continue = anonymous entry (Tier-1 preserved).
  welcomeTitle: 'Psychage', // CT4
  welcomeTagline: 'A calmer way to understand what you might be going through.', // CT4
  welcomeContinue: 'Explore without an account', // CT4
  welcomeLogin: 'Log in', // CT4
  welcomeSignUp: 'Create an account', // CT4

  // Sign-up "full SaaS" fields (Q3).
  nameLabel: 'Full name', // CT4
  nameHint: 'The name to show on your account', // CT4
  nameEmptyLine: 'Enter your name', // CT4
  confirmLabel: 'Confirm password', // CT4
  confirmHint: 'Re-enter the same password', // CT4
  confirmEmptyLine: 'Re-enter your password', // CT4
  confirmMismatchLine: 'Those passwords do not match', // CT4
  // Password-strength meter labels (display only — min-8 is the only gate).
  strengthLabel: 'Password strength', // CT4
  strengthWeak: 'Weak', // CT4
  strengthFair: 'Fair', // CT4
  strengthGood: 'Good', // CT4
  strengthStrong: 'Strong', // CT4
  // Terms + Privacy acceptance (App Store 5.1.1). Links are placeholders pending legal.
  termsPrefix: 'I agree to the ', // CT4
  termsLink: 'Terms of Service', // CT4
  termsAnd: ' and ', // CT4
  privacyLink: 'Privacy Policy', // CT4
  termsRequiredLine: 'Please accept the Terms and Privacy Policy to continue', // CT4

  // Login polish.
  forgotLink: 'Forgot password?', // CT4
  showPasswordLabel: 'Show password', // CT4
  hidePasswordLabel: 'Hide password', // CT4

  // Social sign-in (Apple + Google).
  socialDivider: 'or', // CT4
  continueWithApple: 'Continue with Apple', // CT4
  continueWithGoogle: 'Continue with Google', // CT4
  socialFailedLine: 'That sign-in could not be completed. Please try again.', // CT4

  // Forgot password.
  forgotTitle: 'Reset your password', // CT4
  forgotBody: 'Enter your email and a reset link will be sent.', // CT4
  forgotPrimary: 'Send reset link', // CT4
  forgotBackToSignIn: 'Back to sign in', // CT4
  // Anti-enumeration: the same confirmation whether or not the address has an account.
  forgotSentTitle: 'Check your email', // CT4
  forgotSentBody: (email: string) =>
    `If an account exists for ${email}, a reset link is on its way.`, // CT4

  // Reset password (reached via the recovery deep-link).
  resetTitle: 'Choose a new password', // CT4
  resetBody: 'Enter a new password for your account.', // CT4
  resetPrimary: 'Update password', // CT4
  resetWeakLine: 'That password is too weak. Use at least 8 characters.', // CT4
  resetDoneTitle: 'Password updated', // CT4
  resetDoneBody: 'The new password is set. Use it next time you sign in.', // CT4
  resetDonePrimary: 'Continue', // CT4
  resetExpiredTitle: 'This link has expired', // CT4
  resetExpiredBody: 'Reset links expire after a short time for safety. Request a new one.', // CT4
  resetExpiredPrimary: 'Request a new link', // CT4

  // Verification success (deep-link landing).
  verifySuccessTitle: 'Email confirmed', // CT4
  verifySuccessBody: 'The email is confirmed — everything is ready.', // CT4
  verifySuccessPrimary: 'Continue', // CT4

  // Session expired (graceful re-auth).
  sessionExpiredTitle: 'Please sign in again', // CT4
  sessionExpiredBody:
    'For safety, sessions end after a while. Sign in to pick up where things left off.', // CT4
  sessionExpiredPrimary: 'Sign in', // CT4
  sessionExpiredSecondary: 'Not now', // CT4

  // Generic auth error + maintenance (Supabase outage) — reusable states.
  authErrorTitle: 'Something went wrong', // CT4
  authErrorBody: 'That could not be completed just now. Please try again.', // CT4
  authErrorPrimary: 'Try again', // CT4
  authMaintenanceTitle: 'Back in a moment', // CT4
  authMaintenanceBody: 'Sign-in is briefly unavailable. Please try again in a few minutes.', // CT4

  // Just-in-time account prompts (rules/auth.md §2). Skippable, never blocking.
  streakSaveTitle: 'Keep your streak safe', // CT4
  streakSaveBody: 'Save your check-in streak so it survives a new phone.', // CT4
  streakSavePrimary: 'Save my streak', // CT4
  streakSaveSkip: 'Skip for now', // CT4
  therapistLinkTitle: 'Keep this private', // CT4
  therapistLinkBody: "Adding a therapist saves their details securely. It takes about 30 seconds.", // CT4
  therapistLinkPrimary: 'Create an account', // CT4
  therapistLinkSkip: 'Skip for now', // CT4
} as const;
