import { describe, expect, it, vi } from 'vitest';

import {
  type SupabaseAuthStorage,
  secureStoreStorage,
} from '@/lib/supabase/secure-store-storage';
import { createSupabaseAuthService } from '@/features/auth/supabase-auth-service';

// Minimal fake of the supabase-js surface the service touches. We record calls so
// we can assert the platform claim source, generic error mapping, and audit emission
// WITHOUT a real backend.
function makeFakeClient(overrides: {
  signUp?: unknown;
  signIn?: unknown;
  signOut?: unknown;
  getSession?: unknown;
  resend?: unknown;
  resetPasswordForEmail?: unknown;
  updateUser?: unknown;
  signInWithIdToken?: unknown;
} = {}) {
  // Captured onAuthStateChange callbacks + an unsubscribe spy, so tests can drive
  // the listener and assert teardown.
  const authStateListeners: Array<(event: string, session: unknown) => void> = [];
  const unsubscribe = vi.fn();
  const calls = {
    signUp: vi.fn(
      async (_args: unknown) => overrides.signUp ?? { data: { session: {}, user: {} }, error: null },
    ),
    signInWithPassword: vi.fn(
      async (_args: unknown) => overrides.signIn ?? { data: { session: {}, user: {} }, error: null },
    ),
    signOut: vi.fn(async () => overrides.signOut ?? { error: null }),
    getSession: vi.fn(
      async () => overrides.getSession ?? { data: { session: null }, error: null },
    ),
    resend: vi.fn(async (_args: unknown) => overrides.resend ?? { error: null }),
    resetPasswordForEmail: vi.fn(
      async (_email: string, _opts?: unknown) => overrides.resetPasswordForEmail ?? { error: null },
    ),
    updateUser: vi.fn(
      async (_args: unknown) =>
        overrides.updateUser ?? { data: { user: { email: 'a@b.co', email_confirmed_at: '2026-01-01T00:00:00Z' } }, error: null },
    ),
    signInWithIdToken: vi.fn(
      async (_args: unknown) =>
        overrides.signInWithIdToken ?? {
          data: { session: { user: { email: 'a@b.co', email_confirmed_at: '2026-01-01T00:00:00Z' } } },
          error: null,
        },
    ),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      authStateListeners.push(cb);
      return { data: { subscription: { unsubscribe } } };
    }),
  };
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  // biome-ignore lint/suspicious/noExplicitAny: narrow fake, not the full client type.
  const client = { auth: calls, rpc } as any;
  return { client, calls, rpc, authStateListeners, unsubscribe };
}

describe('supabase auth service — platform claim', () => {
  it('signUp carries platform=mobile in options.data (the JWT claim source)', async () => {
    const { client, calls } = makeFakeClient();
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    await svc.signUp('a@b.co', 'password123');

    expect(calls.signUp).toHaveBeenCalledTimes(1);
    const arg = calls.signUp.mock.calls[0]?.[0] as { options?: { data?: { platform?: string } } };
    expect(arg.options?.data?.platform).toBe('mobile');
  });
});

describe('supabase auth service — audit emission (checklist #5)', () => {
  it('records sign_up via record_auth_event RPC on success', async () => {
    const { client, rpc } = makeFakeClient();
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    await svc.signUp('a@b.co', 'password123');

    expect(rpc).toHaveBeenCalledWith('record_auth_event', {
      p_event_type: 'sign_up',
      p_device_id: 'dev-1',
      p_success: true,
    });
  });

  it('records sign_in on success', async () => {
    const { client, rpc } = makeFakeClient();
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    await svc.signIn('a@b.co', 'password123');

    expect(rpc).toHaveBeenCalledWith(
      'record_auth_event',
      expect.objectContaining({ p_event_type: 'sign_in', p_success: true }),
    );
  });

  it('a failed audit write never breaks the auth result', async () => {
    const { client, rpc } = makeFakeClient();
    rpc.mockRejectedValueOnce(new Error('rpc down'));
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    const result = await svc.signIn('a@b.co', 'password123');

    expect(result.ok).toBe(true);
  });
});

