import { describe, expect, it } from 'vitest';

import { windowByDays } from '../calculations';
import type { LocalCalendarDate, SleepEntry } from '../types';

function entry(date: string): SleepEntry {
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
  };
}

const today = '2026-06-16' as LocalCalendarDate;

describe('windowByDays (shared "last N days" window)', () => {
  it('days=7 keeps EXACTLY 7 calendar days: today-6 .. today, inclusive', () => {
    // Cutoff = 2026-06-10. All "7 days" surfaces (dashboard, digest, export) agree
    // on a true 7-day window — the old `today - 7` cutoff kept 8 calendar days.
    const entries = [
      entry('2026-06-16'),
      entry('2026-06-10'), // exactly on the cutoff (today-6) → kept
      entry('2026-06-09'), // day 8 counting back → dropped
    ];
    const result = windowByDays(entries, today, 7).map((e) => e.date);
    expect(result).toEqual(['2026-06-16', '2026-06-10']);
  });

  it('does NOT behave like a fixed-count slice: every entry inside the window is kept', () => {
    // 16 consecutive days, newest-first. A 7-day window keeps the most recent 7
    // calendar days (today-6 .. today) regardless of total entry count.
    const dates = Array.from({ length: 16 }, (_, i) => {
      const d = 16 - i; // 16..1 → newest-first 2026-06-16 .. 2026-06-01
      return entry(`2026-06-${String(d).padStart(2, '0')}`);
    });
    const result = windowByDays(dates, today, 7).map((e) => e.date);
    expect(result).toEqual([
      '2026-06-16',
      '2026-06-15',
      '2026-06-14',
      '2026-06-13',
      '2026-06-12',
      '2026-06-11',
      '2026-06-10',
    ]);
  });

  it('widens with larger ranges (30, 90)', () => {
    const entries = [entry('2026-06-16'), entry('2026-05-20'), entry('2026-03-20')];
    expect(windowByDays(entries, today, 7).map((e) => e.date)).toEqual(['2026-06-16']);
    expect(windowByDays(entries, today, 30).map((e) => e.date)).toEqual([
      '2026-06-16',
      '2026-05-20',
    ]);
    expect(windowByDays(entries, today, 90).map((e) => e.date)).toEqual([
      '2026-06-16',
      '2026-05-20',
      '2026-03-20',
    ]);
  });

  it('returns empty when no entry falls in the window and preserves input order otherwise', () => {
    expect(windowByDays([], today, 7)).toEqual([]);
    const stale = [entry('2026-01-02'), entry('2026-01-01')];
    expect(windowByDays(stale, today, 7)).toEqual([]);
    const ordered = [entry('2026-06-15'), entry('2026-06-16'), entry('2026-06-14')];
    expect(windowByDays(ordered, today, 7).map((e) => e.date)).toEqual([
      '2026-06-15',
      '2026-06-16',
      '2026-06-14',
    ]);
  });
});
