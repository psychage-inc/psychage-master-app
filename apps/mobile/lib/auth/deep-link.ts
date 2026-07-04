import * as Linking from 'expo-linking';
import { useRouter, type Router } from 'expo-router';
import { useEffect } from 'react';

import { RESET_PASSWORD_PATH, VERIFY_SUCCESS_PATH } from '@/lib/auth/redirects';
import { getSupabaseAuthClient, isSupabaseConfigured } from '@/lib/supabase/client';

// Auth deep-link handling (WS-B). Supabase emails (verification + password reset) land
// the user back in the app at the redirect targets in lib/auth/redirects.ts. Because the
// auth client runs with detectSessionInUrl:false (no browser on native), we parse the
// returned URL ourselves and establish the session, then route to the right screen.
//
// Two token shapes are handled: the PKCE `?code=…` (exchangeCodeForSession) and the
// implicit `#access_token=…&refresh_token=…` fragment (setSession). Recovery links route
// to reset-password with ?status=ready (or =expired on failure); confirmation links route
// to verify-success (or the /verify resend surface on failure).

type AuthParams = {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  type?: string;
  error?: string;
};

// Collect params from BOTH the query string and the hash fragment (Supabase implicit
// flow puts tokens in the fragment, which Linking.parse drops). Manual parse avoids
// relying on a full URLSearchParams in the RN runtime.
function extractAuthParams(url: string): AuthParams {
  const out: Record<string, string> = {};
  const readSegment = (segment: string) => {
    for (const pair of segment.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = eq === -1 ? pair : pair.slice(0, eq);
      const value = eq === -1 ? '' : pair.slice(eq + 1);
      try {
        out[decodeURIComponent(key)] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    }
  };
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    const end = hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : url.length;
    readSegment(url.slice(queryIndex + 1, end));
  }
  if (hashIndex !== -1) readSegment(url.slice(hashIndex + 1));
  return out as AuthParams;
}

// Exported for tests (the useAuthDeepLinks hook is the only runtime caller).
export async function handleUrl(url: string, router: Router): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const params = extractAuthParams(url);
  const isRecovery = params.type === 'recovery' || url.includes(RESET_PASSWORD_PATH);
  const isVerify =
    params.type === 'signup' || params.type === 'email' || url.includes(VERIFY_SUCCESS_PATH);
  // Not an auth deep-link — ignore (lets normal routing run).
  if (!isRecovery && !isVerify && !params.code) return;

  const finishExpired = () => {
    if (isRecovery) {
      router.replace({ pathname: RESET_PASSWORD_PATH, params: { status: 'expired' } });
    } else if (isVerify) {
      // Expired/invalid verification link: land on the resend surface instead of
      // failing silently. No token details are carried (SR-11: never log/forward them).
      router.replace('/verify');
    }
  };

  if (params.error) {
    finishExpired();
    return;
  }

  const client = getSupabaseAuthClient();
  try {
    if (params.code) {
      const { error } = await client.auth.exchangeCodeForSession(params.code);
      if (error) throw error;
    } else if (params.access_token && params.refresh_token) {
      const { error } = await client.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (error) throw error;
    } else {
      finishExpired();
      return;
    }
    if (isRecovery) {
      router.replace({ pathname: RESET_PASSWORD_PATH, params: { status: 'ready' } });
    } else {
      router.replace(VERIFY_SUCCESS_PATH);
    }
  } catch {
    // The onAuthChange listener still reflects the real session; recovery gets its
    // dedicated expired dead-end, verification gets the /verify resend surface —
    // either way the user can request a fresh link.
    finishExpired();
  }
}

/** Mount once at the app root: handles the cold-start URL + warm in-app URL events. */
export function useAuthDeepLinks(): void {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void Linking.getInitialURL().then((url) => {
      if (url && active) void handleUrl(url, router);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url, router);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);
}
