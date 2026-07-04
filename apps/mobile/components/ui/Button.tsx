import { type PressableProps, ActivityIndicator } from 'react-native';
import type { ReactNode } from 'react';
import { useColorScheme } from 'nativewind';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useHaptics } from '@/lib/haptic-context';
import { DURATION, easingFn, useReducedMotion } from '@/lib/motion';

import { Text } from './Text';
import { AnimatedPressable } from './AnimatedPressable';

// Primary action primitive. DESIGN.mobile.md §3.3 firing-rule: every primary
// CTA fires haptic.affirm. Pressed state = opacity dim + Reanimated spring scale.
// Size `default` meets 44pt iOS HIG touch-target floor (DESIGN.mobile.md §7).
//
// Parity note (web ui/Button.tsx has 6 variants × 4 sizes): mobile carries the
// subset the contract sanctions — `danger` (destructive actions: delete account,
// etc.) and a `lg` size for prominent CTAs (onboarding, paywall) are added here.
// Web's `outline` ≈ mobile `secondary` (transparent + border), and web `glass`
// is intentionally omitted (glassmorphism is an anti-slop pattern on mobile).

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'default' | 'sm' | 'lg';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
  isLoading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary dark:bg-primary-dark shadow-sm',
  secondary: 'bg-transparent border border-border dark:border-border-dark',
  ghost: 'bg-transparent',
  danger: 'bg-error dark:bg-error-dark',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'min-h-[44px] px-5 py-3 rounded-lg',
  sm: 'min-h-[36px] px-3 py-2 rounded-lg',
  lg: 'min-h-[52px] px-6 py-4 rounded-lg',
};

const textVariantClasses: Record<ButtonVariant, string> = {
  // Light: white on teal #1A9B8C (AA-large). Dark: the fill brightens to teal
  // #20B8A6 where white drops to 2.5:1 (fails AA) — so the label flips to near-black
  // ink (#0C0A09 on #20B8A6 = 8.0:1, AA-body). Light mode is unchanged.
  primary: 'text-white dark:text-charcoal-950',
  secondary: 'text-text-primary dark:text-text-primary-dark',
  ghost: 'text-text-interactive dark:text-text-interactive-dark',
  // White on the semantic error fill clears AA-large for button labels in both registers.
  danger: 'text-white',
};

export function Button({
  variant = 'primary',
  size = 'default',
  children,
  className,
  onPress,
  disabled,
  isLoading,
  ...props
}: ButtonProps) {
  const { fireHaptic } = useHaptics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const reduced = useReducedMotion();

  // Spinner color tracks textVariantClasses (AA contract): on the primary fill the
  // label is white in light but flips to ink (#0C0A09) in dark where the fill
  // brightens to #20B8A6 and white drops below AA; danger stays white both registers;
  // secondary/ghost use the scheme-correct teal (#1A9B8C light, #20B8A6 dark).
  const spinnerColor =
    variant === 'primary'
      ? isDark
        ? '#0C0A09'
        : '#ffffff'
      : variant === 'danger'
        ? '#ffffff'
        : isDark
          ? '#2DD4BF' // Interactive dark
          : '#1A9B8C'; // Interactive light

  const handlePress: PressableProps['onPress'] = (event) => {
    if (disabled || isLoading) return;
    fireHaptic('affirm');
    onPress?.(event);
  };

  const base = 'items-center justify-center';
  const composed = [base, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={handlePress}
      className={composed}
      scaleTo={0.96}
      activeOpacity={0.85}
      springPreset="magnetic"
      style={{
        opacity: disabled || isLoading ? 0.5 : 1,
      }}
      {...props}
    >
      <Animated.View
        layout={reduced ? undefined : LinearTransition.springify().damping(16).stiffness(200)}
        className="flex-row items-center justify-center gap-2"
      >
        {isLoading ? (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(DURATION.swift).easing(easingFn('out'))} exiting={reduced ? undefined : FadeOut.duration(DURATION.swift)}>
            <ActivityIndicator color={spinnerColor} size="small" />
          </Animated.View>
        ) : typeof children === 'string' ? (
          <Animated.Text entering={reduced ? undefined : FadeIn.duration(DURATION.swift).easing(easingFn('out'))} exiting={reduced ? undefined : FadeOut.duration(DURATION.swift)} className={textVariantClasses[variant]}>
            <Text variant="label" className={textVariantClasses[variant]}>{children}</Text>
          </Animated.Text>
        ) : (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(DURATION.swift).easing(easingFn('out'))} exiting={reduced ? undefined : FadeOut.duration(DURATION.swift)}>
            {children}
          </Animated.View>
        )}
      </Animated.View>
    </AnimatedPressable>
  );
}
