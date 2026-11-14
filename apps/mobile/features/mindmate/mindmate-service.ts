// MindMate backend wiring (mobile). Calls the SAME endpoint the web uses:
//   POST https://psychage.com/api/ai/chat
// with a Supabase session bearer token. NO LLM key is ever in the client — the
// server holds ANTHROPIC_API_KEY and runs the whole safety pipeline (crisis
// classifier, output validation). This module only sends messages and decodes
// the reply. Mirrors psychage-v2/src/features/chat/services/chatService.ts.
//
// Streaming uses `expo/fetch` (Expo SDK 54), whose Response.body is a real
// `ReadableStream<Uint8Array>` — RN's built-in fetch cannot stream bodies. Both
// the fetch impl and the token reader are injectable so the generator is unit-
// testable under Vitest (node) without loading native modules.

import { ConsentRequiredError, MindMateUnavailableError, SafetyReplacementError } from './errors';
import { mapCitation, parseSSEStream } from './streaming';
import {
  type ApiJsonResponse,
  type ApiMessage,
  type Citation,
  type ChatTurnMeta,
  normalizeSafetyLevel,
} from './types';

// The CANONICAL app host — NOT the apex. `psychage.com/api/ai/chat` answers with a
// 307 redirect to `www.psychage.com`; following a redirect across origins drops the
// `Authorization` header (Fetch spec), so the bearer would be lost and every request
// 401s even when signed in. Posting straight at www avoids the redirect entirely. The
// web client never hits this because it runs on www (same origin). Overridable via
// deps.origin for tests.
const CHAT_ORIGIN = 'https://www.psychage.com';
const CHAT_PATH = '/api/ai/chat';

// --- minimal structural fetch types (so we don't depend on expo/fetch's d.ts) ---

interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<FetchResponseLike>;

export interface SendMessageInput {
  messages: ApiMessage[];
  sessionId?: string;
  /** Region code (e.g. 'US') so crisis resources match the user's locale. */
  region?: string;
}

export interface SendMessageDeps {
  /** Defaults to the lazily-imported `expo/fetch`. Injected in tests. */
  fetchImpl?: FetchLike;
  /** Defaults to reading the Supabase auth session. Injected in tests. */
  getAccessToken?: () => Promise<string | null>;
  /** Defaults to the production web origin. */
  origin?: string;
}

/** Lazy so Vitest never loads `expo/fetch` (native) when a fake is injected. */
async function defaultFetch(): Promise<FetchLike> {
  const mod = (await import('expo/fetch')) as { fetch: unknown };
  return mod.fetch as FetchLike;
}

/** Lazy so the supabase client isn't pulled into node tests. */
async function defaultGetAccessToken(): Promise<string | null> {
  const { getSupabaseAuthClient, isSupabaseConfigured } = await import('@/lib/supabase/client');
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabaseAuthClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Stream a MindMate reply. Yields text chunks as they arrive; reports the turn's
 * citations + safety verdict once via `onMeta`. Throws:
 *  - MindMateUnavailableError — no session, or a non-JSON platform failure.
 *  - SafetyReplacementError   — server replaced the output (consumer must REPLACE).
 *  - ConsentRequiredError     — 403 CONSENT_REQUIRED: no current MindMate consent.
 *  - Error                    — a structured handler error (e.g. rate limit).
 *
 * CRISIS path: the server answers with JSON (`isCrisis: true`) and never runs the
 * LLM; we surface that via `onMeta` and yield the crisis copy as a single chunk.
 */
export async function* sendMessage(
  input: SendMessageInput,
  onMeta: (meta: ChatTurnMeta) => void,
  deps: SendMessageDeps = {},
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const getToken = deps.getAccessToken ?? defaultGetAccessToken;
  const token = await getToken();
  if (!token) {
    throw new MindMateUnavailableError('Sign in to chat with MindMate.', { code: 'NO_SESSION' });
  }

  const fetchImpl = deps.fetchImpl ?? (await defaultFetch());
  const origin = deps.origin ?? CHAT_ORIGIN;

  const response = await fetchImpl(`${origin}${CHAT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: input.messages,
      sessionId: input.sessionId,
      region: input.region,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    // Read the body once. Structured handler errors are JSON with `.error`;
    // platform failures (cold start, proxy HTML) are not parseable — and we never
    // log the body anywhere (privacy: no chat content leaves the device path).
    const bodyText = await response.text().catch(() => '');
    let parsedError: string | null = null;
    let parsedCode: unknown;
    try {
      const parsed = JSON.parse(bodyText) as { error?: unknown; code?: unknown };
      if (typeof parsed.error === 'string') parsedError = parsed.error;
      parsedCode = parsed.code;
    } catch {
      // not JSON → platform failure
    }
    // Consent gate (item 5): no current consent → back to the consent flow.
    if (response.status === 403 && parsedCode === 'CONSENT_REQUIRED') {
      throw new ConsentRequiredError();
    }
    if (parsedError) throw new Error(parsedError);
    throw new MindMateUnavailableError(`MindMate is unavailable (status ${response.status}).`, {
      code: 'PLATFORM',
    });
  }

  const contentType = response.headers.get('Content-Type') ?? '';

  // ── JSON path: crisis responses + the stream:false fallback ──
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as ApiJsonResponse;
    onMeta({
      citations: (data.citations ?? []).map(mapCitation),
      safetyLevel: normalizeSafetyLevel(data.safetyLevel),
      isCrisis: data.isCrisis ?? false,
      sessionId: data.sessionId,
    });
    if (data.message) yield data.message;
    return;
  }

  // ── SSE path ──
  if (!response.body) {
    throw new MindMateUnavailableError('MindMate returned no response body.', { code: 'NO_BODY' });
  }

  let safetyLevel = normalizeSafetyLevel('SAFE');
  let receivedSessionId = input.sessionId ?? '';
  const citations: Citation[] = [];

  for await (const event of parseSSEStream(response.body)) {
    switch (event.type) {
      case 'token':
        yield event.content;
        break;
      case 'metadata':
        receivedSessionId = event.sessionId;
        break;
      case 'safety':
        safetyLevel = normalizeSafetyLevel(event.level);
        break;
      case 'citations':
        for (const c of event.citations) citations.push(mapCitation(c));
        break;
      case 'error':
        // SR-3: the server replaced the output — consumer must replace, not append.
        if (event.code === 'SAFETY_VIOLATION') {
          throw new SafetyReplacementError(event.message);
        }
        throw new Error(event.message);
      case 'done':
        onMeta({
          citations,
          safetyLevel,
          isCrisis: safetyLevel === 'CRISIS',
          sessionId: receivedSessionId,
        });
        break;
    }
  }
}
