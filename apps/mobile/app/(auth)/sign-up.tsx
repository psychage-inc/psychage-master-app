import { useRouter } from 'expo-router';
import { useState } from 'react';

import { SignUpForm } from '@/components/auth/SignUpForm';
import { AUTH_COPY, useAuth, useSocialSignIn } from '@/features/auth';

// S34 — Sign up (full: name + email + password + confirm + terms + social). Drives the
// AuthService and navigates to S35 (verify) on email success; social goes straight in.
// Errors are GENERIC (Procedure-B checklist #3).
export default function SignUpScreen() {
  const router = useRouter();
  const { service, setSession } = useAuth();
  const { onProvider, socialError, socialBusy } = useSocialSignIn();
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (email: string, password: string, fullName: string) => {
    setSubmitting(true);
    setFormError(undefined);
    const result = await service.signUp(email, password, fullName);
    setSubmitting(false);
    if (result.ok) {
      // Only a REAL session reaches the context — with confirm-email ON, Supabase
      // returns none until the link is tapped (PR-076). /verify carries the resend.
      if (result.session) setSession(result.session);
      router.push({ pathname: '/verify', params: { email } });
      return;
    }
    setFormError(result.error === 'offline' ? AUTH_COPY.offlineLine : AUTH_COPY.credentialsLine);
  };

  return (
    <SignUpForm
      formError={formError ?? socialError}
      submitting={submitting || socialBusy}
      onSubmit={handleSubmit}
      onProvider={onProvider}
    />
  );
}
