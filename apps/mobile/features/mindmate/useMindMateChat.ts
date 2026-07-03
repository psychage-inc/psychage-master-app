import { useCallback, useRef, useState } from 'react';

import { precheckCrisis } from '@psychage/shared/safety';

import { MindMateUnavailableError, SafetyReplacementError } from './errors';
import { sendMessage as defaultSendMessage } from './mindmate-service';
import { persistExchange as defaultPersistExchange } from './persistence/chat-store';
import type { ChatMessage, ChatTurnMeta } from './types';

// In-memory conversation controller. By DEFAULT messages live ONLY here — never
// written to MMKV/secure-store, never sent to Sentry/analytics; they vanish on
// unmount. The ONLY exception is consent-gated cloud persistence: when the person
// opts in via the in-chat banner AND is signed in, each completed (non-crisis) turn
// is mirrored to Supabase best-effort (persistExchange). Consent OFF (the default)
// keeps the conversation exactly as ephemeral as before. State is plain React
// (Zustand/TanStack Query are not in the V1 deps).

let seq = 0;
const nextId = () => `mm-${++seq}`;

export type ChatStatus = 'idle' | 'sending' | 'error';

type SendFn = typeof defaultSendMessage;
type PersistFn = typeof defaultPersistExchange;
type ApiMessage = { role: 'user' | 'assistant'; content: string };

export interface UseMindMateChatOptions {
  /** Region code forwarded to the backend so crisis resources match locale. */
  region?: string;
  /** Fired the instant a crisis is detected (client pre-check OR server verdict). */
  onCrisis?: () => void;
  /** Injectable for tests; defaults to the real streaming service. */
  sendImpl?: SendFn;
  /**
   * Injectable consent-gated persister; defaults to the real best-effort writer
   * (which self-no-ops unless the user consented AND is signed in). Fire-and-forget.
   */
  persistImpl?: PersistFn;
}

export interface UseMindMateChat {
  messages: ChatMessage[];
  status: ChatStatus;
  /** Calm, user-facing error copy (never a raw error/stack). */
  error: string | null;
  /** True once a crisis has been surfaced this session — keeps the crisis card up. */
  crisisActive: boolean;
  /** True when the last attempt failed because no session exists → show sign-in. */
  needsSignIn: boolean;
  send: (text: string) => Promise<void>;
  /**
   * Re-run the last turn after a transient backend failure (P9). Re-streams the
   * still-present trailing user message without appending a duplicate. No-op when
   * there's nothing to retry or a turn is already streaming.
   */
  retry: () => Promise<void>;
}

function toApi(messages: ChatMessage[]): ApiMessage[] {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
}

