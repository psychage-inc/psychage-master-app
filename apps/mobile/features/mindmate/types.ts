// MindMate (mobile) — shared types. Mirrors the web contract at
// psychage-v2/src/lib/ai/{types,streaming}.ts so the mobile client conforms to
// the SAME backend (POST https://psychage.com/api/ai/chat). Kept deliberately
// small: the mobile client only needs what it sends and what it renders.

/** Wire role — only user/assistant cross the boundary (server drops `system`). */
export type ChatRole = 'user' | 'assistant';

/** The exact message shape the endpoint expects in its `messages` array. */
export interface ApiMessage {
  role: ChatRole;
  content: string;
}

/**
 * Server safety verdict. The mobile client reacts to CRISIS (route to the crisis
 * surface, never render an AI reply); the rest are carried for fidelity/telemetry
 * parity but treated as SAFE for rendering. Confidence is NEVER surfaced (SR-1).
 */
export type SafetyLevel =
  | 'SAFE'
  | 'WATCH'
  | 'URGENT'
  | 'CRISIS'
  | 'OUT_OF_SCOPE'
  | 'HARMFUL_REQUEST';

/** A grounding citation the server attaches to a reply (Psychage article). */
export interface Citation {
  id: string;
  title: string;
  url: string;
}

/** Non-streaming JSON body — returned for crisis responses and the stream:false fallback. */
export interface ApiJsonResponse {
  message: string;
  citations: { document_id: string; title: string; url_path: string }[];
  sessionId: string;
  safetyLevel: string;
  isCrisis: boolean;
  responseTimeMs?: number;
}

/** Side-channel metadata surfaced once per turn (not part of the visible text). */
export interface ChatTurnMeta {
  citations: Citation[];
  safetyLevel: SafetyLevel;
  isCrisis: boolean;
  sessionId: string;
}

/** A rendered message in the in-memory conversation (never persisted). */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** True while tokens are still arriving — drives the streaming cursor. */
  isStreaming?: boolean;
  /**
   * Set on both messages of an exchange flagged CRISIS (client pre-check: the user
   * message; server verdict: the user message AND the crisis reply). Flagged messages
   * are excluded from the history sent on later turns.
   */
  isCrisis?: boolean;
  citations?: Citation[];
}

/** Normalize the server's free-string safety level to our union. */
export function normalizeSafetyLevel(level: string): SafetyLevel {
  switch (level) {
    case 'CRISIS':
      return 'CRISIS';
    case 'URGENT':
      return 'URGENT';
    case 'WATCH':
      return 'WATCH';
    case 'OUT_OF_SCOPE':
      return 'OUT_OF_SCOPE';
    case 'HARMFUL_REQUEST':
      return 'HARMFUL_REQUEST';
    default:
      return 'SAFE';
  }
}
