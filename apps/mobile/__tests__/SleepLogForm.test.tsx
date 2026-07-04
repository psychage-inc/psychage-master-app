import { fireEvent, screen } from '@testing-library/react-native';

import { CT4_SLEEP } from '@/features/sleep-architect/copy';
import { SleepLogForm } from '@/features/sleep-architect/diary/SleepLogForm';

import { renderWithProviders } from './_helpers';

// Diary form validation: equal bed / out-of-bed times describe a zero-length
// night — degenerate input the store rejects — so the form blocks the save with
// the same calm inline treatment as a malformed HH:MM.

const t = CT4_SLEEP.form;

describe('SleepLogForm', () => {
  it('rejects equal bed / out-of-bed times with a calm inline error', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<SleepLogForm onSubmit={onSubmit} onCancel={() => {}} />, {
      haptics: true,
    });

    fireEvent.changeText(screen.getByLabelText(t.bedtime), '22:00');
    fireEvent.changeText(screen.getByLabelText(t.outOfBed), '22:00');
    fireEvent.press(screen.getByText(t.save));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(t.equalTimes)).toBeTruthy();
  });

  it('submits once the times differ again', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<SleepLogForm onSubmit={onSubmit} onCancel={() => {}} />, {
      haptics: true,
    });

    fireEvent.changeText(screen.getByLabelText(t.bedtime), '22:00');
    fireEvent.changeText(screen.getByLabelText(t.outOfBed), '22:00');
    fireEvent.press(screen.getByText(t.save));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText(t.outOfBed), '07:15');
    fireEvent.press(screen.getByText(t.save));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(t.equalTimes)).toBeNull();
  });

  it('malformed times keep the existing HH:MM message', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<SleepLogForm onSubmit={onSubmit} onCancel={() => {}} />, {
      haptics: true,
    });

    fireEvent.changeText(screen.getByLabelText(t.bedtime), '25:99');
    fireEvent.press(screen.getByText(t.save));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(t.invalid)).toBeTruthy();
    expect(screen.queryByText(t.equalTimes)).toBeNull();
  });
});
