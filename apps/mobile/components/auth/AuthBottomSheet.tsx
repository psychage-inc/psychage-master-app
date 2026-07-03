import { X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { useAuth, type SocialProvider } from '@/features/auth';
import { AUTH_COPY } from '@/features/auth/copy';
import { colorForScheme, resolveColorRef } from '@/lib/a1-tokens';
import { DURATION, useReducedMotion } from '@/lib/motion';
import { Text } from '@/components/ui/Text';

type AuthBottomSheetProps = {
  initialMode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: () => void;
  /**
   * Confirm-email round-trip (PR-074/PR-075): fired with the address when sign-up
   * created an account without a session, or sign-in hit an unconfirmed account.
   * The owner routes to /verify (the resend surface) — never a dead end.
   */
  onNeedsVerification: (email: string) => void;
  onForgotPassword: () => void;
  onProvider: (provider: SocialProvider) => void;
  socialBusy: boolean;
  socialError?: string;
};

export function AuthBottomSheet({
  initialMode,
  onClose,
  onSuccess,
  onNeedsVerification,
  onForgotPassword,
  onProvider,
  socialBusy,
  socialError,
}: AuthBottomSheetProps) {
  const reduced = useReducedMotion();
  const { colorScheme } = useColorScheme();
  const { service, setSession } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const iconColor = colorForScheme(resolveColorRef('color.text.secondary'), colorScheme);

  const handleSignIn = async (email: string, password: string) => {
    setSubmitting(true);
    setFormError(undefined);
    const result = await service.signIn(email, password);
    setSubmitting(false);
    if (result.ok && result.session) {
      setSession(result.session);
      onSuccess();
      return;
    }
    // Correct password, unconfirmed account: recoverable via /verify (mirrors
    // app/(auth)/sign-in.tsx). Every OTHER failure stays on the generic line —
    // never leak whether an account exists (anti-enumeration).
    if (result.error === 'email-not-confirmed') {
      onNeedsVerification(email);
      return;
    }
    setFormError(result.error === 'offline' ? AUTH_COPY.offlineLine : AUTH_COPY.credentialsLine);
  };

  const handleSignUp = async (email: string, password: string, fullName: string) => {
    setSubmitting(true);
    setFormError(undefined);
    const result = await service.signUp(email, password, fullName);
    setSubmitting(false);
    if (result.ok) {
      if (result.session) {
        setSession(result.session);
        onSuccess();
        return;
      }
      // Confirm-email ON: account created, NO session (PR-074/PR-076). Route to
      // /verify with the email — exactly like app/(auth)/sign-up.tsx — instead of
      // dropping the user tokenless at '/' with no resend surface.
      onNeedsVerification(email);
      return;
    }
    setFormError(result.error === 'offline' ? AUTH_COPY.offlineLine : AUTH_COPY.credentialsLine);
  };

  const toggleMode = () => {
    setFormError(undefined);
    setMode(mode === 'login' ? 'signup' : 'login');
  };

  const currentError = formError || socialError;
  const isBusy = submitting || socialBusy;

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(DURATION.swift)}
      exiting={reduced ? undefined : FadeOut.duration(DURATION.swift)}
      className="absolute inset-0 z-40 bg-charcoal-900/40 dark:bg-black/60"
    >
      {/* Sheet-level keyboard avoidance: the WHOLE sheet (form + mode-toggle link)
          lifts as one unit. The forms set avoidKeyboard={false} so no two KAVs nest.
          flex-1 + justify-end keeps the content-sized sheet pinned above the keyboard
          when the KAV shrinks the column; the flex-1 backdrop absorbs the slack. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="flex-1"
          onPress={onClose}
        />
        <Animated.View
          entering={reduced ? undefined : SlideInDown.springify().damping(20).stiffness(200).mass(0.8)}
          exiting={reduced ? undefined : SlideOutDown.springify().damping(20).stiffness(200).mass(0.8)}
          className="max-h-[90%] min-h-[50%] rounded-t-xl bg-surface px-0 pb-6 pt-5 dark:bg-surface-dark"
        >
          <View className="mb-1 flex-row items-start justify-between px-5">
          <View className="flex-1" />
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose}>
            <X size={22} color={iconColor} />
          </Pressable>
        </View>

        {mode === 'login' ? (
          <SignInForm
            formError={currentError}
            submitting={isBusy}
            onSubmit={handleSignIn}
            onProvider={onProvider}
            onForgotPassword={onForgotPassword}
            avoidKeyboard={false}
          />
        ) : (
          <SignUpForm
            formError={currentError}
            submitting={isBusy}
            onSubmit={handleSignUp}
            onProvider={onProvider}
            avoidKeyboard={false}
          />
        )}

        <View className="mt-4 flex-row justify-center">
          <Pressable onPress={toggleMode} className="p-2" hitSlop={8}>
            <Text variant="caption" className="text-primary dark:text-primary-dark">
              {mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </Text>
          </Pressable>
        </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
