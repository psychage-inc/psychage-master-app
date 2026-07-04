import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { Text } from './Text';

// Label primitive — mobile port of web components/ui/Badge.tsx (parity remediation).
// Web parity: rounded-full pill, px-2.5 py-0.5, text-xs, medium weight. Adaptations:
//   • Web uses raw Tailwind palette (gray-100/green-100/…); mobile remaps every variant
//     onto Psychage tokens (charcoal/teal/semantic) so Pass-1 token compliance holds.
//   • Soft tints exist only for neutral/teal; mobile has no soft semantic tint, so
//     status badges (success/warning/error) render solid. Dark pairs are hand-set
//     because teal/charcoal are non-themed (single-hex) token scales.
//   • self-start so the pill hugs its content inside a column flex (RN default).
// Radius `full` per DESIGN.mobile.md §1.4 (pills = full).

export type BadgeVariant =
  | 'neutral'
  | 'teal'
  | 'success'
  | 'warning'
  | 'error'
  | 'outline';

type BadgeProps = ViewProps & {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
};

const containerClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-accent dark:bg-surface-accent-dark',
  teal: 'bg-teal-100 dark:bg-teal-900',
  success: 'bg-success dark:bg-success-dark',
  warning: 'bg-warning dark:bg-warning-dark',
  error: 'bg-error dark:bg-error-dark',
  outline: 'bg-transparent border border-border dark:border-border-dark',
};

const textClasses: Record<BadgeVariant, string> = {
  neutral: 'text-text-secondary dark:text-text-secondary-dark',
  teal: 'text-teal-700 dark:text-teal-100',
  success: 'text-white',
  warning: 'text-charcoal-950',
  error: 'text-white',
  outline: 'text-text-secondary dark:text-text-secondary-dark',
};

export function Badge({ variant = 'neutral', children, className, ...props }: BadgeProps) {
  const composed = ['self-start rounded-full px-2.5 py-0.5', containerClasses[variant], className]
    .filter(Boolean)
    .join(' ');
  return (
    <View className={composed} {...props}>
      {typeof children === 'string' ? (
        <Text variant="caption" numberOfLines={1} className={`font-sans-medium ${textClasses[variant]}`}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
