import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthBottomSheet } from '@/components/auth/AuthBottomSheet';
import {
  AUTH_COPY,
  AuthProvider,
  createStubAuthService,
  useAuth,
  type AuthService,
} from '@/features/auth';

import { renderWithProviders } from './_helpers';

// Welcome-sheet front door — the confirm-email round-trip (PR-074/PR-075).
// With confirm-email ON in production, sign-up returns NO session and sign-in
// against an unconfirmed account returns 'email-not-confirmed'. The sheet must hand
// both to onNeedsVerification (the owner routes to /verify, the resend surface)
// instead of fabricating a signed-in state or dead-ending on the generic line.
// Every OTHER sign-in failure stays on the generic copy (anti-enumeration).

function makeService(overrides: Partial<AuthService>): AuthService {
  return { ...createStubAuthService(), ...overrides };
}

// Reads the same context the rest of the app does — pins that no phantom
// session (PR-076) leaks out of the sheet.
function SessionProbe() {
  const { session } = useAuth();
  return <Text>{session ? session.email : 'NO-SESSION'}</Text>;
}

function renderSheet(service: AuthService, mode: 'login' | 'signup') {
  const onSuccess = jest.fn();
  const onNeedsVerification = jest.fn();
  renderWithProviders(
    <AuthProvider service={service}>
      <SessionProbe />
      <AuthBottomSheet
        initialMode={mode}
        onClose={jest.fn()}
        onSuccess={onSuccess}
        onNeedsVerification={onNeedsVerification}
        onForgotPassword={jest.fn()}
        onProvider={jest.fn()}
        socialBusy={false}
      />
    </AuthProvider>,
    { haptics: true },
  );
  return { onSuccess, onNeedsVerification };
}

function submitSignUp() {
  fireEvent.changeText(screen.getByLabelText(AUTH_COPY.nameLabel), 'John Doe');
  fireEvent.changeText(screen.getByLabelText(AUTH_COPY.emailLabel), 'person@example.com');
  fireEvent.changeText(screen.getByLabelText(AUTH_COPY.passwordLabel), 'a-good-password');
  fireEvent.changeText(screen.getByLabelText(AUTH_COPY.confirmLabel), 'a-good-password');
  fireEvent.press(screen.getByRole('checkbox'));
  fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signUpPrimary }));
}

function submitSignIn() {
  fireEvent.changeText(screen.getByLabelText(AUTH_COPY.emailLabel), 'person@example.com');
  fireEvent.changeText(screen.getByLabelText(AUTH_COPY.passwordLabel), 'a-good-password');
  fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signInPrimary }));
}

describe('AuthBottomSheet — sign-up with confirm-email ON (PR-074)', () => {
  it('hands the email to onNeedsVerification and never opens a phantom session', async () => {
    const service = makeService({
      signUp: async () => ({ ok: true, session: null, needsVerification: true }),
    });
    const { onSuccess, onNeedsVerification } = renderSheet(service, 'signup');

    submitSignUp();

    await waitFor(() =>
      expect(onNeedsVerification).toHaveBeenCalledWith('person@example.com'),
    );
    // No replace-to-'/' success path, and no fabricated signed-in state (PR-076).
    expect(onSuccess).not.toHaveBeenCalled();
    expect(await screen.findByText('NO-SESSION')).toBeTruthy();
  });

  it('still succeeds normally when a real session comes back', async () => {
    const service = makeService({
      signUp: async () => ({
        ok: true,
        session: { email: 'person@example.com', verified: true, name: 'John Doe' },
      }),
    });
    const { onSuccess, onNeedsVerification } = renderSheet(service, 'signup');

    submitSignUp();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onNeedsVerification).not.toHaveBeenCalled();
    expect(await screen.findByText('person@example.com')).toBeTruthy();
  });
});

describe('AuthBottomSheet — sign-in against an unconfirmed account (PR-075)', () => {
  it("routes 'email-not-confirmed' to onNeedsVerification instead of the generic line", async () => {
    const service = makeService({
      signIn: async () => ({ ok: false, error: 'email-not-confirmed' }),
    });
    const { onSuccess, onNeedsVerification } = renderSheet(service, 'login');

    submitSignIn();

    await waitFor(() =>
      expect(onNeedsVerification).toHaveBeenCalledWith('person@example.com'),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.queryByText(AUTH_COPY.credentialsLine)).toBeNull();
  });

  it('keeps every other failure on the generic line (anti-enumeration)', async () => {
    const service = makeService({
      signIn: async () => ({ ok: false, error: 'invalid-credentials' }),
    });
    const { onSuccess, onNeedsVerification } = renderSheet(service, 'login');

    submitSignIn();

    expect(await screen.findByText(AUTH_COPY.credentialsLine)).toBeTruthy();
    expect(onNeedsVerification).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
