import { ConfirmSheet } from '@/components/auth/ConfirmSheet';
import { AUTH_COPY, useAuth } from '@/features/auth';
import { goBackOr } from '@/lib/nav';

// S37 — Sign-out confirm (Flow 10). Plain confirm; the primary is NOT
// destructive-styled (sign-out is reversible — you sign back in). One "Sign out",
// one "Cancel". Both exits use goBackOr so a deep-link cold start (nothing to
// pop) still lands somewhere navigable.
export default function SignOutScreen() {
  const { service, setSession } = useAuth();

  const handleConfirm = async () => {
    await service.signOut();
    setSession(null);
    goBackOr('/');
  };

  return (
    <ConfirmSheet
      title={AUTH_COPY.signOutTitle}
      body={AUTH_COPY.signOutBody}
      confirmLabel={AUTH_COPY.signOutPrimary}
      cancelLabel={AUTH_COPY.signOutCancel}
      onConfirm={handleConfirm}
      onCancel={() => goBackOr('/')}
    />
  );
}
