import { describe, expect, it } from 'vitest';

import {
  calculateMetrics,
  calculateOptimalBedtimes,
  calculateSleepDebt,
  calculateSleepScore,
  calculateStreak,
  formatDuration,
  formatTime,
  minutesBetween,
  parseTime,
} from '../calculations';
import type { LocalCalendarDate, SleepEntry } from '../types';

function entry(date: string, over: Partial<SleepEntry> = {}): SleepEntry {
  return {
    id: `e-${date}`,
    date: date as LocalCalendarDate,
    created_at: '2026-01-01T00:00:00.000Z',
    bedtime: '23:00',
    lights_out: '23:15',
    sleep_onset_minutes: 15,
    wake_time: '07:00',
    out_of_bed_time: '07:15',
    night_wakings: 0,
    night_waking_duration_minutes: 0,
    sleep_quality: 4,
    morning_mood: 4,
    dream_recall: false,
    naps: [],
    substances: { alcohol: false, exercise: false, medication_sleep_aid: false },
    ...over,
  };
}

describe('time helpers', () => {
  it('parseTime / formatTime round-trip and wrap', () => {
    expect(parseTime('23:15')).toBe(1395);
    expect(formatTime(1395)).toBe('23:15');
    expect(formatTime(-45)).toBe('23:15'); // wraps through midnight
    expect(formatTime(1500)).toBe('01:00');
  });

  it('minutesBetween handles same-day and midnight crossing', () => {
    expect(minutesBetween('22:00', '23:30')).toBe(90);
    expect(minutesBetween('23:00', '07:15')).toBe(495); // crosses midnight
  });

  it('minutesBetween of equal times is a zero-length interval, not a full 24h wrap', () => {
    expect(minutesBetween('22:00', '22:00')).toBe(0);
    expect(minutesBetween('00:00', '00:00')).toBe(0);
  });

  it('formatDuration', () => {
    expect(formatDuration(495)).toBe('8h 15m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(45)).toBe('45m');
  });
});

describe('calculateMetrics', () => {
  it('computes TIB / TST / efficiency across a midnight-crossing night', () => {
    const m = calculateMetrics(entry('2026-06-16'));
    expect(m.time_in_bed_minutes).toBe(495);
    expect(m.total_sleep_minutes).toBe(480); // 495 - 15 latency - 0 WASO
    expect(m.sleep_efficiency).toBeCloseTo((480 / 495) * 100, 5);
  });

  it('subtracts WASO and never goes negative', () => {
    const m = calculateMetrics(entry('2026-06-16', { night_waking_duration_minutes: 60 }));
    expect(m.total_sleep_minutes).toBe(420);
    const wild = calculateMetrics(
      entry('2026-06-16', { sleep_onset_minutes: 600, night_waking_duration_minutes: 600 }),
    );
    expect(wild.total_sleep_minutes).toBe(0);
    expect(wild.sleep_efficiency).toBeGreaterThanOrEqual(0);
  });

  it('a zero-length night (bedtime == out_of_bed_time) yields zeroed metrics, not a phantom 24h night', () => {
    // Equal times used to wrap to 1440 minutes in bed — a fabricated full-day night
    // that inflated TIB/TST. The degenerate-input guard (efficiency's TIB > 0 check)
    // now sees 0 and the whole metric set stays at the zero floor callers tolerate.
    const m = calculateMetrics(
      entry('2026-06-16', { bedtime: '22:00', out_of_bed_time: '22:00', sleep_onset_minutes: 0, night_waking_duration_minutes: 0 }),
    );
    expect(m.time_in_bed_minutes).toBe(0);
    expect(m.total_sleep_minutes).toBe(0);
    expect(m.sleep_efficiency).toBe(0);
  });
});

describe('calculateSleepScore', () => {
  it('returns all-zero for an empty window', () => {
    expect(calculateSleepScore([])).toEqual({
      overall: 0,
      duration: 0,
      efficiency: 0,
      quality: 0,
      consistency: 0,
      latency: 0,
    });
  });

  it('scores a healthy single night high, weighting the five components', () => {
    const s = calculateSleepScore([entry('2026-06-16')]);
    // duration 100, efficiency 100, quality 80, consistency 100 (n<2), latency 100
    // = 25 + 25 + 16 + 15 + 15 = 96
    expect(s.overall).toBe(96);
    expect(s.duration).toBe(100);
    expect(s.quality).toBe(80);
    expect(s.consistency).toBe(100);
    expect(s.overall).toBeGreaterThanOrEqual(0);
    expect(s.overall).toBeLessThanOrEqual(100);
  });

  it('penalizes erratic bedtimes via the consistency component', () => {
    const erratic = calculateSleepScore([
      entry('2026-06-15', { bedtime: '21:00' }),
      entry('2026-06-16', { bedtime: '01:00' }),
    ]);
    expect(erratic.consistency).toBeLessThan(100);
  });
});

describe('calculateSleepDebt', () => {
  it('sums per-night deficits against the target and estimates recovery', () => {
    const short = entry('2026-06-16', { out_of_bed_time: '06:00' }); // TIB 420, TST 405
    const debt = calculateSleepDebt([short], 480);
    expect(debt.daily_deficits[0].deficit_minutes).toBe(75);
    expect(debt.total_debt_minutes).toBe(75);
    expect(debt.recovery_days_estimate).toBe(3); // ceil(75 / 30)
  });

  it('no debt when the target is met', () => {
    const debt = calculateSleepDebt([entry('2026-06-16')], 480);
    expect(debt.total_debt_minutes).toBe(0);
    expect(debt.recovery_days_estimate).toBe(0);
  });
});

describe('calculateStreak (today injected)', () => {
  const today = (d: string) => d as LocalCalendarDate;

  it('counts consecutive days up to today', () => {
    const s = calculateStreak(
      [entry('2026-06-15'), entry('2026-06-16'), entry('2026-06-17')],
      today('2026-06-17'),
    );
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
    expect(s.weekly_count).toBe(3);
    expect(s.last_logged_date).toBe('2026-06-17');
  });

  it('current resets to 0 when the latest entry is stale, but best survives', () => {
    const s = calculateStreak(
      [entry('2026-06-15'), entry('2026-06-16'), entry('2026-06-17')],
      today('2026-06-21'),
    );
    expect(s.current).toBe(0);
    expect(s.best).toBe(3);
  });

  it('empty entries → zeros', () => {
    expect(calculateStreak([], today('2026-06-17'))).toEqual({
      current: 0,
      best: 0,
      last_logged_date: '',
      weekly_count: 0,
    });
  });
});

describe('calculateOptimalBedtimes', () => {
  it('offers 6/5/4/3-cycle bedtimes back from wake, flagging the target', () => {
    const suggestions = calculateOptimalBedtimes('07:00', 15, 5);
    expect(suggestions.map((s) => s.cycles)).toEqual([6, 5, 4, 3]);
    const recommended = suggestions.find((s) => s.recommended);
    expect(recommended?.cycles).toBe(5);
    expect(recommended?.bedtime).toBe('23:15'); // 07:00 − (5×90 + 15) min, wrapped
  });
});
