import { fireEvent, screen } from '@testing-library/react-native';

import {
  SleepRecordStore,
  type SleepEntryInput,
  type Storage,
} from '@psychage/shared/sleep';

import { CT4_SLEEP } from '@/features/sleep-architect/copy';
import type { SleepPdfInput } from '@/features/sleep-architect/export/build-sleep-html';
import { SleepArchitectView } from '@/features/sleep-architect/SleepArchitectView';

import { renderWithProviders } from './_helpers';

// Shell-level behavior the tabs rely on:
//   1. "Log last night" with today already logged opens the form in EDIT mode,
//      prefilled — a same-day re-log must never blank-overwrite today's notes /
//      ratings through a mode:'new' + saveToday round trip.
//   2. The export flow reads EVERY logged night, not the getRecent(120) slice the
//      tab surfaces render — "All nights" must not silently drop older entries.

// Real SleepRecordStore on an in-memory Storage double + a mutable clock, so
// multi-day histories are built through the public saveToday API (Date Rule 1).
function makeStore(clock: { now: Date }): SleepRecordStore {
  const map = new Map<string, string>();
  const storage: Storage = {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
  let seq = 0;
  return new SleepRecordStore({
    storage,
    now: () => clock.now,
    generateId: () => `test-id-${++seq}`,
  });
}

function input(overrides: Partial<SleepEntryInput> = {}): SleepEntryInput {
  return {
    bedtime: '23:00',
    lights_out: '23:15',
    sleep_onset_minutes: 15,
    night_wakings: 0,
    night_waking_duration_minutes: 0,
    wake_time: '07:00',
    out_of_bed_time: '07:15',
    sleep_quality: 3,
    morning_mood: 3,
    dream_recall: false,
    naps: [],
    substances: { alcohol: false, exercise: false, medication_sleep_aid: false },
    ...overrides,
  };
}

describe('SleepArchitectView', () => {
  it('re-log with today already logged opens the form prefilled (edit, not blank new)', () => {
    const clock = { now: new Date() };
    const store = makeStore(clock);
    store.saveToday(input({ bedtime: '21:45', notes: 'kept me up thinking' }));

    renderWithProviders(<SleepArchitectView store={store} />, { haptics: true });
    fireEvent.press(screen.getByText(CT4_SLEEP.diary.logToday));

    // Prefilled from today's entry — not the mode:'new' defaults.
    expect(screen.getByDisplayValue('21:45')).toBeTruthy();
    expect(screen.getByDisplayValue('kept me up thinking')).toBeTruthy();

    // Saving untouched keeps the night intact (the old path wiped it to defaults).
    fireEvent.press(screen.getByText(CT4_SLEEP.form.save));
    expect(store.getToday()?.bedtime).toBe('21:45');
    expect(store.getToday()?.notes).toBe('kept me up thinking');
  });

  it('log with no entry today opens a fresh form with the draft defaults', () => {
    const clock = { now: new Date() };
    const store = makeStore(clock);

    renderWithProviders(<SleepArchitectView store={store} />, { haptics: true });
    fireEvent.press(screen.getByText(CT4_SLEEP.diary.logToday));

    expect(screen.getByDisplayValue('23:00')).toBeTruthy();

    fireEvent.press(screen.getByText(CT4_SLEEP.form.save));
    expect(store.getToday()).toBeDefined();
  });

  it('"All nights" export sees every logged night, beyond the 120-night tab slice', () => {
    const clock = { now: new Date() };
    const store = makeStore(clock);
    const today = new Date();
    for (let i = 129; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      clock.now = day;
      store.saveToday(input());
    }
    clock.now = new Date();

    let exported: SleepPdfInput | undefined;
    const onExport = jest.fn((pdfInput: SleepPdfInput) => {
      exported = pdfInput;
    });
    renderWithProviders(<SleepArchitectView store={store} onExport={onExport} />, {
      haptics: true,
    });

    fireEvent.press(screen.getByText(CT4_SLEEP.home.exportCta));
    fireEvent.press(screen.getByText(CT4_SLEEP.export.rangeAll));

    // Honest count: all 130 nights, not the capped 120.
    expect(screen.getByText(CT4_SLEEP.export.countLine(130))).toBeTruthy();

    fireEvent.press(screen.getByTestId('sleep-export-generate'));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(exported?.entries).toHaveLength(130);
  });
});
