import {
  type MomentDraft,
  type MomentSource,
  type MomentValence,
  MAX_LABELS,
  NOTE_MAX_LENGTH,
} from '@psychage/shared/engagement';
import { X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ChipGroup } from '@/components/moments/ChipGroup';
import { FeelingInput } from '@/components/moments/FeelingInput';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { shouldRouteToSupport } from '@/features/moments/acute';
import { ALL_LABELS, CONTEXT_DOMAINS, VALENCE_LABELS } from '@/features/moments/constants';
import { MOMENTS_COPY } from '@/features/moments/copy';
import { colorForScheme, resolveColorRef } from '@/lib/a1-tokens';
import { DURATION, useReducedMotion } from '@/lib/motion';

// The Moments capture sheet — a bottom-sheet OVERLAY under the global header (the
// Help-now pill stays reachable above the veil), mirroring the retired CheckInSheet's
// chrome so it is visually indistinguishable. MOMENTARY copy throughout.
//
// Flow: feeling (the FeelingInput seam) → "one word, if you want" (valence-narrowed
//   chips + show more) → "what's having the biggest impact?" context domains → optional
//   one line → save. Minimal capture is 2 taps: pick a feeling, press save (the rest is
//   optional). FeelingInput is a stable seam — the next prompt swaps the animated
//   visualization in behind it without touching this sheet.
//
// Store-agnostic: the container owns the write + any crisis navigation. This sheet
// runs the acute predicate (shouldRouteToSupport) BEFORE handing the draft up, and
// stamps `routedToSupport` on it so the persisted moment carries the flag.

type MomentCaptureSheetProps = {
  onSave: (draft: MomentDraft) => void;
  onClose: () => void;
  /**
   * Which surface opened this single capture sheet (provenance, stamped on the draft).
   * Lets Today / Compass / the first-open prompt all reuse ONE sheet while recording
   * where the moment came from. Defaults to `today`.
   */
  source?: MomentSource;
};

export function MomentCaptureSheet({ onSave, onClose, source = 'today' }: MomentCaptureSheetProps) {
  const reduced = useReducedMotion();
  const { colorScheme } = useColorScheme();
  const [valence, setValence] = useState<MomentValence | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [context, setContext] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // One-shot guard: a rapid double-tap on save must not hand the draft up twice
  // (duplicate moments / duplicate crisis navigation). Reset only on failure so
  // the person can retry; on success the container closes the sheet.
  const [saving, setSaving] = useState(false);

  const placeholderColor = colorForScheme(resolveColorRef('color.text.tertiary'), colorScheme);
  const iconColor = colorForScheme(resolveColorRef('color.text.secondary'), colorScheme);

  // Labels narrow to the chosen valence's band; "show more" reveals the full list.
  const labelItems = useMemo(() => {
    if (valence === null) return [];
    return showAllLabels ? ALL_LABELS : VALENCE_LABELS[valence];
  }, [valence, showAllLabels]);

  const toggle = (list: string[], setList: (v: string[]) => void, key: string, max?: number) => {
    setSaveFailed(false);
    if (list.includes(key)) {
      setList(list.filter((k) => k !== key));
    } else if (max === undefined || list.length < max) {
      setList([...list, key]);
    }
  };

  const handleSave = () => {
    if (valence === null || saving) return;
    setSaving(true);
    const trimmed = note.trim();
    const draft: MomentDraft = {
      valence,
      labels,
      context,
      ...(trimmed.length > 0 ? { note: trimmed } : {}),
      // Predicate runs BEFORE persist; the flag is carried on the saved moment.
      routedToSupport: shouldRouteToSupport({ valence, labels }),
      source,
    };
    try {
      onSave(draft);
    } catch {
      setSaveFailed(true);
      setSaving(false);
    }
  };

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(DURATION.swift)}
      exiting={reduced ? undefined : FadeOut.duration(DURATION.swift)}
      className="absolute inset-0 z-40 justify-end bg-charcoal-900/40 dark:bg-black/60"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={MOMENTS_COPY.close}
        className="flex-1"
        onPress={onClose}
      />
      {/* Keeps the optional-note input visible above the keyboard (ToolScreen's
          keyboardAvoiding pattern; Android relies on adjustResize). */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Animated.View
        entering={reduced ? undefined : SlideInDown.springify().damping(20).stiffness(200).mass(0.8)}
        exiting={reduced ? undefined : SlideOutDown.springify().damping(20).stiffness(200).mass(0.8)}
        className="max-h-[88%] rounded-t-xl bg-surface px-5 pb-6 pt-5 dark:bg-surface-dark"
      >
        <View className="mb-1 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text variant="h2">{MOMENTS_COPY.title}</Text>
            <Text variant="body" className="mt-1 text-text-secondary dark:text-text-secondary-dark">
              {MOMENTS_COPY.subline}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={MOMENTS_COPY.close} hitSlop={8} onPress={onClose}>
            <X size={22} color={iconColor} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="mt-3">
          <FeelingInput
            value={valence}
            onChange={(v) => {
              setValence(v);
              setSaveFailed(false);
            }}
          />

          {valence !== null && (
            <View className="mt-6 gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="bodyLarge">{MOMENTS_COPY.labelPrompt}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showAllLabels ? MOMENTS_COPY.labelShowFewer : MOMENTS_COPY.labelShowMore}
                  hitSlop={8}
                  onPress={() => setShowAllLabels((s) => !s)}
                >
                  <Text variant="caption" className="text-primary dark:text-primary-dark">
                    {showAllLabels ? MOMENTS_COPY.labelShowFewer : MOMENTS_COPY.labelShowMore}
                  </Text>
                </Pressable>
              </View>
              <ChipGroup
                items={labelItems}
                selected={labels}
                max={MAX_LABELS}
                onToggle={(key) => toggle(labels, setLabels, key, MAX_LABELS)}
              />
            </View>
          )}

          {valence !== null && (
            <View className="mt-6 gap-2">
              <Text variant="bodyLarge">{MOMENTS_COPY.contextPrompt}</Text>
              <ChipGroup
                items={CONTEXT_DOMAINS}
                selected={context}
                onToggle={(key) => toggle(context, setContext, key)}
              />
            </View>
          )}

          {valence !== null && (
            <TextInput
              accessibilityLabel={MOMENTS_COPY.notePlaceholder}
              placeholder={MOMENTS_COPY.notePlaceholder}
              placeholderTextColor={placeholderColor}
              value={note}
              onChangeText={(text) => {
                setNote(text);
                setSaveFailed(false);
              }}
              maxLength={NOTE_MAX_LENGTH}
              className="mt-6 min-h-[44px] rounded-lg border border-border px-3 py-2 font-sans text-base text-text-primary dark:border-border-dark dark:text-text-primary-dark"
            />
          )}

          {saveFailed && (
            <Text
              variant="caption"
              className="mt-2 text-text-primary dark:text-text-primary-dark"
              accessibilityLiveRegion="polite"
            >
              {MOMENTS_COPY.saveFailed}
            </Text>
          )}
        </ScrollView>

        <Button variant="primary" className="mt-4" disabled={valence === null || saving} onPress={handleSave}>
          {MOMENTS_COPY.save}
        </Button>
        <Text variant="caption" className="mt-2 text-center text-text-tertiary dark:text-text-tertiary-dark">
          {MOMENTS_COPY.privacyNote}
        </Text>
      </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
