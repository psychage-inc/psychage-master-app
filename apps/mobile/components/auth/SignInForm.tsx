import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AUTH_COPY } from '@/features/auth/copy';
import type { SocialProvider } from '@/features/auth';
import { type EmailError, type PasswordError, validateEmail } from '@/features/auth/validate';
import { DURATION, easingFn, useReducedMotion } from '@/lib/motion';

// Sign in — email + password. Returning users and web users logging into mobile with
// the same Supabase account (rules/auth.md §231). Mirrors the calm-form pattern: inline
// error lines, never a shake. Adds a show-password toggle + a "Forgot password?" link.
// No "remember me" — sessions persist by default (rules/auth.md §9).

const EMAIL_LINE: Record<EmailError, string> = {
  empty: AUTH_COPY.emailEmptyLine,
  invalid: AUTH_COPY.emailInvalidLine,
};
const PASSWORD_LINE: Record<PasswordError, string> = {
  empty: AUTH_COPY.passwordEmptyLine,
  'too-short': AUTH_COPY.passwordShortLine,
};

type SignInFormProps = {
  formError?: string;
  submitting?: boolean;
  onSubmit: (email: string, password: string) => void;
  onProvider: (provider: SocialProvider) => void;
  onForgotPassword: () => void;
  /**
   * When provided, render a "Don't have an account? Sign up" link (P15). Only the
   * standalone /sign-in screen passes this; the welcome bottom-sheet keeps its own
   * mode toggle, so it omits this and shows no second link.
   */
  onSignUp?: () => void;
  /**
   * Whether the form owns its keyboard avoidance (default true — the standalone
   * full-screen /sign-in route). The welcome bottom-sheet sets this false and
   * provides a single sheet-level KeyboardAvoidingView instead, so the whole
   * sheet (form + mode-toggle link) lifts as one unit and no two KAVs nest.
   */
  avoidKeyboard?: boolean;
};

export function SignInForm({
  formError,
  submitting = false,
  onSubmit,
  onProvider,
  onForgotPassword,
  onSignUp,
  avoidKeyboard = true,
}: SignInFormProps) {
  const reduced = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<EmailError | null>(null);
  const [passwordError, setPasswordError] = useState<PasswordError | null>(null);

  const handleSubmit = () => {
    const e = validateEmail(email);
    // Sign-IN only requires a non-empty password — min-8 is a sign-UP policy, and a
    // legacy/admin-created shorter password must still be submittable. The server is
    // the authority on whether the credentials match.
    const p: PasswordError | null = password.length === 0 ? 'empty' : null;
    setEmailError(e);
    setPasswordError(p);
    if (e === null && p === null) onSubmit(email.trim(), password);
  };

  return (
    <View className="flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled={avoidKeyboard}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center py-8 px-5"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(DURATION.base).easing(easingFn('out'))}
            className="gap-6"
          >
            <Text variant="h1">{AUTH_COPY.signInPrimary}</Text>

            <View className="gap-4">
              <AuthTextField
                label={AUTH_COPY.emailLabel}
                fieldAccessibilityHint={AUTH_COPY.emailHint}
                value={email}
                onChangeText={setEmail}
                errorText={emailError ? EMAIL_LINE[emailError] : undefined}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />
              <AuthTextField
                label={AUTH_COPY.passwordLabel}
                value={password}
                onChangeText={setPassword}
                errorText={passwordError ? PASSWORD_LINE[passwordError] : undefined}
                secureTextEntry
                secureToggle
                showLabel={AUTH_COPY.showPasswordLabel}
                hideLabel={AUTH_COPY.hidePasswordLabel}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (!submitting) handleSubmit();
                }}
              />
              <Pressable
                accessibilityRole="button"
                hitSlop={6}
                onPress={onForgotPassword}
                className="self-end px-1 py-1"
              >
                <Text variant="caption" className="text-primary dark:text-primary-dark">
                  {AUTH_COPY.forgotLink}
                </Text>
              </Pressable>
            </View>

            <View className="gap-2">
              {formError ? (
                <Text variant="caption" className="text-error dark:text-error-dark">
                  {formError}
                </Text>
              ) : null}
              <Button variant="primary" disabled={submitting} onPress={handleSubmit}>
                {AUTH_COPY.signInPrimary}
              </Button>
            </View>

            <SocialAuthButtons onProvider={onProvider} disabled={submitting} />

            {onSignUp ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={6}
                onPress={onSignUp}
                className="self-center px-1 py-1"
              >
                <Text variant="caption" className="text-primary dark:text-primary-dark">
                  {AUTH_COPY.signUpLink}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
