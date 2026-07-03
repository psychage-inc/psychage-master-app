// THE AUTH BACKEND SEAM.
//
// This wave builds the SCREENS + the flow. The real auth backend is OUT OF SCOPE
// here: there is no @supabase/supabase-js client or packages/api yet, and session
// tokens (rules/auth.md §6 — expo-secure-store, Keychain/Keystore, NEVER MMKV/
// AsyncStorage) land with it. The in-memory stub below drives the screens in
// isolation. When the real backend arrives, only this file changes — the screens
// consume the AuthService interface.
//
// SECURITY (Procedure-B checklist, item 3): error codes are GENERIC. Sign-in failure
// is 'invalid-credentials' — it never reveals whether an email is registered.

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'offline'
  // Surfaced only where it's not an existence leak (e.g. updatePassword): the server
  // rejected a too-weak/too-short password. Sign-in/sign-up never use this code.
  | 'weak-password'
  // Sign-in with a CORRECT password against an unconfirmed account (confirm-email ON).
  // The screen routes to /verify so the confirm round-trip is recoverable (P14). This is
  // a deliberate, scoped exception to the generic-error rule: it only appears AFTER the
  // right password, so it is not a blind existence-enumeration vector.
  | 'email-not-confirmed'
  // The OS-level social flow was dismissed by the user (Apple/Google sheet cancelled).
  | 'cancelled'
  | 'unknown';

export type VerificationStatus = 'unverified' | 'verified';

/** Third-party identity providers enabled in V1 (rules/auth.md §3). */
export type SocialProvider = 'apple' | 'google';

export interface AuthSession {
  readonly email: string;
  /** rules/auth.md §3: Tier-2 features unlock only after email verification. */
  readonly verified: boolean;
  /**
   * Display name from the VERIFIED method (Google profile name / the full_name entered
   * at email signup), or null when the method carries no name (P63). Always null while
   * unverified — there is no verified method to source it from.
   */
  readonly name: string | null;
}

export interface AuthResult {
  readonly ok: boolean;
  readonly error?: AuthErrorCode;
  readonly session?: AuthSession;
}

/**
 * signUp outcome (PR-076). With confirm-email ON, Supabase creates the account but
 * returns NO session until the emailed link is tapped. This union makes that state
 * unrepresentable as "signed in": `session` is null and `needsVerification` is true,
 * so callers cannot setSession() a phantom — they route to /verify (the resend
 * surface) instead. A discriminated union (not optional fields) so tsc flags every
 * caller that does not handle the no-session branch.
 */
export type SignUpResult =
  | { readonly ok: true; readonly session: AuthSession }
  | { readonly ok: true; readonly session: null; readonly needsVerification: true }
  | { readonly ok: false; readonly error: AuthErrorCode };

export interface AuthService {
  /**
   * `fullName` (Amendment 2026-06-16) is stored as user metadata (display alias only —
   * §9 "username display is just an alias"). Optional so existing call sites compile.
   * Returns SignUpResult: with confirm-email ON the account exists but there is NO
   * session — callers must route to /verify, never fabricate a signed-in state.
   */
  signUp(email: string, password: string, fullName?: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  /**
   * Continue with a third-party provider (Apple / Google). Drives the OS sheet, then
   * exchanges the returned id-token with Supabase. `cancelled` is returned (not an
   * error toast) when the user dismisses the sheet.
   */
  signInWithProvider(provider: SocialProvider): Promise<AuthResult>;
  /**
   * Send a password-reset email (rules/auth.md §3/§9). ANTI-ENUMERATION: resolves
   * `{ ok: true }` whether or not the address has an account — never reveals existence.
   * `{ ok: false }` is reserved for offline / transport failure so the UI can say
   * "you're offline" honestly without leaking account state.
   */
  requestPasswordReset(email: string): Promise<{ ok: boolean }>;
  /**
   * Set a new password for the session established by the recovery deep-link
   * (PASSWORD_RECOVERY). Returns `weak-password` if the server rejects the length.
   */
  updatePassword(newPassword: string): Promise<AuthResult>;
  /**
   * Resend the signup confirmation email. `email` is the address from the verify
   * screen's route param. When email confirmation is ON, signUp returns NO session
   * (the user must confirm first), so the impl CANNOT rely on getSession() for the
   * address — it must use this param. Falls back to the session email when omitted.
   */
  resendVerification(email?: string): Promise<{ ok: boolean }>;
  getVerificationStatus(): Promise<VerificationStatus>;
  signOut(): Promise<void>;
  /**
   * The current persisted session, or null when signed out. The boot-hydration
   * source: supabase-js restores the token from secure-store, but the React
   * context must read it back to reflect "still signed in" after a relaunch.
   */
  getSession(): Promise<AuthSession | null>;
  /**
   * Subscribe to auth-state changes (sign-in, sign-out, token refresh, expiry).
   * Listener fires with the new session or null; returns an unsubscribe fn.
   * Mirrors web AuthContext's onAuthStateChange (the runtime state updater).
   */
  onAuthChange(listener: (session: AuthSession | null) => void): () => void;
}

export interface StubAuthOptions {
  /** Simulate no network — every call returns the honest offline outcome. */
  readonly offline?: boolean;
}

// In-memory stub. No network, no token storage, no real credential check.
// signUp opens an UNVERIFIED session (verification gates Tier-2 per rules/auth.md §3).
export function createStubAuthService(options: StubAuthOptions = {}): AuthService {
  const offline = options.offline ?? false;
  let session: AuthSession | null = null;
  const listeners = new Set<(session: AuthSession | null) => void>();
  const emit = () => {
    for (const listener of listeners) listener(session);
  };

  return {
    async signUp(email: string) {
      if (offline) return { ok: false, error: 'offline' };
      session = { email, verified: false, name: null };
      emit();
      return { ok: true, session };
    },
    async signIn(email: string) {
      if (offline) return { ok: false, error: 'offline' };
      // Stub has no credential store, so it admits the sign-in. The REAL impl verifies
      // against Supabase and returns { ok: false, error: 'invalid-credentials' } on
      // any failure — the same generic code for wrong-password and unknown-email.
      session = { email, verified: true, name: null };
      emit();
      return { ok: true, session };
    },
    async signInWithProvider() {
      if (offline) return { ok: false, error: 'offline' };
      // Stub admits the social sign-in with a synthetic verified session (Apple/Google
      // emails are pre-verified). The REAL impl exchanges the provider id-token.
      session = { email: 'social@stub.local', verified: true, name: null };
      emit();
      return { ok: true, session };
    },
    async requestPasswordReset() {
      // Anti-enumeration: always ok unless offline (matches the real impl contract).
      return { ok: !offline };
    },
    async updatePassword() {
      if (offline) return { ok: false, error: 'offline' };
      if (!session) return { ok: false, error: 'unknown' };
      return { ok: true, session };
    },
    async resendVerification(_email?: string) {
      return { ok: !offline };
    },
    async getVerificationStatus() {
      return session?.verified ? 'verified' : 'unverified';
    },
    async signOut() {
      session = null;
      emit();
    },
    async getSession() {
      return session;
    },
    onAuthChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
