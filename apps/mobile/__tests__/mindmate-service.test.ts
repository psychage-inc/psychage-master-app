import { describe, expect, it, vi } from 'vitest';

import {
  ConsentRequiredError,
  MindMateUnavailableError,
  SafetyReplacementError,
} from '@/features/mindmate/errors';
import { sendMessage } from '@/features/mindmate/mindmate-service';
import type { ChatTurnMeta } from '@/features/mindmate/types';

const enc = new TextEncoder();
const sse = (e: unknown) => `data: ${JSON.stringify(e)}\n\n`;

function bodyFrom(records: string[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < records.length) c.enqueue(enc.encode(records[i++]));
      else c.close();
    },
  });
}

interface FakeResponseInit {
  ok?: boolean;
  status?: number;
  contentType: string;
  body?: ReadableStream<Uint8Array> | null;
  text?: string;
  json?: unknown;
}

function fakeResponse(init: FakeResponseInit) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: 'OK',
    headers: {
      get: (n: string) => (n.toLowerCase() === 'content-type' ? init.contentType : null),
    },
    body: init.body ?? null,
    text: async () => init.text ?? '',
    json: async () => init.json ?? {},
  };
}

const INPUT = { messages: [{ role: 'user' as const, content: 'hello' }], region: 'US' };
const TOKEN_DEPS = { getAccessToken: async () => 'jwt-abc' };

async function drain(gen: AsyncGenerator<string>): Promise<string> {
  let out = '';
  for await (const chunk of gen) out += chunk;
  return out;
}

describe('sendMessage (backend wiring)', () => {
  it('throws NO_SESSION when there is no access token (never calls fetch)', async () => {
    const fetchImpl = vi.fn();
    const gen = sendMessage(INPUT, () => {}, {
      getAccessToken: async () => null,
      fetchImpl: fetchImpl as never,
    });
    await expect(gen.next()).rejects.toBeInstanceOf(MindMateUnavailableError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('POSTs to the web endpoint with the bearer token and stream:true', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({ contentType: 'text/event-stream', body: bodyFrom([sse({ type: 'done' })]) }),
    );
    await drain(sendMessage(INPUT, () => {}, { ...TOKEN_DEPS, fetchImpl: fetchImpl as never }));

    const [url, opts] = fetchImpl.mock.calls[0] as unknown as [string, Record<string, unknown>];
    // Posts straight at the canonical www host — NOT the apex, which 307-redirects and
    // would strip the Authorization header on the cross-origin hop.
    expect(url).toBe('https://www.psychage.com/api/ai/chat');
    const headers = opts.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-abc');
    const sent = JSON.parse(opts.body as string);
    expect(sent.stream).toBe(true);
    expect(sent.region).toBe('US');
    expect(sent.messages).toEqual(INPUT.messages);
  });

  it('streams tokens and reports citations + safety on done', async () => {
    const fetchImpl = async () =>
      fakeResponse({
        contentType: 'text/event-stream',
        body: bodyFrom([
          sse({ type: 'metadata', sessionId: 's1' }),
          sse({ type: 'safety', level: 'SAFE' }),
          sse({ type: 'token', content: 'Hello ' }),
          sse({ type: 'token', content: 'there' }),
          sse({
            type: 'citations',
            citations: [{ document_id: 'd1', title: 'Anxiety basics', url_path: '/learn/anxiety' }],
          }),
          sse({ type: 'done' }),
        ]),
      });

    let meta: ChatTurnMeta | undefined;
    const text = await drain(
      sendMessage(INPUT, (m) => (meta = m), { ...TOKEN_DEPS, fetchImpl: fetchImpl as never }),
    );

    expect(text).toBe('Hello there');
    expect(meta?.sessionId).toBe('s1');
    expect(meta?.safetyLevel).toBe('SAFE');
    expect(meta?.isCrisis).toBe(false);
    expect(meta?.citations).toEqual([
      { id: 'd1', title: 'Anxiety basics', url: '/learn/anxiety' },
    ]);
  });

  it('handles the crisis JSON path (server never streams an LLM reply)', async () => {
    const fetchImpl = async () =>
      fakeResponse({
        contentType: 'application/json',
        json: {
          message: 'You deserve support right now. Reach out to a helpline.',
          citations: [],
          sessionId: 's2',
          safetyLevel: 'CRISIS',
          isCrisis: true,
        },
      });

    let meta: ChatTurnMeta | undefined;
    const text = await drain(
      sendMessage(INPUT, (m) => (meta = m), { ...TOKEN_DEPS, fetchImpl: fetchImpl as never }),
    );

    expect(text).toContain('helpline');
    expect(meta?.isCrisis).toBe(true);
    expect(meta?.safetyLevel).toBe('CRISIS');
  });

  it('maps a SAFETY_VIOLATION error frame to SafetyReplacementError', async () => {
    const fetchImpl = async () =>
      fakeResponse({
        contentType: 'text/event-stream',
        body: bodyFrom([
          sse({ type: 'token', content: 'partial...' }),
          sse({ type: 'error', code: 'SAFETY_VIOLATION', message: 'Replaced for safety.' }),
        ]),
      });

    const gen = sendMessage(INPUT, () => {}, { ...TOKEN_DEPS, fetchImpl: fetchImpl as never });
    await expect(drain(gen)).rejects.toBeInstanceOf(SafetyReplacementError);
  });

  it('surfaces a structured handler error (e.g. rate limit) as a plain Error', async () => {
    const fetchImpl = async () =>
      fakeResponse({
        ok: false,
        status: 429,
        contentType: 'application/json',
        text: JSON.stringify({ error: 'Rate limit exceeded' }),
      });

    const gen = sendMessage(INPUT, () => {}, { ...TOKEN_DEPS, fetchImpl: fetchImpl as never });
    await expect(gen.next()).rejects.toThrow('Rate limit exceeded');
  });

  it('maps 403 { code: CONSENT_REQUIRED } to ConsentRequiredError (item 5 consent gate)', async () => {
    const fetchImpl = async () =>
      fakeResponse({
        ok: false,
        status: 403,
        contentType: 'application/json',
        text: JSON.stringify({ code: 'CONSENT_REQUIRED', error: 'Consent required' }),
      });

    const gen = sendMessage(INPUT, () => {}, { ...TOKEN_DEPS, fetchImpl: fetchImpl as never });
    await expect(gen.next()).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  it('a 403 without CONSENT_REQUIRED is not treated as a consent refusal', async () => {
    const fetchImpl = async () =>
      fakeResponse({
        ok: false,
        status: 403,
        contentType: 'application/json',
        text: JSON.stringify({ error: 'Forbidden' }),
      });

    const gen = sendMessage(INPUT, () => {}, { ...TOKEN_DEPS, fetchImpl: fetchImpl as never });
    const err = await gen.next().catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ConsentRequiredError);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Forbidden');
  });
});
