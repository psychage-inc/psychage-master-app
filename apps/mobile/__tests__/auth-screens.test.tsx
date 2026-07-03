import { act, fireEvent, screen } from '@testing-library/react-native';

import { ConfirmSheet } from '@/components/auth/ConfirmSheet';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { VerifyPanel } from '@/components/auth/VerifyPanel';
import { WhyAccount } from '@/components/auth/WhyAccount';
import { AUTH_COPY } from '@/features/auth';

import { renderWithProviders } from './_helpers';

// Screen-body behaviour. Router-agnostic bodies (the route files only wire
// navigation), so these render without expo-router. AUTH IS CALM: validation errors
// are an inline line + border, NEVER a shake — these bodies use no error animation
// (only a mount fade), so "no shake" holds by construction; the assertions check the
// calm error line + that submit is blocked.

describe('WhyAccount (S33)', () => {
  it('renders the framing and wires both choices', () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    renderWithProviders(<WhyAccount onPrimary={onPrimary} onSecondary={onSecondary} />, {
      haptics: true,
    });

    expect(screen.getByText(AUTH_COPY.whyTitle)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.whyPrimary }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.whySecondary }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});

describe('SignUpForm (S34)', () => {
  it('shows inline empty-field lines and does not submit', () => {
    const onSubmit = jest.fn();
    const onProvider = jest.fn();
    renderWithProviders(<SignUpForm onSubmit={onSubmit} onProvider={onProvider} />, { haptics: true });

    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signUpPrimary }));

    expect(screen.getByText(AUTH_COPY.emailEmptyLine)).toBeTruthy();
    expect(screen.getByText(AUTH_COPY.passwordEmptyLine)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the calm invalid/too-short lines and does not submit', () => {
    const onSubmit = jest.fn();
    const onProvider = jest.fn();
    renderWithProviders(<SignUpForm onSubmit={onSubmit} onProvider={onProvider} />, { haptics: true });

    fireEvent.changeText(screen.getByLabelText(AUTH_COPY.emailLabel), 'nope');
    fireEvent.changeText(screen.getByLabelText(AUTH_COPY.passwordLabel), 'short');
    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signUpPrimary }));

    expect(screen.getByText(AUTH_COPY.emailInvalidLine)).toBeTruthy();
    expect(screen.getByText(AUTH_COPY.passwordShortLine)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the trimmed email + password when both validate', () => {
    const onSubmit = jest.fn();
    const onProvider = jest.fn();
    renderWithProviders(<SignUpForm onSubmit={onSubmit} onProvider={onProvider} />, { haptics: true });

    fireEvent.changeText(screen.getByLabelText(AUTH_COPY.nameLabel), 'John Doe');
    fireEvent.changeText(screen.getByLabelText(AUTH_COPY.emailLabel), '  person@example.com ');
    fireEvent.changeText(screen.getByLabelText(AUTH_COPY.passwordLabel), 'a-good-password');
    fireEvent.changeText(screen.getByLabelText(AUTH_COPY.confirmLabel), 'a-good-password');
    
    // Press checkbox
    fireEvent.press(screen.getByRole('checkbox'));

    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signUpPrimary }));

    expect(onSubmit).toHaveBeenCalledWith('person@example.com', 'a-good-password', 'John Doe');
  });
});

describe('SignInForm (S32) — signup discoverability (P15)', () => {
  it('renders the sign-up link and fires onSignUp when it is provided', () => {
    const onSignUp = jest.fn();
    renderWithProviders(
      <SignInForm
        onSubmit={jest.fn()}
        onProvider={jest.fn()}
        onForgotPassword={jest.fn()}
        onSignUp={onSignUp}
      />,
      { haptics: true },
    );

    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signUpLink }));
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  it('omits the sign-up link when onSignUp is not provided (bottom-sheet keeps its own toggle)', () => {
    renderWithProviders(
      <SignInForm onSubmit={jest.fn()} onProvider={jest.fn()} onForgotPassword={jest.fn()} />,
      { haptics: true },
    );

    expect(screen.queryByText(AUTH_COPY.signUpLink)).toBeNull();
  });
});

describe('SignInForm (S32) — password gate (PR-080)', () => {
  it('submits a password shorter than the sign-up minimum (server decides validity)', () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <SignInForm onSubmit={onSubmit} onProvider={jest.fn()} onForgotPassword={jest.fn()} />,
      { haptics: true },
    );

    fireEvent.changeText(screen.getByLabelText(AUTH_COPY.emailLabel), 'person@example.com');
    fireEvent.changeText(screen.getByLabelText(AUTH_COPY.passwordLabel), 'short');
    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signInPrimary }));

    expect(screen.queryByText(AUTH_COPY.passwordShortLine)).toBeNull();
    expect(onSubmit).toHaveBeenCalledWith('person@example.com', 'short');
  });

  it('still blocks an empty password with the calm inline line', () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <SignInForm onSubmit={onSubmit} onProvider={jest.fn()} onForgotPassword={jest.fn()} />,
      { haptics: true },
    );

    fireEvent.changeText(screen.getByLabelText(AUTH_COPY.emailLabel), 'person@example.com');
    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signInPrimary }));

    expect(screen.getByText(AUTH_COPY.passwordEmptyLine)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('VerifyPanel (S35)', () => {
  it('disables resend during the cooldown and re-enables after it', () => {
    jest.useFakeTimers();
    try {
      const onResend = jest.fn();
      renderWithProviders(
        <VerifyPanel email="person@example.com" cooldownSeconds={3} onResend={onResend} />,
        { haptics: true },
      );

      fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.resendLabel }));
      expect(onResend).toHaveBeenCalledTimes(1);
      expect(screen.getByText(AUTH_COPY.resendCooldownLabel(3))).toBeTruthy();

      // Step one second at a time — each act() flush lets the effect schedule the
      // next tick (a single 3000ms advance would only fire the first timer).
      for (let i = 0; i < 3; i += 1) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }

      expect(screen.getByRole('button', { name: AUTH_COPY.resendLabel })).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConfirmSheet (S37 sign-out)', () => {
  it('confirms and cancels (primary is an ordinary, non-destructive button)', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    renderWithProviders(
      <ConfirmSheet
        title={AUTH_COPY.signOutTitle}
        body={AUTH_COPY.signOutBody}
        confirmLabel={AUTH_COPY.signOutPrimary}
        cancelLabel={AUTH_COPY.signOutCancel}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
      { haptics: true },
    );

    expect(screen.getByText(AUTH_COPY.signOutTitle)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signOutPrimary }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: AUTH_COPY.signOutCancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
