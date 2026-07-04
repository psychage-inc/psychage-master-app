import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import VerifyScreen from '@/app/(auth)/verify';
import { AUTH_COPY } from '@/features/auth';

import { renderWithProviders } from './_helpers';

// PR-072 — the /verify route: a missing email param must not render a blank
// "we sent it to" line (session email, then a short fallback string), and a failed
// resend must not be silent (the panel has no error affordance → Alert).

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useAuth: jest.fn(),
}));

const routerMock = jest.requireMock('expo-router') as { useLocalSearchParams: jest.Mock };
const authMock = jest.requireMock('@/features/auth') as { useAuth: jest.Mock };

function mockAuth({
  session = null,
  resendOk = true,
}: { session?: { email: string } | null; resendOk?: boolean } = {}) {
  const resendVerification = jest.fn(async () => ({ ok: resendOk }));
  authMock.useAuth.mockReturnValue({ session, service: { resendVerification } });
  return { resendVerification };
}

describe('S35 Verify route (PR-072)', () => {
  beforeEach(() => {
    routerMock.useLocalSearchParams.mockReturnValue({});
  });

  it('prefers the route param email', () => {
    routerMock.useLocalSearchParams.mockReturnValue({ email: 'param@example.com' });
    mockAuth({ session: { email: 'session@example.com' } });
    renderWithProviders(<VerifyScreen />, { haptics: true });

    expect(screen.getByText('param@example.com')).toBeTruthy();
  });

  it('falls back to the session email when the param is missing', () => {
    mockAuth({ session: { email: 'session@example.com' } });
    renderWithProviders(<VerifyScreen />, { haptics: true });

    expect(screen.getByText('session@example.com')).toBeTruthy();
  });

  it('renders the short fallback line instead of a blank when no email is known', () => {
    mockAuth();
    renderWithProviders(<VerifyScreen />, { haptics: true });

    expect(screen.getByText('your email address')).toBeTruthy();
  });

  it('surfaces a failed resend via Alert instead of failing silently', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      const { resendVerification } = mockAuth({ resendOk: false });
      renderWithProviders(<VerifyScreen />, { haptics: true });

      fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.resendLabel }));

      expect(resendVerification).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith(AUTH_COPY.authErrorTitle, AUTH_COPY.authErrorBody),
      );
    } finally {
      alertSpy.mockRestore();
    }
  });

  it('does not alert when the resend succeeds', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      const { resendVerification } = mockAuth({ resendOk: true });
      renderWithProviders(<VerifyScreen />, { haptics: true });

      fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.resendLabel }));

      await waitFor(() => expect(resendVerification).toHaveBeenCalledTimes(1));
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      alertSpy.mockRestore();
    }
  });
});
