// Best-effort, consent-gated persistence of MindMate conversations to Supabase.
// Mirrors lib/check-in-store.ts pushCheckInEntry in shape: PUSH-ONLY, swallows every
// error, NEVER throws, NEVER blocks the chat UI. The in-memory conversation in
// useMindMateChat stays the source of truth; this is an additive backup written only
// when the person has explicitly consented AND is signed in.
//
// PRIVACY GATES (all must pass, checked before any auth/network touch):
//   1. enabled()   — the Supabase env is configured.
//   2. getConsent() — the user opted in via the in-chat banner (default OFF).
//   3. getUserId() — a signed-in session exists (the task's "consent + a session").
// A CRISIS-flagged exchange is NEVER persisted — crisis content stays on-device
// (defense-in-depth alongside the hook, which already skips the crisis path).
//
// The server owns all safety classification; this module only records what the user
// already saw. No symptom/Navigator data flows here (SR-4) — only the chat turns the
// user chose to save, into ai_messages rows owned by their user_id (RLS-scoped reads).
//
// Tables (ai_conversations / ai_messages) live on the SHARED Supabase project, defined
// by the web migrations. A missing table / RLS denial / offline error is swallowed.

import type { SupabaseClient } from '@supabase/supabase-js';

import { devWarnSilentFailure } from '@/lib/dev-warn';
import { getSupabaseAuthClient, isSupabaseConfigured } from '@/lib/supabase/client';

import type { Citation, SafetyLevel } from '../types';
import { getChatPersistConsent } from './chat-consent';

/** Capabilities the best-effort write needs; injectable so the swallow is testable. */
export interface ChatPersistDeps {
  /** True only when the Supabase env is configured (else the write is a no-op). */
  enabled(): boolean;
  /** The user's explicit conversation-save CONSENT. Write is skipped when false. */
  getConsent(): boolean;
  /** The authenticated user's id, or null when signed out (write is then skipped). */
  getUserId(): Promise<string | null>;
  /** The session-bearing write client (the existing auth client). */
  getWriteClient(): SupabaseClient;
}

export const productionChatPersistDeps: ChatPersistDeps = {
  enabled: isSupabaseConfigured,
  getConsent: getChatPersistConsent,
  getUserId: async () => {
    const { data, error } = await getSupabaseAuthClient().auth.getUser();
    return error || !data.user ? null : data.user.id;
  },
  getWriteClient: () => getSupabaseAuthClient(),
};

/** One completed user→assistant exchange to persist. */
export interface ChatExchange {
  /** Server-issued session id (ai_conversations.session_id NOT NULL). */
  sessionId: string;
  /** Existing conversation row id, or null to create one on this call. */
  conversationId: string | null;
  /** The user's message text. */
  userContent: string;
  /** The assistant reply text (post-stream). */
  assistantContent: string;
  /** The turn's server safety verdict, carried onto the assistant row. */
  safetyLevel?: SafetyLevel;
  /** Server-validated citations attached to the assistant row (JSONB). */
  citations?: Citation[];
}

/**
 * Persist one completed exchange. Creates the ai_conversations row on the first call
 * (when `conversationId` is null), then inserts the user + assistant ai_messages rows.
 * Returns the conversation id (new or existing) so the caller can reuse it on the next
 * turn, or null when persistence is gated off / failed. Best-effort: never throws.
 */
export async function persistExchange(
  ex: ChatExchange,
  deps: ChatPersistDeps = productionChatPersistDeps,
): Promise<string | null> {
  // Hoisted so the catch can still return a conversation created before a later
  // failure — a half-written exchange must NOT orphan that row by re-creating next turn.
  let conversationId = ex.conversationId;
  try {
    // GATES — checked before any auth/network so an un-consented save costs nothing.
    if (!deps.enabled()) return conversationId;
    if (!deps.getConsent()) return conversationId;
    // Defense-in-depth: crisis content never persists (the hook also skips it).
    // FAIL-CLOSED (PR-073): an absent verdict means the stream dropped before the
    // `done` event — the exchange may be a crisis turn whose meta never arrived.
    // Unknown ⇒ treated exactly like CRISIS: no cloud write.
    if (ex.safetyLevel === undefined || ex.safetyLevel === 'CRISIS') return conversationId;
    // A conversation row needs a non-empty session id (NOT NULL on the table).
    if (!ex.sessionId && !ex.conversationId) return null;

    const userId = await deps.getUserId();
    if (!userId) return conversationId;

    const client = deps.getWriteClient();

    if (!conversationId) {
      const { data, error } = await client
        .from('ai_conversations')
        .insert({ session_id: ex.sessionId, user_id: userId, language: 'en' })
        .select('id')
        .single();
      if (error) devWarnSilentFailure('mindmate/ai_conversations.insert', error);
      if (error || !data) return null;
      conversationId = (data as { id: string }).id;
    }

    const { error } = await client.from('ai_messages').insert([
      {
        conversation_id: conversationId,
        role: 'user',
        content: ex.userContent,
        streamed: false,
      },
      {
        conversation_id: conversationId,
        role: 'assistant',
        content: ex.assistantContent,
        safety_flag: ex.safetyLevel ?? null,
        sources_cited: ex.citations ?? null,
        streamed: true,
      },
    ]);
    // Even if the message insert failed, the conversation exists — hand the id back so
    // the next turn reuses it rather than orphaning a second empty conversation.
    if (error) devWarnSilentFailure('mindmate/ai_messages.insert', error);
    return conversationId;
  } catch {
    // Swallowed by design: best-effort, push-only backup. No analytics (blocked scope),
    // no PII logged. The in-memory conversation is unaffected. Returns any conversation
    // created before the failure so the next turn reuses it instead of orphaning it.
    return conversationId;
  }
}
