import { useMemo, useState } from 'react';
import { useColorScheme } from 'nativewind';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import {
  detectCrisisContent,
  type SleepEntry,
  type SleepEntryInput,
  type SleepRating,
} from '@psychage/shared/sleep';

import { Button } from '@/components/ui/Button';
import { CrisisPill } from '@/components/CrisisPill';
import { Text } from '@/components/ui/Text';
import { CT4_SLEEP } from '@/features/sleep-architect/copy';
import { colors } from '@/lib/colors';

// Diary entry form (ports the web MorningCheckIn fields as one scroll). Captures
// every SleepEntryInput field that feeds the metrics + score, plus quality/mood,
// dream recall, the before-bed substance toggles, and free-text notes. Naps are
// modeled by the store but not collected here yet (kept []). LOCAL-ONLY: the
// parent persists through the SleepRecordStore (SR-4). SR-2: free-text is scanned
// on-device with detectCrisisContent — a match surfaces the crisis affordance,
// never blocks the save.

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type SleepLogFormProps = {
  initial?: SleepEntry;
  onSubmit: (input: SleepEntryInput) => void;
  onCancel: () => void;
};

type Draft = {
  bedtime: string;
  lights_out: string;
  sleep_onset_minutes: string;
  night_wakings: string;
  night_waking_duration_minutes: string;
  wake_time: string;
  out_of_bed_time: string;
  sleep_quality: SleepRating;
  morning_mood: SleepRating;
  dream_recall: boolean;
  dream_notes: string;
  alcohol: boolean;
  exercise: boolean;
  medication_sleep_aid: boolean;
  caffeine_last_time: string;
  notes: string;
};

function draftFrom(initial?: SleepEntry): Draft {
  return {
    bedtime: initial?.bedtime ?? '23:00',
    lights_out: initial?.lights_out ?? '23:15',
    sleep_onset_minutes: String(initial?.sleep_onset_minutes ?? 15),
    night_wakings: String(initial?.night_wakings ?? 0),
    night_waking_duration_minutes: String(initial?.night_waking_duration_minutes ?? 0),
    wake_time: initial?.wake_time ?? '07:00',
    out_of_bed_time: initial?.out_of_bed_time ?? '07:15',
    sleep_quality: initial?.sleep_quality ?? 3,
    morning_mood: initial?.morning_mood ?? 3,
    dream_recall: initial?.dream_recall ?? false,
    dream_notes: initial?.dream_notes ?? '',
    alcohol: initial?.substances.alcohol ?? false,
    exercise: initial?.substances.exercise ?? false,
    medication_sleep_aid: initial?.substances.medication_sleep_aid ?? false,
    caffeine_last_time: initial?.substances.caffeine_last_time ?? '',
    notes: initial?.notes ?? '',
  };
}

