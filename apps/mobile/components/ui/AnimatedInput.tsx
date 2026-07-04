import { useState, useEffect, forwardRef } from 'react';
import { TextInput, type TextInputProps, View, } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { colors } from '@/lib/colors';
import { useReducedMotion, SPRING_PRESETS } from '@/lib/motion';

export interface AnimatedInputProps extends TextInputProps {
  label: string;
  error?: string;
  accentColor?: string;
}

export const AnimatedInput = forwardRef<TextInput, AnimatedInputProps>(
  ({ label, error, accentColor = '#1A9B8C', value, onFocus, onBlur, className, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const reduced = useReducedMotion();
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === 'dark';
    // Theme-resolved rest-state colors (tokens: border.default, text.secondary,
    // surface) — the previous light-only literals vanished on the true-black canvas.
    const restBorder = dark ? '#3f3f46' : '#E7E5E4';
    const restLabel = dark ? colors.text.secondary.dark : colors.text.secondary.light;
    const floatBg = dark ? '#121212' : '#F9F7F3';
    
    // Animation states
    const focusAnim = useSharedValue(0);
    const shakeAnim = useSharedValue(0);
    const hasValue = value ? value.length > 0 : false;
    const isFloating = isFocused || hasValue;

    // Trigger floating label and border focus
    useEffect(() => {
      if (reduced) {
        focusAnim.value = isFocused ? 1 : 0;
        return;
      }
      focusAnim.value = withSpring(isFocused ? 1 : 0, SPRING_PRESETS.swift);
    }, [isFocused, reduced, focusAnim]);

    // Trigger shake on error change
    useEffect(() => {
      if (error && !reduced) {
        shakeAnim.value = withSequence(
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withSpring(0, SPRING_PRESETS.swift)
        );
      }
    }, [error, reduced, shakeAnim]);

    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const containerStyle = useAnimatedStyle(() => {
      const borderColor = interpolateColor(
        focusAnim.value,
        [0, 1],
        [error ? '#DC2626' : restBorder, error ? '#DC2626' : accentColor]
      );
      return {
        borderColor,
        transform: [{ translateX: shakeAnim.value }],
      };
    });

    const labelStyle = useAnimatedStyle(() => {
      const top = withSpring(isFloating ? -10 : 12, SPRING_PRESETS.swift);
      const fontSize = withSpring(isFloating ? 12 : 16, SPRING_PRESETS.swift);
      const color = interpolateColor(
        focusAnim.value,
        [0, 1],
        [restLabel, error ? '#DC2626' : accentColor]
      );
      
      return {
        top,
        fontSize,
        color,
        backgroundColor: isFloating ? floatBg : 'transparent',
        paddingHorizontal: isFloating ? 4 : 0,
      };
    });

    return (
      <View className={['mb-4', className].filter(Boolean).join(' ')}>
        <Animated.View
          style={containerStyle}
          className="border rounded-xl px-4 min-h-[52px] justify-center bg-surface dark:bg-surface-dark"
        >
          <Animated.Text
            style={[labelStyle, { position: 'absolute', left: 12, zIndex: 1 }]}
            className="font-sans"
          >
            {label}
          </Animated.Text>
          <TextInput
            ref={ref}
            value={value}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="flex-1 text-base font-sans text-text-primary dark:text-text-primary-dark mt-2"
            placeholderTextColor="transparent" // Hide default placeholder since we have floating label
            {...props}
          />
        </Animated.View>
        {error ? (
          <Animated.Text
            entering={!reduced ? undefined : undefined} // Can add FadeInDown here
            className="text-error dark:text-error-dark text-sm mt-1 ml-1"
          >
            {error}
          </Animated.Text>
        ) : null}
      </View>
    );
  }
);
