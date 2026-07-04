// The REAL Supabase-backed AuthService (Slice 2 — platform JWT claim).
//
// Implements the same AuthService interface the screens already consume (see
// auth-service.ts). The in-memory stub stays for tests and for builds without
// Supabase env; use-auth selects this one when EXPO_PUBLIC_SUPABASE_* is set.
//
// WHAT THIS WIRES (and only this):
//   - signUp carries `options.data = { platform: 'mobile' }` -> raw_user_meta_data
//     -> the custom_access_token hook lifts it to a top-level `platform` JWT claim
//     (migration 20260614000007). That claim is what the slice-1 RLS write policies
//     check. No personal-data writes happen here.
//   - successful auth events emit an audit_events row via the record_auth_event
//     SECURITY DEFINER RPC (migration 20260614000006) — Procedure-B checklist #5.
//
// SECURITY (Procedure-B checklist #3): error codes are GENERIC. We NEVER surface
// whether an email is registered — every credential/sign-up failure collapses to
// 'invalid-credentials' (or 'offline' for network failures). No message strings
// leave this module.

import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { getOrCreateDeviceId } from '@/lib/device-id';
import { EMAIL_VERIFY_REDIRECT, PASSWORD_RESET_REDIRECT } from '@/lib/auth/redirects';
import { getSupabaseAuthClient } from '@/lib/supabase/client';
import { isNetworkError } from '@/lib/supabase/is-network-error';

import type {
  AuthResult,
  AuthService,
  AuthSession,
  SocialProvider,
  VerificationStatus,
} from './auth-service';

type AuthEventType = 'sign_up' | 'sign_in' | 'sign_out';

/** Native id-token acquisition seam — see lib/auth/social.ts. Injected in tests. */
type ProviderCredential =
  | { readonly cancelled: true }
  | { readonly provider: SocialProvider; readonly idToken: string; readonly nonce?: string };
type GetProviderCredential = (provider: SocialProvider) => Promise<ProviderCredential>;

/** Minimal shape of the supabase user fields we read for the display name (P63). */
type NamedUser = { user_metadata?: Record<string, unknown> | null } | null | undefined;

/**
 * The verified method's display name (P63): Google's profile name, or the full_name
 * entered at email signup. Null while unverified, or when the method carries no name
 * (we never invent one — e.g. no email-local-part fallback).
 */