describe('supabase auth service — generic errors (checklist #3, no existence leak)', () => {
  it('signIn maps any auth error to invalid-credentials (no message leak)', async () => {
    const { client } = makeFakeClient({
      signIn: { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    const result = await svc.signIn('a@b.co', 'wrong');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid-credentials');
    // No raw message surfaces — only the generic union code.
    expect(Object.values(result)).not.toContain('Invalid login credentials');
  });

  it('signUp never reveals "already registered" — collapses to invalid-credentials', async () => {
    const { client } = makeFakeClient({
      signUp: { data: { session: null, user: null }, error: { message: 'User already registered' } },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    const result = await svc.signUp('taken@b.co', 'password123');

    expect(result).toEqual({ ok: false, error: 'invalid-credentials' });
  });

  it('network failures map to offline', async () => {
    const { client } = makeFakeClient({
      signIn: { data: { session: null, user: null }, error: { name: 'AuthRetryableFetchError', message: 'fetch failed' } },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    const result = await svc.signIn('a@b.co', 'password123');

    expect(result.error).toBe('offline');
  });

  it('an unconfirmed account (correct password) maps to email-not-confirmed by code (P14)', async () => {
    const { client } = makeFakeClient({
      signIn: { data: { session: null, user: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    const result = await svc.signIn('a@b.co', 'password123');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('email-not-confirmed');
  });

  it('falls back to the message when no error code is present', async () => {
    const { client } = makeFakeClient({
      signIn: { data: { session: null, user: null }, error: { message: 'Email not confirmed' } },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    expect((await svc.signIn('a@b.co', 'password123')).error).toBe('email-not-confirmed');
  });
});

describe('supabase auth service — getSession (boot hydration)', () => {
  it('maps a confirmed session to {email, verified:true}', async () => {
    const { client } = makeFakeClient({
      getSession: {
        data: { session: { user: { email: 'a@b.co', email_confirmed_at: '2026-01-01T00:00:00Z' } } },
        error: null,
      },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    expect(await svc.getSession()).toEqual({ email: 'a@b.co', verified: true, name: null });
  });

  it('derives the display name from a verified session metadata (P63)', async () => {
    const { client } = makeFakeClient({
      getSession: {
        data: {
          session: {
            user: {
              email: 'a@b.co',
              email_confirmed_at: '2026-01-01T00:00:00Z',
              user_metadata: { full_name: '  Mara Vane ' },
            },
          },
        },
        error: null,
      },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    expect(await svc.getSession()).toEqual({ email: 'a@b.co', verified: true, name: 'Mara Vane' });
  });

  it('does not expose a name while unverified, even if metadata carries one', async () => {
    const { client } = makeFakeClient({
      getSession: {
        data: {
          session: {
            user: { email: 'a@b.co', email_confirmed_at: null, user_metadata: { full_name: 'Mara' } },
          },
        },
        error: null,
      },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    expect(await svc.getSession()).toEqual({ email: 'a@b.co', verified: false, name: null });
  });

  it('maps an unconfirmed session to verified:false', async () => {
    const { client } = makeFakeClient({
      getSession: {
        data: { session: { user: { email: 'a@b.co', email_confirmed_at: null } } },
        error: null,
      },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    expect(await svc.getSession()).toEqual({ email: 'a@b.co', verified: false, name: null });
  });

  it('returns null when there is no persisted session', async () => {
    const { client } = makeFakeClient(); // default getSession → session:null
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    expect(await svc.getSession()).toBeNull();
  });
});

describe('supabase auth service — onAuthChange (runtime state updater)', () => {
  it('forwards mapped sessions to the listener and unsubscribes on teardown', () => {
    const { client, authStateListeners, unsubscribe } = makeFakeClient();
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });
    const seen: Array<{ email: string; verified: boolean } | null> = [];

    const stop = svc.onAuthChange((s) => seen.push(s));

    // Drive supabase-js firing SIGNED_IN then SIGNED_OUT.
    authStateListeners[0]?.('SIGNED_IN', {
      user: { email: 'a@b.co', email_confirmed_at: '2026-01-01T00:00:00Z' },
    });
    authStateListeners[0]?.('SIGNED_OUT', null);

    expect(seen).toEqual([{ email: 'a@b.co', verified: true, name: null }, null]);

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('supabase auth service — signUp with confirm-email ON (PR-076)', () => {
  it('returns the needs-verification shape — NO live session is fabricated', async () => {
    const { client, rpc } = makeFakeClient({
      // Production behavior with confirm-email ON: account created, session is null.
      signUp: {
        data: { session: null, user: { email: 'a@b.co', email_confirmed_at: null } },
        error: null,
      },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    const result = await svc.signUp('a@b.co', 'password123');

    // ok, but session is explicitly null + flagged — callers cannot setSession().
    expect(result).toEqual({ ok: true, session: null, needsVerification: true });
    // No session → no auth.uid() → no audit RPC fires either.
    expect(rpc).not.toHaveBeenCalled();
  });

  it('still returns a live session when supabase does (confirm-email OFF)', async () => {
    const { client } = makeFakeClient({
      signUp: {
        data: {
          session: {},
          user: { email: 'a@b.co', email_confirmed_at: '2026-01-01T00:00:00Z' },
        },
        error: null,
      },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    const result = await svc.signUp('a@b.co', 'password123');

    expect(result).toEqual({
      ok: true,
      session: { email: 'a@b.co', verified: true, name: null },
    });
  });
});

describe('supabase auth service — signUp full name (Amendment 2026-06-16)', () => {
  it('carries full_name in options.data alongside platform', async () => {
    const { client, calls } = makeFakeClient();
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    await svc.signUp('a@b.co', 'password123', 'John Doe');

    const arg = calls.signUp.mock.calls[0]?.[0] as {
      options?: { data?: { platform?: string; full_name?: string }; emailRedirectTo?: string };
    };
    expect(arg.options?.data?.platform).toBe('mobile');
    expect(arg.options?.data?.full_name).toBe('John Doe');
    expect(arg.options?.emailRedirectTo).toContain('psychage');
  });
});

describe('supabase auth service — requestPasswordReset (anti-enumeration)', () => {
  it('resolves ok even when the address is unknown (no existence leak)', async () => {
    const { client } = makeFakeClient({
      // A real "user not found" still must look like success.
      resetPasswordForEmail: { error: { message: 'User not found' } },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    expect(await svc.requestPasswordReset('a@b.co')).toEqual({ ok: true });
  });

  it('returns ok:false only on a network failure', async () => {
    const { client } = makeFakeClient({
      resetPasswordForEmail: { error: { name: 'AuthRetryableFetchError', message: 'fetch failed' } },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    expect(await svc.requestPasswordReset('a@b.co')).toEqual({ ok: false });
  });
});

describe('supabase auth service — updatePassword (recovery session)', () => {
  it('returns ok with the mapped session on success', async () => {
    const { client } = makeFakeClient();
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    const result = await svc.updatePassword('a-new-strong-password');

    expect(result.ok).toBe(true);
    expect(result.session).toEqual({ email: 'a@b.co', verified: true, name: null });
  });

  it('maps a length/strength rejection to weak-password (not an existence leak)', async () => {
    const { client } = makeFakeClient({
      updateUser: { data: { user: null }, error: { message: 'Password should be at least 6 characters' } },
    });
    const svc = createSupabaseAuthService({ client, deviceId: 'dev-1' });

    const result = await svc.updatePassword('short');

    expect(result.error).toBe('weak-password');
  });
});

describe('supabase auth service — signInWithProvider (social)', () => {
  it('exchanges the id-token and records the audit event on success', async () => {
    const { client, rpc } = makeFakeClient();
    const svc = createSupabaseAuthService({
      client,
      deviceId: 'dev-1',
      getProviderCredential: async () => ({ provider: 'apple', idToken: 'tok', nonce: 'n' }),
    });

    const result = await svc.signInWithProvider('apple');

    expect(client.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'tok',
      nonce: 'n',
    });
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      'record_auth_event',
      expect.objectContaining({ p_event_type: 'sign_in', p_success: true }),
    );
  });

  it('returns cancelled (no error toast) when the user dismisses the sheet', async () => {
    const { client } = makeFakeClient();
    const svc = createSupabaseAuthService({
      client,
      deviceId: 'dev-1',
      getProviderCredential: async () => ({ cancelled: true }),
    });

    const result = await svc.signInWithProvider('google');

    expect(result).toEqual({ ok: false, error: 'cancelled' });
    expect(client.auth.signInWithIdToken).not.toHaveBeenCalled();
  });
});

describe('secure-store session storage (checklist #4)', () => {
  it('satisfies the async getItem/setItem/removeItem contract', async () => {
    const store: SupabaseAuthStorage = secureStoreStorage;
    await store.setItem('k', 'v');
    expect(await store.getItem('k')).toBe('v');
    await store.removeItem('k');
    expect(await store.getItem('k')).toBeNull();
  });
});
