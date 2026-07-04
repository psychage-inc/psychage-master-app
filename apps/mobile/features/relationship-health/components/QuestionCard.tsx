import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useHaptics } from '@/lib/haptic-context';

import { LIKERT_OPTIONS, type RelationshipQuestion } from '../types';

// One assessment statement with the 5-point Likert scale rendered as tappable
// rows. Selection is the only interaction; value flows up via onSelect.

export interface QuestionCardProps {
  readonly question: RelationshipQuestion;
  readonly value: number | undefined;
  readonly onSelect: (value: number) => void;
}

export function QuestionCard({ question, value, onSelect }: QuestionCardProps) {
  const { fireHaptic } = useHaptics();

  return (
    <View className="gap-5">
      <Text variant="h1" className="text-[22px] leading-8" accessibilityRole="header">
        {question.text}
      </Text>

      <View className="gap-2.5">
        {LIKERT_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => {
                fireHaptic('tab');
                onSelect(option.value);
              }}
              className={[
                'min-h-[52px] flex-row items-center gap-3 rounded-xl border px-4 py-3',
                selected
                  ? 'border-primary bg-primary/10 dark:border-primary-dark'
                  : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
              ].join(' ')}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View
                className={[
                  'h-5 w-5 items-center justify-center rounded-full border-2',
                  selected ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark',
                ].join(' ')}
              >
                {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary dark:bg-primary-dark" /> : null}
              </View>
              <Text
                variant={selected ? 'bodyLarge' : 'body'}
                className={selected ? 'text-primary dark:text-primary-dark' : undefined}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