export function useMindMateChat(options: UseMindMateChatOptions = {}): UseMindMateChat {
  const {
    region,
    onCrisis,
    sendImpl = defaultSendMessage,
    persistImpl = defaultPersistExchange,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [crisisActive, setCrisisActive] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  // Latest messages mirrored to a ref so send/retry can compute the API payload from
  // the current conversation without taking `messages` as a callback dependency
  // (avoids a stale closure double-appending on retry).
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const sessionId = useRef<string | undefined>(undefined);
  // The persisted ai_conversations row id, reused across turns once created. Lives
  // only for the session; consent OFF means it's never populated (no write happens).
  const conversationId = useRef<string | null>(null);
  // Text of the last backend turn — what retry() re-sends. Crisis turns never set it
  // (they don't hit the backend), so retry can't replay a crisis message.
  const lastUserText = useRef<string | null>(null);

  const triggerCrisis = useCallback(() => {
    setCrisisActive(true);
    onCrisis?.();
  }, [onCrisis]);

  // Streams one assistant turn into the placeholder identified by `assistantId`.
  // Shared by send (fresh turn) and retry (replay) so the streaming, persistence and
  // calm-error handling stay identical between the two paths.
  const runTurn = useCallback(
    async (apiMessages: ApiMessage[], assistantId: string, userContent: string) => {
      setStatus('sending');

      // Captured for the post-turn persist (kept out of React state — needed
      // synchronously once the stream resolves).
      let turnMeta: ChatTurnMeta | undefined;
      let assistantText = '';

      const onMeta = (meta: ChatTurnMeta) => {
        turnMeta = meta;
        sessionId.current = meta.sessionId || sessionId.current;
        if (meta.isCrisis) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, isCrisis: true } : m)),
          );
          triggerCrisis();
        }
        if (meta.citations.length > 0) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, citations: meta.citations } : m)),
          );
        }
      };

      try {
        for await (const chunk of sendImpl(
          { messages: apiMessages, sessionId: sessionId.current, region },
          onMeta,
        )) {
          assistantText += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
          );
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
        );
        setStatus('idle');

        // Consent-gated, best-effort cloud backup of the completed exchange. NEVER for
        // a crisis turn (crisis content stays on-device). persistImpl self-no-ops unless
        // the user consented AND is signed in, so consent OFF writes nothing. Fire-and-
        // forget — a failed/blocked write never affects the in-memory conversation.
        //
        // FAIL-CLOSED (PR-073): `turnMeta` is only set by the stream's `done` event.
        // A stream that drops before `done` (serverless timeout, proxy close) leaves
        // it undefined — and may have carried a `safety: CRISIS` event we never saw
        // reflected into meta. No verdict ⇒ no cloud write. `!turnMeta?.isCrisis`
        // here would treat "unknown" as "safe" and bypass both defenses.
        if (turnMeta && !turnMeta.isCrisis) {
          void persistImpl({
            sessionId: turnMeta.sessionId || (sessionId.current ?? ''),
            conversationId: conversationId.current,
            userContent,
            assistantContent: assistantText,
            safetyLevel: turnMeta.safetyLevel,
            citations: turnMeta.citations,
          }).then((id) => {
            if (id) conversationId.current = id;
          });
        }
      } catch (err) {
        if (err instanceof SafetyReplacementError) {
          // SR-3: server replaced the output — REPLACE the partial text, don't append.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: err.message, isStreaming: false } : m,
            ),
          );
          setStatus('idle');
          return;
        }

        // Drop the empty assistant placeholder; show calm error copy. The trailing
        // user message stays so retry() can replay it.
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setStatus('error');
        if (err instanceof MindMateUnavailableError && err.code === 'NO_SESSION') {
          setNeedsSignIn(true);
        }
        setError(
          err instanceof MindMateUnavailableError
            ? err.message
            : 'Something went wrong. Please try again.',
        );
      }
    },
    [region, sendImpl, persistImpl, triggerCrisis],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || status === 'sending') return;
      setError(null);
      setNeedsSignIn(false);

      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text };

      // Client crisis pre-check (SR-2) — instant, offline, takes priority over the
      // AI reply: we surface crisis and do NOT call the backend for this turn.
      // Statically imported so this safety path can never depend on a runtime
      // module fetch resolving.
      if (precheckCrisis(text)) {
        setMessages((prev) => [...prev, userMsg]);
        triggerCrisis();
        return;
      }

      lastUserText.current = text;
      const apiMessages = [...toApi(messagesRef.current), { role: 'user' as const, content: text }];
      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', isStreaming: true },
      ]);
      await runTurn(apiMessages, assistantId, text);
    },
    [status, runTurn, triggerCrisis],
  );

  const retry = useCallback(async () => {
    if (status === 'sending') return;
    const text = lastUserText.current;
    if (!text) return;
    setError(null);
    setNeedsSignIn(false);

    // The failed turn's user message is still the last entry (its assistant placeholder
    // was dropped on error) — re-stream that conversation with a fresh placeholder and
    // no new user message, so the backend sees the same turn, not a duplicate.
    const apiMessages = toApi(messagesRef.current);
    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ]);
    await runTurn(apiMessages, assistantId, text);
  }, [status, runTurn]);

  return { messages, status, error, crisisActive, needsSignIn, send, retry };
}
