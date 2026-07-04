// CT4 FIXTURE — placeholder UI copy for the Settings surfaces (Flow 18), NOT
// final/clinically-reviewed. The reminder confirmation lines marked (Flow 3) ARE
// the verbatim strings the order gives; everything else is a fixture to be
// resolved before ship. Every object carries `_fixture`/`_marker` so the design
// audit and grep find all placeholders.

const FIXTURE = 'FIXTURE — not final copy' as const;

export const CT4_SETTINGS = {
  _fixture: 'CT4' as const,
  _marker: FIXTURE,

  hub: {
    title: 'Settings',
    profileLabel: 'Profile',
    accountLabel: 'Account',
    crisisLabel: 'Support',
    rows: {
      reminders: 'Reminders',
      makeItYours: 'Make it yours',
      appearance: 'Accessibility & appearance',
      privacy: 'Privacy & your data',
      about: 'About & legal',
      supporter: 'Keep Psychage free',
      signIn: 'Sign in',
      signOut: 'Sign out',
      account: 'Account',
      deleteAccount: 'Delete my record',
      crisis: 'Get help now',
    },
    // Read from the auth session; not a credential or account-linking surface.
    signedInAs: (email: string) => `Signed in as ${email}`,
    notSignedIn: 'Not signed in',
  },

  reminders: {
    title: 'Reminders',
    intro:
      'One gentle daily reminder to check in. People who check in around the same time each day notice patterns sooner.',
    enabledLabel: 'Daily reminder',
    timeLabel: 'Time',
    changeTime: 'Change time',
    notNow: 'Not now',
    never: 'Never',
    // (Flow 3) verbatim confirmation lines.
    setConfirmation: 'Set. 9:00 PM, changeable in Settings.',
    neverConfirmation: 'Okay — reminders stay off. You can turn them on any time in Settings.',
  },

  makeItYours: {
    title: 'Make it yours',
    nameLabel: 'What should we call you?',
    namePlaceholder: 'Your name (optional)',
    // P63 — the name comes from the verified login method (read-only), not free text.
    nameFromAccount: 'Set by your Google or email account',
    nameSignInHint: 'Sign in to set your name',
    leadLabel: 'What leads your home screen',
    leadOptions: {
      'check-in': 'Daily check-in',
      navigator: 'Make sense of what you feel',
      toolkit: 'Steady yourself right now',
    },
    save: 'Save',
  },

  appearance: {
    title: 'Accessibility & appearance',
    appearanceLabel: 'Appearance',
    modeOptions: {
      light: 'Light',
      night: 'Night',
      system: 'Match system',
    },
    reduceMotionLabel: 'Reduce motion',
    reduceMotionDescription: 'Calms animations across the app.',
    dynamicTypeNote: 'Text follows your system text-size setting.',
    textSizeLabel: 'Reading text size',
    textSizeOptions: {
      small: 'Small',
      default: 'Default',
      large: 'Large',
    },
    textSizeNote: 'Changes the size of article text. Other text follows your system setting.',
    textSizePreviewLabel: 'Preview',
    textSizePreviewBody:
      'People experiencing low mood often describe it as a heaviness that makes small tasks feel large.',
  },

  about: {
    title: 'About & legal',
    aboutLabel: 'About Psychage',
    aboutBody:
      'Psychage is a global mental health education platform — a calm place to understand what you might be experiencing, before deciding what kind of help you want. It is educational, not clinical.',
    rows: {
      terms: 'Terms of use',
      privacy: 'Privacy policy',
      disclaimer: 'Educational use disclaimer',
      acknowledgments: 'Acknowledgments',
    },
    // U6 educational disclaimer — store-blocking; final copy is CT4/legal sign-off.
    disclaimerBody:
      'Psychage is an educational resource. It does not diagnose, treat, or replace professional care. If you need help now, use the Help now button.',
    version: 'Version',
  },

  // Legal/disclaimer copy — clinically reviewed and approved by Dr. Dobson (2026-06-17).
  // Educational framing only (SR-2/SR-3): no clinical assertions.
  legal: {
    termsTitle: 'Terms of use',
    termsBody:
      'By using Psychage you agree that it is a global mental health education platform, provided for learning and reflection, and that it is not a substitute for professional diagnosis or care.',
    privacyTitle: 'Privacy policy',
    privacyBody:
      'Your tool data — check-ins, assessments, and notes — stays on this device unless you explicitly choose to back it up or share it. We do not sell your data. Symptom-related information is never used for advertising.',
    disclaimerTitle: 'Educational use & medical disclaimer',
    disclaimerBody:
      'Psychage is an educational resource. It does not diagnose, treat, or replace professional care, and its operators are not liable for decisions made based on this educational content. If something here resonates, consider bringing it to a qualified professional. If you need help now, use the Help now button.',
  },

  acknowledgments: {
    title: 'Acknowledgments',
    intro: 'Psychage is built with open-source software. With thanks to the maintainers of:',
    // The libraries the app genuinely depends on (apps/mobile/package.json), with
    // their licenses. Static + curated — there is no runtime filesystem to generate
    // a license manifest from on-device.
    items: [
      { name: 'React & React Native', license: 'MIT' },
      { name: 'Expo & Expo Router', license: 'MIT' },
      { name: 'NativeWind & Tailwind CSS', license: 'MIT' },
      { name: 'Reanimated & Moti', license: 'MIT' },
      { name: 'Zustand & TanStack Query', license: 'MIT' },
      { name: 'lucide-react-native (icons)', license: 'ISC' },
      { name: 'react-native-mmkv', license: 'MIT' },
      { name: 'Supabase JS', license: 'MIT' },
    ],
  },

  privacy: {
    title: 'Privacy & your data',
    trust:
      "Your check-ins live on this device. We don't sell your data, and your record isn't shared unless you choose to share it.",
    // Check-in cloud-backup consent (SR-4 / ADR-001). Default OFF.
    syncSectionLabel: 'Back up to your account',
    syncConsentLabel: 'Back up check-ins to your account',
    syncConsentDescription:
      'Off by default. Turn this on to save a copy of your daily check-ins to your account so they survive a lost or reset phone. You can turn it off any time.',
    onDeviceLabel: 'What stays on this device',
    onDeviceBody:
      'Everything you do in the Navigator, your settings, and your notes stay on this device only. When backup is off, your check-ins never leave it either.',
    syncedLabel: 'What backup covers',
    syncedBody:
      'When backup is on, only your daily check-ins (mood and any note) are copied to your account. Nothing from the Navigator is ever synced.',
    exportLabel: 'Export my record',
    exportDescription: 'Save a copy as a file you control.',
    // Export failure (PR-067) — file write / share sheet can fail.
    exportFailTitle: "Couldn't export your record right now", // CT4
    exportFailBody: 'Please try again in a moment.', // CT4
    exportJson: 'Export as JSON',
    exportCsv: 'Export as CSV',
    exportEmpty: 'Nothing to export yet — your record is empty.',
    deleteEntry: 'Delete my record',
    clearLabel: 'Clear on-device data',
    clearDescription:
      'Remove everything stored on this device and start fresh. If backup is on, your copies in your account are not affected.',
    clearConfirm: 'Clear data',
    clearCancel: 'Cancel',
    clearDone: 'On-device data cleared.',
  },

  delete: {
    title: 'Delete my record',
    heading: 'This deletes your record from this device.',
    body:
      'Your check-ins and settings on this device are removed right away. There is no recovery window — once deleted, they cannot be brought back.',
    continueLabel: 'Continue to delete',
    keepLabel: 'Keep my account',
  },

  deleteConfirm: {
    title: 'Delete my record',
    heading: 'Delete now?',
    body: 'This is immediate and permanent on this device.',
    confirmLabel: 'Delete my record',
    keepLabel: 'Keep my account',
    // Shown only when the server-side cascade can't be reached. Person-first,
    // non-diagnostic, no medical claim — surfaces the gap rather than hiding it.
    serverFailTitle: "Couldn't reach our servers",
    serverFailBody:
      "Your record on this device has been removed, but we couldn't reach our servers to delete your account data — it may still exist. Please try again when you're back online.",
    serverFailAck: 'OK',
  },
} as const;