function toNonNegInt(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function SleepLogForm({ initial, onSubmit, onCancel }: SleepLogFormProps) {
  const t = CT4_SLEEP.form;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial));
  const [showInvalid, setShowInvalid] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const timeFields: (keyof Draft)[] = ['bedtime', 'lights_out', 'wake_time', 'out_of_bed_time'];
  const caffeineValid = draft.caffeine_last_time === '' || HHMM_RE.test(draft.caffeine_last_time);
  const formatsValid = timeFields.every((f) => HHMM_RE.test(draft[f] as string)) && caffeineValid;
  // Equal bed / out-of-bed times describe a zero-length night — degenerate input
  // the store and metrics reject, so it gets the same calm inline treatment here.
  const degenerateNight =
    HHMM_RE.test(draft.bedtime) && draft.bedtime === draft.out_of_bed_time;
  const timesValid = formatsValid && !degenerateNight;

  const crisisFlagged = useMemo(
    () => detectCrisisContent(draft.notes) || detectCrisisContent(draft.dream_notes),
    [draft.notes, draft.dream_notes],
  );

  const handleSave = () => {
    if (!timesValid) {
      setShowInvalid(true);
      return;
    }
    const input: SleepEntryInput = {
      bedtime: draft.bedtime,
      lights_out: draft.lights_out,
      sleep_onset_minutes: toNonNegInt(draft.sleep_onset_minutes),
      night_wakings: toNonNegInt(draft.night_wakings),
      night_waking_duration_minutes: toNonNegInt(draft.night_waking_duration_minutes),
      wake_time: draft.wake_time,
      out_of_bed_time: draft.out_of_bed_time,
      sleep_quality: draft.sleep_quality,
      morning_mood: draft.morning_mood,
      dream_recall: draft.dream_recall,
      naps: [],
      substances: {
        alcohol: draft.alcohol,
        exercise: draft.exercise,
        medication_sleep_aid: draft.medication_sleep_aid,
        ...(HHMM_RE.test(draft.caffeine_last_time)
          ? { caffeine_last_time: draft.caffeine_last_time }
          : {}),
      },
      ...(draft.dream_recall && draft.dream_notes.trim() ? { dream_notes: draft.dream_notes } : {}),
      ...(draft.notes.trim() ? { notes: draft.notes } : {}),
    };
    onSubmit(input);
  };

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="gap-5 px-4 pb-12 pt-2"
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="h1">{t.heading}</Text>

      <Section title={CT4_SLEEP.tabs.diary}>
        <TimeField label={t.bedtime} value={draft.bedtime} onChange={(v) => set('bedtime', v)} invalid={showInvalid && (!HHMM_RE.test(draft.bedtime) || degenerateNight)} />
        <TimeField label={t.lightsOut} value={draft.lights_out} onChange={(v) => set('lights_out', v)} invalid={showInvalid && !HHMM_RE.test(draft.lights_out)} />
        <NumberField label={t.onset} value={draft.sleep_onset_minutes} onChange={(v) => set('sleep_onset_minutes', v)} />
        <NumberField label={t.wakings} value={draft.night_wakings} onChange={(v) => set('night_wakings', v)} />
        <NumberField label={t.wakeDuration} value={draft.night_waking_duration_minutes} onChange={(v) => set('night_waking_duration_minutes', v)} />
        <TimeField label={t.wakeTime} value={draft.wake_time} onChange={(v) => set('wake_time', v)} invalid={showInvalid && !HHMM_RE.test(draft.wake_time)} />
        <TimeField label={t.outOfBed} value={draft.out_of_bed_time} onChange={(v) => set('out_of_bed_time', v)} invalid={showInvalid && (!HHMM_RE.test(draft.out_of_bed_time) || degenerateNight)} />
      </Section>

      <Section title={t.quality}>
        <RatingField label={t.quality} value={draft.sleep_quality} onChange={(v) => set('sleep_quality', v)} />
        <RatingField label={t.mood} value={draft.morning_mood} onChange={(v) => set('morning_mood', v)} />
      </Section>

      <Section title={t.substances}>
        <ToggleField label={t.alcohol} value={draft.alcohol} onChange={(v) => set('alcohol', v)} />
        <ToggleField label={t.exercise} value={draft.exercise} onChange={(v) => set('exercise', v)} />
        <ToggleField label={t.medication} value={draft.medication_sleep_aid} onChange={(v) => set('medication_sleep_aid', v)} />
        <TimeField label={t.caffeine} value={draft.caffeine_last_time} onChange={(v) => set('caffeine_last_time', v)} invalid={showInvalid && !caffeineValid} />
      </Section>

      <Section title={t.dreamRecall}>
        <ToggleField label={t.dreamRecall} value={draft.dream_recall} onChange={(v) => set('dream_recall', v)} />
        {draft.dream_recall ? (
          <NotesField label={t.dreamNotes} value={draft.dream_notes} onChange={(v) => set('dream_notes', v)} />
        ) : null}
        <NotesField label={t.notes} value={draft.notes} onChange={(v) => set('notes', v)} />
      </Section>

      {showInvalid && !timesValid ? (
        <Text variant="caption" className="text-error dark:text-error-dark">
          {formatsValid ? t.equalTimes : t.invalid}
        </Text>
      ) : null}

      {crisisFlagged ? (
        <View className="gap-2 rounded-xl border border-crisis px-4 py-3">
          <Text variant="caption" className="text-text-primary dark:text-text-primary-dark">
            If you’re going through something hard, support is here for you.
          </Text>
          <CrisisPill />
        </View>
      ) : null}

      <View className="gap-2 pt-1">
        <Button variant="primary" className="w-full" onPress={handleSave}>
          {t.save}
        </Button>
        <Button variant="ghost" className="w-full" onPress={onCancel}>
          {t.cancel}
        </Button>
      </View>
    </ScrollView>
  );
}

// ── field primitives ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text
        variant="caption"
        className="uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text variant="caption" className="text-text-primary dark:text-text-primary-dark">
        {label}
      </Text>
      {children}
    </View>
  );
}

function placeholderTint(scheme: ReturnType<typeof useColorScheme>['colorScheme']): string {
  return scheme === 'dark' ? colors.text.tertiary.dark : colors.text.tertiary.light;
}

function TimeField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  return (
    <FieldRow label={label}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={CT4_SLEEP.form.timeHint}
        placeholderTextColor={placeholderTint(colorScheme)}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        accessibilityLabel={label}
        className={`min-h-[44px] rounded-lg border bg-surface px-3 py-2 text-base text-text-primary dark:bg-surface-dark dark:text-text-primary-dark ${
          invalid ? 'border-error dark:border-error-dark' : 'border-border dark:border-border-dark'
        }`}
      />
    </FieldRow>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldRow label={label}>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={3}
        accessibilityLabel={label}
        className="min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-base text-text-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-primary-dark"
      />
    </FieldRow>
  );
}

function NotesField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { colorScheme } = useColorScheme();
  return (
    <FieldRow label={label}>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={1000}
        placeholder=""
        placeholderTextColor={placeholderTint(colorScheme)}
        accessibilityLabel={label}
        className="min-h-[72px] rounded-lg border border-border bg-surface px-3 py-2 text-base text-text-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-primary-dark"
      />
    </FieldRow>
  );
}

function RatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SleepRating;
  onChange: (v: SleepRating) => void;
}) {
  const ratings: SleepRating[] = [1, 2, 3, 4, 5];
  return (
    <FieldRow label={label}>
      <View className="flex-row gap-2">
        {ratings.map((r) => {
          const selected = r === value;
          const scaleLabel = CT4_SLEEP.ratingScale[r - 1] ?? String(r);
          return (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${scaleLabel}`}
              onPress={() => onChange(r)}
              className={`min-h-[44px] flex-1 items-center justify-center rounded-lg border bg-surface dark:bg-surface-dark ${
                selected
                  ? 'border-primary dark:border-primary-dark'
                  : 'border-border dark:border-border-dark'
              }`}
            >
              <Text
                variant={selected ? 'label' : 'body'}
                className={selected ? 'text-primary dark:text-primary-dark' : ''}
              >
                {r}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </FieldRow>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="min-h-[44px] flex-row items-center justify-between">
      <Text variant="body">{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary.default.light, false: colors.charcoal[300] }}
      />
    </View>
  );
}
