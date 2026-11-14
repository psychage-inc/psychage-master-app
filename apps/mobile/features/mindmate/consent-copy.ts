// MindMate consent — the single source for the consent version label and every
// counsel-approved string (compliance items 5 + 6). Text is WORD FOR WORD from legal
// counsel; do not edit, paraphrase, or "improve" it here or at a call site.
//
// MINDMATE_CONSENT_VERSION labels the text THIS build shows. The server holds the
// authoritative current version: grant_mindmate_consent() rejects any other value,
// and mindmate_consent_status() reports 'outdated' once the server moves past it.

export const MINDMATE_CONSENT_VERSION = 'mm-consent-v1';

/**
 * One-line summary of what changed since the user's last consent, shown on the
 * re-consent screen. null for v1 (there is no earlier version to change from). If the
 * server reports 'outdated' while this is null, the build has no summary to show —
 * that is a release error, so the re-consent screen throws (fail fast).
 */
export const MINDMATE_CONSENT_CHANGE_SUMMARY: string | null = null;

/** Consumer Health Data Privacy Policy — health-data section of the web policy. */
export const MINDMATE_HEALTH_DATA_POLICY_URL = 'https://www.psychage.com/legal/privacy#health-data';

export const MINDMATE_CONSENT_COPY = {
  title: 'Before you use MindMate',
  intro:
    'MindMate is an AI system, not a person, therapist, or clinician. It explains mental health topics for education. It cannot diagnose, treat, or give medical advice.',
  sendLead: 'Your messages may include health information. When you send a message:',
  bullets: [
    'It goes to Anthropic, an AI company in the United States, which processes it for Psychage only. Anthropic does not use your messages to train its models and deletes them within 30 days, except messages flagged for a safety review, which it may keep longer.',
    'When AI Chat History is on, Psychage stores the conversation in your account until you delete it.',
    'Psychage never sells your messages or uses them for advertising.',
  ],
  withdraw:
    'You can withdraw this consent and delete your conversations at any time in Settings > Privacy > MindMate.',
  policyLink: 'Read the Consumer Health Data Privacy Policy',
  agree: 'I agree to MindMate processing my messages',
  notNow: 'Not now',
} as const;

export const MINDMATE_RECONSENT_COPY = {
  heading: 'MindMate has changed how it handles your messages.',
  closing: 'Please review and agree again to keep using MindMate.',
  review: 'Review and agree',
  turnOff: 'Turn off MindMate',
} as const;

/** Shown at the start of every MindMate session, next to a Help Now control. */
export const MINDMATE_SESSION_GREETING =
  "Hi, I'm MindMate, an AI guide to mental health topics. I'm not a therapist and I can't diagnose or treat. If you're in crisis, tap Help Now or call or text 988.";
export const MINDMATE_GREETING_HELP_NOW = 'Help Now';

export const MINDMATE_PRIVACY_COPY = {
  // Rendered as `MindMate consent:` followed by `On` / `Off`.
  consentLabel: 'MindMate consent:',
  on: 'On',
  off: 'Off',
  body: 'Turning this off stops MindMate from sending your messages to Anthropic. You can also delete all MindMate conversations. Deletion removes them from Psychage within 30 days, including backups. Anthropic deletes any copy automatically within 30 days.',
  turnOff: 'Turn off MindMate',
  deleteAll: 'Delete all conversations',
} as const;

/**
 * The re-consent summary, or a thrown error when the build has none. Called when the
 * server reports 'outdated' — showing a re-consent screen with no description of the
 * change would ask the user to agree to something unstated.
 */
export function requireConsentChangeSummary(summary: string | null): string {
  if (summary === null) {
    throw new Error(
      'MindMate consent is outdated but MINDMATE_CONSENT_CHANGE_SUMMARY is null — this build has no change summary to show.',
    );
  }
  return summary;
}
