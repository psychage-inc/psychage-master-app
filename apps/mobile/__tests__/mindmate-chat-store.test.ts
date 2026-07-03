// Unit tests for the best-effort, consent-gated MindMate persistence (persistExchange).
// Exercises every privacy gate (env / consent / session / crisis), the create-then-
// insert flow, conversation-id reuse, and the swallow guarantee — via an injected fake
// client + deps. No real Supabase, no network. Mirrors check-in-push.test.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { type ChatExchange, type ChatPersistDeps, persistExchange } from '@/features/mindmate/persistence/chat-store';

interface Capture {
  tables: string[];
  conversationInsert?: Record<string, unknown>;
  messageInsert?: Record<string, unknown>[];
}

interface ClientOpts {
  conversationError?: boolean;
  throwOnConversation?: boolean;
  throwOnMessages?: boolean;
  messageError?: boolean;
}

/** Fake supabase client recording the conversation + message inserts. */
function makeClient(capture: Capture, opts: ClientOpts = {}): SupabaseClient {
  return {
    from: (table: string) => {
      capture.tables.push(table);
      if (table === 'ai_conversations') {
        return {
          insert: (values: Record<string, unknown>) => {
            if (opts.throwOnConversation) throw new Error('network down');
            capture.conversationInsert = values;
            return {
              select: () => ({
                single: async () =>
                  opts.conversationError
                    ? { data: null, error: { message: 'rls denied' } }
                    : { data: { id: 'conv-1' }, error: null },
              }),
            };
          },
        };
      }
      // ai_messages
      return {
        insert: async (rows: Record<string, unknown>[]) => {
          if (opts.throwOnMessages) throw new Error('network down');
          capture.messageInsert = rows;
          return { error: opts.messageError ? { message: 'insert failed' } : null };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const BASE: ChatExchange = {
  sessionId: 's1',
  conversationId: null,
  userContent: 'what is anxiety',
  assistantContent: 'Anxiety is a common experience...',
  safetyLevel: 'SAFE',
  citations: [{ id: 'd1', title: 'Anxiety basics', url: '/learn/anxiety' }],
};

function deps(over: Partial<ChatPersistDeps>, capture: Capture, opts: ClientOpts = {}): ChatPersistDeps {
  return {
    enabled: () => true,
    getConsent: () => true,
    getUserId: async () => 'user-1',
    getWriteClient: () => makeClient(capture, opts),
    ...over,
  };
}

describe('persistExchange — best-effort consent-gated backup', () => {
  it('creates the conversation then inserts both turns when all gates pass', async () => {
    const capture: Capture = { tables: [] };
    const id = await persistExchange(BASE, deps({}, capture));

    expect(id).toBe('conv-1');
    expect(capture.tables).toEqual(['ai_conversations', 'ai_messages']);
    expect(capture.conversationInsert).toEqual({
      session_id: 's1',
      user_id: 'user-1',
      language: 'en',
    });
    expect(capture.messageInsert).toEqual([
      { conversation_id: 'conv-1', role: 'user', content: 'what is anxiety', streamed: false },
      {
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Anxiety is a common experience...',
        safety_flag: 'SAFE',
        sources_cited: [{ id: 'd1', title: 'Anxiety basics', url: '/learn/anxiety' }],
        streamed: true,
      },
    ]);
  });

  it('reuses an existing conversation id (no second conversation row)', async () => {
    const capture: Capture = { tables: [] };
    const id = await persistExchange(
      { ...BASE, conversationId: 'conv-existing' },
      deps({}, capture),
    );

    expect(id).toBe('conv-existing');
    expect(capture.tables).toEqual(['ai_messages']);
    expect(capture.conversationInsert).toBeUndefined();
    expect(capture.messageInsert?.[0]).toMatchObject({ conversation_id: 'conv-existing' });
  });

  it('skips entirely when Supabase is not configured (no auth read)', async () => {
    const capture: Capture = { tables: [] };
    const getUserId = vi.fn(async () => 'user-1');
    const id = await persistExchange(BASE, deps({ enabled: () => false, getUserId }, capture));

    expect(getUserId).not.toHaveBeenCalled();
    expect(capture.tables).toEqual([]);
    expect(id).toBeNull();
  });

  it('skips entirely when the user has NOT consented (default OFF gate)', async () => {
    const capture: Capture = { tables: [] };
    const getUserId = vi.fn(async () => 'user-1');
    const id = await persistExchange(BASE, deps({ getConsent: () => false, getUserId }, capture));

    expect(getUserId).not.toHaveBeenCalled();
    expect(capture.tables).toEqual([]);
    expect(id).toBeNull();
  });

  it('skips when signed out (no session)', async () => {
    const capture: Capture = { tables: [] };
    const id = await persistExchange(BASE, deps({ getUserId: async () => null }, capture));

    expect(capture.tables).toEqual([]);
    expect(id).toBeNull();
  });

  it('NEVER persists a CRISIS turn — crisis content stays on-device', async () => {
    const capture: Capture = { tables: [] };
    const getUserId = vi.fn(async () => 'user-1');
    const id = await persistExchange(
      { ...BASE, safetyLevel: 'CRISIS', conversationId: 'conv-existing' },
      deps({ getUserId }, capture),
    );

    // Guarded before auth is even read; nothing is written.
    expect(getUserId).not.toHaveBeenCalled();
    expect(capture.tables).toEqual([]);
    expect(id).toBe('conv-existing');
  });

  it('FAIL-CLOSED: never persists when the safety verdict is absent (stream dropped before done — PR-073)', async () => {
    const capture: Capture = { tables: [] };
    const getUserId = vi.fn(async () => 'user-1');
    const id = await persistExchange(
      { ...BASE, safetyLevel: undefined, conversationId: 'conv-existing' },
      deps({ getUserId }, capture),
    );

    // An exchange without a verdict may be a crisis turn whose meta never arrived.
    // Treated exactly like CRISIS: guarded before auth, nothing written.
    expect(getUserId).not.toHaveBeenCalled();
    expect(capture.tables).toEqual([]);
    expect(id).toBe('conv-existing');
  });

  it('swallows a message-insert throw and never rejects (in-memory chat unaffected)', async () => {
    const capture: Capture = { tables: [] };
    await expect(
      persistExchange(BASE, deps({}, capture, { throwOnMessages: true })),
    ).resolves.toBe('conv-1');
  });

  it('returns null when the conversation insert errors out', async () => {
    const capture: Capture = { tables: [] };
    const id = await persistExchange(BASE, deps({}, capture, { conversationError: true }));
    expect(id).toBeNull();
    expect(capture.messageInsert).toBeUndefined();
  });
});
