import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { CrisisPill } from '@/components/CrisisPill';
import { HeaderAvatar } from '@/components/HeaderAvatar';
import { PsychageLogo } from '@/components/PsychageLogo';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/lib/use-theme-colors';

// 0f — the single tool-chrome standard. Every pushed tool surface wraps its body
// in ToolScreen so the chrome is identical everywhere:
//   row 1 — PsychageLogo (left) + CrisisPill "Help now" + HeaderAvatar (right).
//           Byte-identical to GlobalHeader's cluster (shared leaf primitives), so
//           SR-2 (crisis ≤1 tap, always visible) is structurally guaranteed — the
//           pill is unconditional, no prop can hide it.
//   row 2 — back affordance + optional tool title. Rendered only when `onBack` or
//           `title` is present, so chrome-minimal surfaces stay clean.
// No mascot here, ever (hard rule, esp. Navigator). GlobalHeader is left untouched
// for its prop-less tab-landing callers; ToolScreen composes the same leaves itself.
//
// The body defaults to a padded ScrollView (`scroll`). Pass `scroll="none"` when the
// feature owns its own scroll / pinned CTA / chat / immersive layout (most tools do).
// `keyboardAvoiding` is for the chat composer (MindMate).

export interface ToolScreenProps {
  readonly children: ReactNode;
  /** Back affordance. Omitted → no back control (e.g. Navigator 'welcome' step). */
  readonly onBack?: () => void;
  /** Optional visible back label (e.g. Relationship's contextual label). */
  readonly backLabel?: string;
  /** Optional tool title in row 2 — never replaces the logo. */
  readonly title?: string;
  /** Body mode. 'scroll' wraps children in a padded ScrollView; 'none' lets the
   *  feature manage its own layout. Default 'scroll'. */
  readonly scroll?: 'scroll' | 'none';
  /** contentContainer className passthrough for scroll mode. */
  readonly contentClassName?: string;
  /** Wrap the body in a KeyboardAvoidingView (chat composer). Default false. */
  readonly keyboardAvoiding?: boolean;
  /** SafeAreaView edges. Default ['top','bottom']. */
  readonly edges?: readonly Edge[];
  /** testID passthrough for the outer frame. */
  readonly testID?: string;
  /** testID for the back control (preserve a Maestro/RNTL contract if needed). */
  readonly backTestID?: string;
}

export function ToolScreen({
  children,
  onBack,
  backLabel,
  title,
  scroll = 'scroll',
  contentClassName,
  keyboardAvoiding = false,
  edges = ['top', 'bottom'],
  testID,
  backTestID,
}: ToolScreenProps) {
  const tc = useThemeColors();

  const header = (
    <View>
      <View className="flex-row items-center justify-between border-b border-border/20 px-5 py-3 dark:border-border-dark/20">
        <PsychageLogo />
        <View className="flex-row items-center gap-2">
          <CrisisPill />
          <HeaderAvatar />
        </View>
      </View>
      {onBack || title ? (
        <View className="flex-row items-center gap-1 px-4 pt-2 pb-1">
          {onBack ? (
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel={backLabel ?? 'Back'}
              onPress={onBack}
              hitSlop={8}
              haptic="tab"
              scaleTo={0.96}
              testID={backTestID}
              className="min-h-[44px] flex-row items-center gap-1 pr-2"
            >
              <ArrowLeft size={24} color={tc.ink} strokeWidth={2} />
              {backLabel ? (
                <Text
                  variant="bodyLarge"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  className="text-[15px] text-text-secondary dark:text-text-secondary-dark"
                >
                  {backLabel}
                </Text>
              ) : null}
            </AnimatedPressable>
          ) : null}
          {title ? (
            <Text variant="h2" accessibilityRole="header" numberOfLines={1} ellipsizeMode="tail" className="flex-1">
              {title}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const body =
    scroll === 'scroll' ? (
      <ScrollView
        className="flex-1"
        contentContainerClassName={contentClassName ?? 'gap-4 px-4 pb-12 pt-2'}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    ) : (
      <View className="flex-1">{children}</View>
    );

  const inner = keyboardAvoiding ? (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView
      edges={edges}
      className="flex-1 bg-background dark:bg-background-dark"
      testID={testID}
    >
      {header}
      {inner}
    </SafeAreaView>
  );
}
