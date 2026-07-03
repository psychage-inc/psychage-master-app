import { fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import RemindersScreen from '@/app/settings/reminders';
import { storage } from '@/lib/adapters/storage';
import { loadReminderSettings } from '@/lib/persistence/reminder-settings';

import { renderWithProviders } from './_helpers';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: 'DateTimePicker',
}));

describe('S43 Reminders', () => {
  beforeEach(() => {
    storage.remove('mobile:reminder-settings');
  });

  it('turning the reminder on shows the verbatim confirmation', () => {
    renderWithProviders(<RemindersScreen />);
    fireEvent(screen.getByTestId('reminder-enabled-toggle'), 'valueChange', true);
    expect(screen.getByText('Set. 9:00 PM, changeable in Settings.')).toBeTruthy();
    expect(loadReminderSettings(storage).enabled).toBe(true);
  });

  it('"Never" sets neverAsked permanently and shows the verbatim line', () => {
    renderWithProviders(<RemindersScreen />);
    fireEvent.press(screen.getByTestId('reminder-never'));
    expect(screen.getByTestId('reminder-never-confirmation')).toBeTruthy();
    expect(
      screen.getByText('Okay — reminders stay off. You can turn them on any time in Settings.'),
    ).toBeTruthy();
    expect(loadReminderSettings(storage).neverAsked).toBe(true);
    // The prompt is gone — Never is permanent, the app does not re-ask.
    expect(screen.queryByTestId('reminder-never')).toBeNull();
    expect(screen.queryByTestId('reminder-not-now')).toBeNull();
  });

  // PR-063 — the platform split. iOS's inline spinner fires 'set' on every wheel
  // detent, so it must stay open and commit live; Android's one-shot dialog closes
  // on any change event.
  describe('time picker platform split (PR-063)', () => {
    const openPicker = () => {
      fireEvent(screen.getByTestId('reminder-enabled-toggle'), 'valueChange', true);
      fireEvent.press(screen.getByTestId('reminder-time-row'));
    };

    it('iOS: commits the value on change and keeps the spinner open', () => {
      renderWithProviders(<RemindersScreen />);
      openPicker();

      fireEvent(
        screen.getByTestId('reminder-time-picker'),
        'change',
        { type: 'set' },
        new Date(2026, 0, 1, 8, 30),
      );

      expect(loadReminderSettings(storage).time).toBe('08:30');
      expect(screen.getByTestId('reminder-time-picker')).toBeTruthy();
    });

    it('iOS: pressing the time row again dismisses the spinner', () => {
      renderWithProviders(<RemindersScreen />);
      openPicker();
      expect(screen.getByTestId('reminder-time-picker')).toBeTruthy();

      fireEvent.press(screen.getByTestId('reminder-time-row'));
      expect(screen.queryByTestId('reminder-time-picker')).toBeNull();
    });

    it('Android: commits the value and closes the dialog on change', () => {
      const descriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
      try {
        renderWithProviders(<RemindersScreen />);
        openPicker();

        fireEvent(
          screen.getByTestId('reminder-time-picker'),
          'change',
          { type: 'set' },
          new Date(2026, 0, 1, 8, 30),
        );

        expect(loadReminderSettings(storage).time).toBe('08:30');
        expect(screen.queryByTestId('reminder-time-picker')).toBeNull();
      } finally {
        if (descriptor) Object.defineProperty(Platform, 'OS', descriptor);
      }
    });

    it('Android: a dismissed dialog closes without committing', () => {
      const descriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
      try {
        renderWithProviders(<RemindersScreen />);
        openPicker();
        const before = loadReminderSettings(storage).time;

        fireEvent(screen.getByTestId('reminder-time-picker'), 'change', { type: 'dismissed' });

        expect(loadReminderSettings(storage).time).toBe(before);
        expect(screen.queryByTestId('reminder-time-picker')).toBeNull();
      } finally {
        if (descriptor) Object.defineProperty(Platform, 'OS', descriptor);
      }
    });
  });
});