function deriveName(user: NamedUser, verified: boolean): string | null {
  if (!verified || !user) return null;
  const meta = user.user_metadata ?? {};
  const candidate = meta.full_name ?? meta.name;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

// Map a supabase-js Session to the lightweight AuthSession the UI reads. The same
// {email, verified, name} shape signUp/signIn already return — so boot-hydration and
// the onAuthStateChange listener stay consistent with the post-auth result.
function toAuthSession(session: Session | null): AuthSession | null {
  const user = session?.user;
  const email = user?.email;
  if (!email) return null;
  const verified = Boolean(user?.email_confirmed_at);
  return { email, verified, name: deriveName(user, verified) };
}

export interface SupabaseAuthServiceDeps {
  /** Defaults to the lazy app singleton; injected in tests. */
  readonly client?: SupabaseClient;
  /** Defaults to the stable per-install id; injected in tests. */
  readonly deviceId?: string;
  /**
   * Defaults to a LAZY import of lib/auth/social (keeps its native modules out of
   * the Vitest graph — only loaded the first time a social sign-in actually runs).
   * Injected with a fake in tests.
   */
  readonly getProviderCredential?: GetProviderCredential;
}

export function createSupabaseAuthService(deps: SupabaseAuthServiceDeps = {}): AuthService {
  const client = deps.client ?? getSupabaseAuthClient();
  const deviceId = deps.deviceId ?? getOrCreateDeviceId();
  const getProviderCredential: GetProviderCredential =
    deps.getProviderCredential ??
    ((provider) => import('@/lib/auth/social').then((m) => m.getProviderCredential(provider)));

  // Best-effort audit. Never throws into the auth UX; a failed audit write must
  // not block sign-in. Requires an authenticated session (auth.uid()).
  async function recordEvent(eventType: AuthEventType, success: boolean): Promise<void> {
    try {
      await client.rpc('record_auth_event', {
        p_event_type: eventType,
        p_device_id: deviceId,
        p_success: success,
      });
    } catch {
      // swallow — audit is non-blocking
    }
  }

  return {
    async signUp(email, password, fullName) {
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            // platform claim source — lifted to a top-level JWT claim by the hook.
            // full_name (optional) is a display alias only (rules/auth.md §9).
            data: { platform: 'mobile', ...(fullName ? { full_name: fullName.trim() } : {}) },
            // Deep-link the confirmation email back into the app (WS-B).
            emailRedirectTo: EMAIL_VERIFY_REDIRECT,
          },
        });
        if (error) {
          // Generic only: do NOT distinguish "already registered" (existence leak).
          return { ok: false, error: isNetworkError(error) ? 'offline' : 'invalid-credentials' };
        }
        if (!data.session) {
          // Confirm-email ON: the account was created (or already existed — Supabase
          // obfuscates, no existence leak) but there is NO session until the emailed
          // link is tapped. Never fabricate a signed-in state here (PR-076) — the
          // caller routes to /verify and must not setSession().
          return { ok: true, session: null, needsVerification: true };
        }
        await recordEvent('sign_up', true);
        const verified = Boolean(data.user?.email_confirmed_at);
        return {
          ok: true,
          session: { email, verified, name: deriveName(data.user, verified) },
        };
      } catch (error) {
        return { ok: false, error: isNetworkError(error) ? 'offline' : 'unknown' };
      }
    },

    async signInWithProvider(provider) {
      try {
        const credential = await getProviderCredential(provider);
        // User dismissed the OS sheet — not an error, no toast.
        if ('cancelled' in credential) return { ok: false, error: 'cancelled' };
        const { data, error } = await client.auth.signInWithIdToken({
          provider,
          token: credential.idToken,
          // Apple binds a nonce; Google (auth-code flow) does not — only send when present.
          ...(credential.nonce ? { nonce: credential.nonce } : {}),
        });
        if (error) {
          return { ok: false, error: isNetworkError(error) ? 'offline' : 'invalid-credentials' };
        }
        const session = toAuthSession(data.session);
        if (!session) return { ok: false, error: 'unknown' };
        await recordEvent('sign_in', true);
        return { ok: true, session };
      } catch (error) {
        return { ok: false, error: isNetworkError(error) ? 'offline' : 'unknown' };
      }
    },

    async requestPasswordReset(email) {
      // ANTI-ENUMERATION: resolve ok regardless of whether the email exists. Only a
      // network failure returns ok:false (so the UI can be honestly "you're offline").
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: PASSWORD_RESET_REDIRECT,
        });
        if (error && isNetworkError(error)) return { ok: false };
        return { ok: true };
      } catch (error) {
        return { ok: !isNetworkError(error) };
      }
    },

    async updatePassword(newPassword) {
      // Operates on the PASSWORD_RECOVERY session established by the deep-link.
      try {
        const { data, error } = await client.auth.updateUser({ password: newPassword });
        if (error) {
          if (isNetworkError(error)) return { ok: false, error: 'offline' };
          // The server rejecting on length/strength is not an existence leak.
          if (/password/i.test(error.message) && /(weak|short|least|character|6)/i.test(error.message)) {
            return { ok: false, error: 'weak-password' };
          }
          return { ok: false, error: 'unknown' };
        }
        {
          const verified = Boolean(data.user?.email_confirmed_at);
          return {
            ok: true,
            session: { email: data.user?.email ?? '', verified, name: deriveName(data.user, verified) },
          };
        }
      } catch (error) {
        return { ok: false, error: isNetworkError(error) ? 'offline' : 'unknown' };
      }
    },

    async signIn(email, password) {
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          if (isNetworkError(error)) return { ok: false, error: 'offline' };
          // Correct password but the email was never confirmed: surface a distinct code so
          // the screen can route to /verify (resend) instead of a dead-end "wrong details".
          // Only reachable after the right password — not a blind existence leak (P14).
          const code = (error as { code?: string }).code;
          if (code === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) {
            return { ok: false, error: 'email-not-confirmed' };
          }
          // Same generic code for wrong-password and unknown-email.
          return { ok: false, error: 'invalid-credentials' };
        }
        await recordEvent('sign_in', true);
        const verified = Boolean(data.user?.email_confirmed_at);
        return {
          ok: true,
          session: { email, verified, name: deriveName(data.user, verified) },
        };
      } catch (error) {
        return { ok: false, error: isNetworkError(error) ? 'offline' : 'unknown' };
      }
    },

    async resendVerification(email?: string) {
      try {
        // Prefer the address passed from the verify screen's route param: when email
        // confirmation is ON, signUp returns NO session, so getSession() is empty here
        // and the resend would silently no-op. Fall back to the session email (e.g. a
        // signed-in-but-unverified user re-requesting from settings).
        let target = email;
        if (!target) {
          const {
            data: { session },
          } = await client.auth.getSession();
          target = session?.user?.email;
        }
        if (!target) return { ok: false };
        const { error } = await client.auth.resend({ type: 'signup', email: target });
        return { ok: !error };
      } catch {
        return { ok: false };
      }
    },

    async getVerificationStatus(): Promise<VerificationStatus> {
      try {
        const {
          data: { session },
        } = await client.auth.getSession();
        return session?.user?.email_confirmed_at ? 'verified' : 'unverified';
      } catch {
        return 'unverified';
      }
    },

    async signOut() {
      await recordEvent('sign_out', true);
      try {
        await client.auth.signOut();
      } catch {
        // session is cleared locally by supabase-js even on network failure
      }
    },

    // Boot hydration. supabase-js restores the token from expo-secure-store
    // (persistSession:true); this reads it back so the context reflects a still-
    // valid session after an app relaunch instead of falsely showing signed-out.
    async getSession() {
      try {
        const { data } = await client.auth.getSession();
        return toAuthSession(data.session);
      } catch {
        return null;
      }
    },

    // Runtime state updater (web parity: AuthContext onAuthStateChange). Fires on
    // sign-in, sign-out, token refresh, and refresh-failure → logout.
    onAuthChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(toAuthSession(session));
      });
      return () => data.subscription.unsubscribe();
    },
  } satisfies AuthService;
}

// Convenience re-export of the result type for call sites that want it.
export type { AuthResult };
