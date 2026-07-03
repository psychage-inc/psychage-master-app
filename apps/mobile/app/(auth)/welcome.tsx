import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AuthBottomSheet } from '@/components/auth/AuthBottomSheet';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { PsychageLogoMark } from '@/components/brand/PsychageLogoMark';
import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { AUTH_COPY, useSocialSignIn } from '@/features/auth';
import { storage } from '@/lib/adapters/storage';
import { markWelcomeSeen } from '@/lib/persistence/onboarding';
import { DURATION, easingFn, useReducedMotion } from '@/lib/motion';

// S0 — Front-door Welcome gate (Amendment 2026-06-16 / Q1). Brand hero + three paths:
// "Continue with Email" (sign up/in), "Continue with Social", and — the anonymous-first invariant —
// "Explore without an account" (Continue), which enters the app with full Tier-1 access.
// Engaging ANY path marks the gate seen, so a later sign-out lands in the app, never
// re-walls the user.
export default function WelcomeScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { onProvider, socialError, socialBusy } = useSocialSignIn();

  const [authSheet, setAuthSheet] = useState<'login' | 'signup' | null>(null);

  const seen = () => markWelcomeSeen(storage);
  const onContinue = () => {
    seen();
    router.replace('/onboarding/welcome');
  };
  const onSignUp = () => {
    seen();
    setAuthSheet('signup');
  };
  const onLogIn = () => {
    seen();
    setAuthSheet('login');
  };
  const handleProvider = (provider: Parameters<typeof onProvider>[0]) => {
    seen();
    void onProvider(provider);
  };
  const handleAuthSuccess = () => {
    setAuthSheet(null);
    router.replace('/');
  };
  // Confirm-email round-trip (PR-074/PR-075): no session yet — land on /verify with
  // the address (the resend surface), same as the standalone /sign-up route.
  const handleNeedsVerification = (email: string) => {
    setAuthSheet(null);
    router.push({ pathname: '/verify', params: { email } });
  };

  return (
    <View className="flex-1">
      <ScreenShell>
        <View className="flex-1 justify-between py-8">
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(DURATION.calm).easing(easingFn('out'))}
            className="flex-1 items-center justify-center gap-4"
          >
            <PsychageLogoMark testID="welcome-logo" size={72} />
            <Text variant="h1" className="text-center text-4xl">
              {AUTH_COPY.welcomeTitle}
            </Text>
            <Text
              variant="body"
              className="max-w-xs text-center text-text-secondary dark:text-text-secondary-dark"
            >
              {AUTH_COPY.welcomeTagline}
            </Text>
          </Animated.View>

          <Animated.View
            entering={
              reduced ? undefined : FadeInDown.duration(DURATION.base).easing(easingFn('out'))
            }
            className="gap-3"
          >
            {socialError && !authSheet ? (
              <Text variant="caption" className="text-center text-error dark:text-error-dark">
                {socialError}
              </Text>
            ) : null}
            <Button variant="primary" disabled={socialBusy} onPress={onSignUp}>
              {AUTH_COPY.welcomeSignUp}
            </Button>
            <Button variant="secondary" disabled={socialBusy} onPress={onLogIn}>
              {AUTH_COPY.welcomeLogin}
            </Button>

            <SocialAuthButtons onProvider={handleProvider} disabled={socialBusy} />

            <Button variant="ghost" disabled={socialBusy} onPress={onContinue}>
              {AUTH_COPY.welcomeContinue}
            </Button>
          </Animated.View>
        </View>
      </ScreenShell>

      {authSheet !== null && (
        <AuthBottomSheet
          initialMode={authSheet}
          onClose={() => setAuthSheet(null)}
          onSuccess={handleAuthSuccess}
          onNeedsVerification={handleNeedsVerification}
          onForgotPassword={() => {
            setAuthSheet(null);
            router.push('/forgot-password');
          }}
          onProvider={handleProvider}
          socialBusy={socialBusy}
          socialError={socialError}
        />
      )}
    </View>
  );
}
