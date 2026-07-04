import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { MINDMATE_COPY } from '../copy';
import { colors } from '@/lib/colors';
import { useThemeColors } from '@/lib/use-theme-colors';

// Message composer. Multiline grows to a cap; the send affordance is a 44pt round
// target (iOS HIG floor) disabled until there's trimmed text. Disabled while a
// reply streams so turns can't interleave.
export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const canSend = value.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
  };

  const containerStyle = useAnimatedStyle(() => {
    return {
      borderColor: withTiming(
        isFocused ? tc.primary : 'transparent',
        { duration: 200 }
      ),
    };
  });

  return (
    <View
      className="flex-row items-end gap-3 border-t border-border-hairline px-4 pt-3 dark:border-border-dark/30"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <Animated.View
        className="max-h-32 min-h-[44px] flex-1 rounded-2xl bg-surface border border-border/40 dark:bg-surface-dark dark:border-border-dark/40"
        style={containerStyle}
      >
        <TextInput
          className="flex-1 px-4 py-2.5 font-sans text-base text-text-primary dark:text-text-primary-dark"
          placeholder={MINDMATE_COPY.inputPlaceholder}
          placeholderTextColor={colors.text.tertiary.light}
          value={value}
          onChangeText={setValue}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline
          // Enter sends. `submitBehavior="submit"` keeps focus and fires
          // onSubmitEditing on Return for a multiline field (instead of the default
          // newline), so the keyboard's Return/"send" key submits on both soft and
          // hardware keyboards. Long text still wraps and the field auto-grows.
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={submit}
          editable={!disabled}
          accessibilityLabel={MINDMATE_COPY.inputPlaceholder}
          testID="mindmate-input"
        />
      </Animated.View>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={MINDMATE_COPY.sendLabel}
        accessibilityState={{ disabled: !canSend }}
        onPress={submit}
        disabled={!canSend}
        className="h-[44px] w-[44px] items-center justify-center rounded-full bg-primary dark:bg-primary-dark"
        style={{ opacity: !canSend ? 0.5 : 1 }}
        activeOpacity={0.7}
        haptic="affirm"
        scaleTo={0.92}
        springPreset="magnetic"
        testID="mindmate-send"
      >
        {disabled ? (
          <ActivityIndicator size="small" color={colors.charcoal[50]} />
        ) : (
          <Send size={20} color={colors.charcoal[50]} strokeWidth={2} />
        )}
      </AnimatedPressable>
    </View>
  );
}
