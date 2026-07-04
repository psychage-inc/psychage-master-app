import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AUTH_COPY } from '@/features/auth/copy';
import type { SocialProvider } from '@/features/auth';
import {
  type ConfirmError,
  type EmailError,
  type NameError,
  type PasswordError,
  passwordStrength,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
} from '@/features/auth/validate';
import { DURATION, easingFn, useReducedMotion } from '@/lib/motion';

// S34 — Sign up (full). Amendment 2026-06-16 / Q3: full name + confirm-password +
// display-only strength meter + required Terms/Privacy acceptance, plus social sign-in.
// AUTH IS CALM: inline error lines under fields, never a shake. `onSubmit` fires only
// when every field validates locally AND the terms are accepted.

// Terms/Privacy now open the in-app screens (app/settings/terms, privacy-policy)
// instead of external URLs. Their copy is approved by Dr. Dobson (2026-06-17).

const NAME_LINE: Record<NameError, string> = { empty: AUTH_COPY.nameEmptyLine };
const EMAIL_LINE: Record<EmailError, string> = {
  empty: AUTH_COPY.emailEmptyLine,
  invalid: AUTH_COPY.emailInvalidLine,
};
const PASSWORD_LINE: Record<PasswordError, string> = {
  empty: AUTH_COPY.passwordEmptyLine,
  'too-short': AUTH_COPY.passwordShortLine,
};
const CONFIRM_LINE: Record<ConfirmError, string> = {
  empty: AUTH_COPY.confirmEmptyLine,
  mismatch: AUTH_COPY.confirmMismatchLine,
};

type SignUpFormProps = {
  /** A service-layer line (offline / credentials). Shown above the primary. */
  formError?: string;
  submitting?: boolean;
  onSubmit: (email: string, password: string, fullName: string) => void;
  onProvider: (provider: SocialProvider) => void;
  /**
   * Whether the form owns its keyboard avoidance (default true — the standalone
   * full-screen /sign-up route). The welcome bottom-sheet sets this false and
   * provides a single sheet-level KeyboardAvoidingView instead, so the whole
   * sheet (form + mode-toggle link) lifts as one unit and no two KAVs nest.
   */
  avoidKeyboard?: boolean;
};

export function SignUpForm({
  formError,
  submitting = false,
  onSubmit,
  onProvider,
  avoidKeyboard = true,
}: SignUpFormProps) {
  const reduced = useReducedMotion();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);

  const [nameError, setNameError] = useState<NameError | null>(null);
  const [emailError, setEmailError] = useState<EmailError | null>(null);
  const [passwordError, setPasswordError] = useState<PasswordError | null>(null);
  const [confirmError, setConfirmError] = useState<ConfirmError | null>(null);
  const [termsError, setTermsError] = useState(false);

  const strength = passwordStrength(password);

  const handleSubmit = () => {
    const n = validateFullName(fullName);
    const e = validateEmail(email);
    const p = validatePassword(password);
    const c = validatePasswordConfirmation(password, confirm);
    setNameError(n);
    setEmailError(e);
    setPasswordError(p);
    setConfirmError(c);
    setTermsError(!accepted);
    if (n === null && e === null && p === null && c === null && accepted) {
      onSubmit(email.trim(), password, fullName.trim());
    }
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
            <Text variant="h1">{AUTH_COPY.signUpTitle}</Text>

            <View className="gap-4">
              <AuthTextField
                label={AUTH_COPY.nameLabel}
                fieldAccessibilityHint={AUTH_COPY.nameHint}
                value={fullName}
                onChangeText={setFullName}
                errorText={nameError ? NAME_LINE[nameError] : undefined}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
              />
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
              />
              <View className="gap-2">
                <AuthTextField
                  label={AUTH_COPY.passwordLabel}
                  fieldAccessibilityHint={AUTH_COPY.passwordHint}
                  value={password}
                  onChangeText={setPassword}
                  errorText={passwordError ? PASSWORD_LINE[passwordError] : undefined}
                  secureTextEntry
                  secureToggle
                  showLabel={AUTH_COPY.showPasswordLabel}
                  hideLabel={AUTH_COPY.hidePasswordLabel}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                />
                <PasswordStrengthMeter strength={strength} />
              </View>
              <AuthTextField
                label={AUTH_COPY.confirmLabel}
                fieldAccessibilityHint={AUTH_COPY.confirmHint}
                value={confirm}
                onChangeText={setConfirm}
                errorText={confirmError ? CONFIRM_LINE[confirmError] : undefined}
                secureTextEntry
                secureToggle
                showLabel={AUTH_COPY.showPasswordLabel}
                hideLabel={AUTH_COPY.hidePasswordLabel}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (!submitting) handleSubmit();
                }}
              />
            </View>

            <View className="gap-1.5">
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: accepted }}
                accessibilityLabel={`${AUTH_COPY.termsPrefix}${AUTH_COPY.termsLink}${AUTH_COPY.termsAnd}${AUTH_COPY.privacyLink}`}
                hitSlop={10}
                onPress={() => {
                  setAccepted((value) => !value);
                  setTermsError(false);
                }}
                className="flex-row items-start gap-3"
              >
                <View
                  className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border ${
                    accepted
                      ? 'border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark'
                      : 'border-border dark:border-border-dark'
                  }`}
                >
                  {accepted ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
                <Text variant="caption" className="flex-1 text-text-secondary dark:text-text-secondary-dark">
                  {AUTH_COPY.termsPrefix}
                  <Text
                    variant="caption"
                    className="text-primary underline dark:text-primary-dark"
                    onPress={() => router.push('/settings/terms')}
                  >
                    {AUTH_COPY.termsLink}
                  </Text>
                  {AUTH_COPY.termsAnd}
                  <Text
                    variant="caption"
                    className="text-primary underline dark:text-primary-dark"
                    onPress={() => router.push('/settings/privacy-policy')}
                  >
                    {AUTH_COPY.privacyLink}
                  </Text>
                </Text>
              </Pressable>
              {termsError ? (
                <Text variant="caption" className="text-error dark:text-error-dark">
                  {AUTH_COPY.termsRequiredLine}
                </Text>
              ) : null}
            </View>

            <View className="gap-2">
              {formError ? (
                <Text variant="caption" className="text-error dark:text-error-dark">
                  {formError}
                </Text>
              ) : null}
              <Button variant="primary" disabled={submitting} onPress={handleSubmit}>
                {AUTH_COPY.signUpPrimary}
              </Button>
            </View>

            <SocialAuthButtons onProvider={onProvider} disabled={submitting} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
