import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RESET_PASSWORD_PATH, VERIFY_SUCCESS_PATH } from '@/lib/auth/redirects';

// handleUrl(url, router) — the auth deep-link decision seam (PR-078). These tests
// pin the failure routing: expired/invalid RECOVERY links land on reset-password
// ?status=expired, expired/invalid VERIFICATION links land on the /verify resend
// surface (previously silent), and successes land on their real targets. No token
// values are asserted into any route (SR-11).

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  configured: { value: true },
}));

vi.mock('expo-linking', () => ({
  getInitialURL: vi.fn(async () => null),
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock('expo-router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => mocks.configured.value,
  getSupabaseAuthClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      setSession: mocks.setSession,
    },
  }),
}));

import { handleUrl } from '@/lib/auth/deep-link';
import type { Router } from 'expo-router';

function makeRouter() {
  const replace = vi.fn();
  return { router: { replace } as unknown as Router, replace };
}

beforeEach(() => {
  mocks.configured.value = true;
  mocks.exchangeCodeForSession.mockReset();
  mocks.setSession.mockReset();
});

describe('auth deep-link handleUrl — verification failures (PR-078)', () => {
  it('routes an errored verification link to the /verify resend surface', async () => {
    const { router, replace } = makeRouter();
    await handleUrl(
      'psychage:///verify-success#error=access_denied&error_code=otp_expired&type=signup',
      router,
    );
    expect(replace).toHaveBeenCalledWith('/verify');
  });

  it('routes a failed verification code exchange to /verify', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });
    const { router, replace } = makeRouter();
    await handleUrl('psychage:///verify-success?code=abc123', router);
    expect(replace).toHaveBeenCalledWith('/verify');
  });

  it('routes a verification link with no usable tokens to /verify', async () => {
    const { router, replace } = makeRouter();
    await handleUrl('psychage:///verify-success', router);
    expect(replace).toHaveBeenCalledWith('/verify');
  });
});

describe('auth deep-link handleUrl — existing behavior preserved', () => {
  it('routes a successful verification to verify-success', async () => {
    mocks.setSession.mockResolvedValue({ error: null });
    const { router, replace } = makeRouter();
    await handleUrl(
      'psychage:///verify-success#access_token=a&refresh_token=b&type=signup',
      router,
    );
    expect(replace).toHaveBeenCalledWith(VERIFY_SUCCESS_PATH);
  });

  it('routes an errored recovery link to reset-password ?status=expired', async () => {
    const { router, replace } = makeRouter();
    await handleUrl('psychage:///reset-password#error=access_denied&type=recovery', router);
    expect(replace).toHaveBeenCalledWith({
      pathname: RESET_PASSWORD_PATH,
      params: { status: 'expired' },
    });
  });

  it('routes a failed recovery code exchange to reset-password ?status=expired', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });
    const { router, replace } = makeRouter();
    await handleUrl('psychage:///reset-password?code=abc123', router);
    expect(replace).toHaveBeenCalledWith({
      pathname: RESET_PASSWORD_PATH,
      params: { status: 'expired' },
    });
  });

  it('ignores non-auth URLs', async () => {
    const { router, replace } = makeRouter();
    await handleUrl('psychage:///article/anxiety-basics', router);
    expect(replace).not.toHaveBeenCalled();
  });
});
