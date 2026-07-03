import { useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { VerifyPanel } from '@/components/auth/VerifyPanel';
import { AUTH_COPY, useAuth } from '@/features/auth';

// S35 — Check your email + verification. Thin route: resend goes through the stubbed
// AuthService; the email is carried in from S34 via route params, with the session
// email as fallback (a deep link into /verify carries no param).
export default function VerifyScreen() {
  const { service, session } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const email =
    typeof params.email === 'string' && params.email.length > 0
      ? params.email
      : (session?.email ?? '');

  return (
    <VerifyPanel
      // With neither a param nor a session, a short fallback line beats a blank one.
      email={email || 'your email address'}
      onResend={() => {
        // Passing undefined lets the service fall back to its session email. A
        // failed resend must not fail silently — the panel has no error affordance,
        // so surface it with the shared generic auth-error copy.
        void service.resendVerification(email || undefined).then(({ ok }) => {
          if (!ok) Alert.alert(AUTH_COPY.authErrorTitle, AUTH_COPY.authErrorBody);
        });
      }}
    />
  );
}
