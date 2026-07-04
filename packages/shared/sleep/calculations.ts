// Sleep Architect — pure calculation functions. Ported from psychage-v2
// `src/lib/sleep/calculations.ts`. No side effects, no hidden clock.
//
// ONE deliberate divergence from web: web's `calculateStreak` called `new Date()`
// internally (impure, untestable, and UTC-drift-prone via `new Date(e.date)`).
// Here `today` is injected as a LocalCalendarDate and day arithmetic goes through
// `dayNumber`, so streaks are deterministic and timezone-proof.

import { SLEEP_RECOMMENDATIONS } from './constants';
import { dayNumber } from './dates';
import type {
  BedtimeSuggestion,
  LocalCalendarDate,
  SleepDebtResult,
  SleepEntry,
  SleepMetrics,
  SleepScoreBreakdown,
  StreakData,
} from './types';

// ─── Time helpers ────────────────────────────────────────────────────────────

/** Parse "HH:MM" to minutes since midnight. */
export function parseTime(time: string): number {
  const [hStr = '0', mStr = '0'] = time.split(':');
  return Number(hStr) * 60 + (Number(mStr) || 0);
}

/** Minutes since midnight to "HH:MM" (wraps >1440). */
export function formatTime(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Format minutes as "Xh Ym". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.round(Math.abs(minutes) % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Minutes between two HH:MM times, wrapping through midnight when end < start.
 * Equal start/end yields 0 — NOT a full 24h wrap: identical times describe a
 * zero-length interval, and treating them as 1440 minted a phantom full-day night.
 */
export function minutesBetween(start: string, end: string): number {
  const s = parseTime(start);
  const e = parseTime(end);
  if (e >= s) return e - s;
  return 1440 - s + e;
}

// ─── Entry metrics ───────────────────────────────────────────────────────────

/** Derived metrics from a single night. */
export function calculateMetrics(entry: SleepEntry): SleepMetrics {
  const time_in_bed_minutes = minutesBetween(entry.bedtime, entry.out_of_bed_time);
  const sleep_latency_minutes = entry.sleep_onset_minutes;
  const wake_after_sleep_onset = entry.night_waking_duration_minutes;
  const total_sleep_minutes = Math.max(
    0,
    time_in_bed_minutes - sleep_latency_minutes - wake_after_sleep_onset,
  );
  const sleep_efficiency =
    time_in_bed_minutes > 0 ? (total_sleep_minutes / time_in_bed_minutes) * 100 : 0;

  // Midpoint of sleep: lights_out + onset + (total_sleep / 2).
  const lights_out_min = parseTime(entry.lights_out);
  const sleep_start = lights_out_min + sleep_latency_minutes;
  const midpoint_min = sleep_start + total_sleep_minutes / 2;
  const midpoint_of_sleep = formatTime(midpoint_min);

  return {
    time_in_bed_minutes,
    total_sleep_minutes,
    sleep_efficiency,
    sleep_latency_minutes,
    wake_after_sleep_onset,
    midpoint_of_sleep,
  };
}

// ─── Sleep score (0–100, computed; UI renders a band, never the number) ──────

const SCORE_WEIGHTS = {
  duration: 0.25,
  efficiency: 0.25,
  quality: 0.2,
  consistency: 0.15,
  latency: 0.15,
} as const;

// Concrete fallback so the lookup is total under noUncheckedIndexedAccess (the
// string-indexed Record returns T | undefined for any key, including 'adult_26_64').
const DEFAULT_DURATION_REC = { min: 420, max: 540, ideal: 480, label: 'Adult (26–64)' } as const;

function scoreDuration(avgMinutes: number, ageRange: string): number {
  const rec = SLEEP_RECOMMENDATIONS[ageRange] ?? DEFAULT_DURATION_REC;
  if (avgMinutes >= rec.min && avgMinutes <= rec.max) return 100;
  if (avgMinutes < rec.min) {
    const deficit = rec.min - avgMinutes;
    return Math.max(0, 100 - deficit * 0.5);
  }
  const excess = avgMinutes - rec.max;
  return Math.max(0, 100 - excess * 0.3);
}

function scoreEfficiency(avgEfficiency: number): number {
  // 85%+ is target.
  return Math.min(100, (avgEfficiency / 85) * 100);
}

function scoreQuality(avgQuality: number): number {
  return (avgQuality / 5) * 100;
}

function scoreConsistency(entries: readonly SleepEntry[]): number {
  if (entries.length < 2) return 100;
  const bedtimes = entries.map((e) => {
    const mins = parseTime(e.bedtime);
    // Normalize around midnight: PM times become negative so 23:30 and 00:30 sit close.
    return mins > 720 ? mins - 1440 : mins;
  });
  const mean = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
  const variance = bedtimes.reduce((sum, t) => sum + (t - mean) ** 2, 0) / bedtimes.length;
  const stddev = Math.sqrt(variance);
  // 0 stddev = 100; 60+ min stddev = 0.
  return Math.max(0, Math.min(100, 100 - (stddev / 60) * 100));
}

function scoreLatency(avgLatency: number): number {
  // Ideal: 10–20 min.
  if (avgLatency >= 10 && avgLatency <= 20) return 100;
  if (avgLatency < 10) {
    // Falling asleep too fast may indicate sleep deprivation.
    return Math.max(60, 100 - (10 - avgLatency) * 4);
  }
  return Math.max(0, 100 - (avgLatency - 20) * 2);
}

/** Composite score from a window of entries. Returns all-zero for an empty window. */
export function calculateSleepScore(
  entries: readonly SleepEntry[],
  ageRange = 'adult_26_64',
): SleepScoreBreakdown {
  if (entries.length === 0) {
    return { overall: 0, duration: 0, efficiency: 0, quality: 0, consistency: 0, latency: 0 };
  }

  const metrics = entries.map(calculateMetrics);
  const avgDuration = metrics.reduce((s, m) => s + m.total_sleep_minutes, 0) / metrics.length;
  const avgEfficiency = metrics.reduce((s, m) => s + m.sleep_efficiency, 0) / metrics.length;
  const avgQuality = entries.reduce((s, e) => s + e.sleep_quality, 0) / entries.length;
  const avgLatency = entries.reduce((s, e) => s + e.sleep_onset_minutes, 0) / entries.length;

  const duration = scoreDuration(avgDuration, ageRange);
  const efficiency = scoreEfficiency(avgEfficiency);
  const quality = scoreQuality(avgQuality);
  const consistency = scoreConsistency(entries);
  const latency = scoreLatency(avgLatency);

  const overall = Math.round(
    duration * SCORE_WEIGHTS.duration +
      efficiency * SCORE_WEIGHTS.efficiency +
      quality * SCORE_WEIGHTS.quality +
      consistency * SCORE_WEIGHTS.consistency +
      latency * SCORE_WEIGHTS.latency,
  );

  return {
    overall: Math.min(100, Math.max(0, overall)),
    duration: Math.round(duration),
    efficiency: Math.round(efficiency),
    quality: Math.round(quality),
    consistency: Math.round(consistency),
    latency: Math.round(latency),
  };
}

// ─── Scoring window (web parity) ─────────────────────────────────────────────

/**
 * Entries falling within the last `days` calendar days relative to `today`,
 * inclusive of `today` itself: `days = 7` keeps exactly the 7 calendar days
 * `today-6 .. today`. This is the shared "last N days" window every surface
 * (dashboard, weekly digest, export) agrees on — the previous `today - days`
 * cutoff kept 8 calendar days for "7 days", disagreeing with the digest/export
 * windows (`>= today - 6`). `today` is injected (no hidden clock) and differencing
 * goes through `dayNumber`, so the window is timezone-proof. Replaces the prior
 * fixed "newest 14 entries" slice, which scored a different set than web for the
 * same logged data.
 */
export function windowByDays(
  entries: readonly SleepEntry[],
  today: LocalCalendarDate,
  days: number,
): SleepEntry[] {
  const cutoff = dayNumber(today) - days + 1;
  return entries.filter((e) => dayNumber(e.date) >= cutoff);
}

// ─── Sleep debt ──────────────────────────────────────────────────────────────

export function calculateSleepDebt(
  entries: readonly SleepEntry[],
  targetMinutes: number,
): SleepDebtResult {
  const last14 = entries.slice(-14);
  const daily_deficits = last14.map((entry) => {
    const metrics = calculateMetrics(entry);
    const deficit = Math.max(0, targetMinutes - metrics.total_sleep_minutes);
    return { date: entry.date as string, deficit_minutes: deficit };
  });

  const total_debt_minutes = daily_deficits.reduce((sum, d) => sum + d.deficit_minutes, 0);

  // Estimate recovery assuming ~30 extra min per night.
  const recovery_days_estimate =
    total_debt_minutes > 0 ? Math.ceil(total_debt_minutes / 30) : 0;

  return { total_debt_minutes, daily_deficits, recovery_days_estimate };
}

// ─── Optimal bedtime calculator (90-min cycle model) ─────────────────────────

export function calculateOptimalBedtimes(
  wakeTime: string,
  onsetMinutes = 15,
  targetCycles = 5,
): BedtimeSuggestion[] {
  const wakeMin = parseTime(wakeTime);
  return [6, 5, 4, 3].map((cycles) => {
    const sleepMin = cycles * 90;
    const totalMin = sleepMin + onsetMinutes;
    const bedMin = wakeMin - totalMin;
    return {
      bedtime: formatTime(bedMin),
      cycles,
      sleep_duration_minutes: sleepMin,
      recommended: cycles === targetCycles,
    };
  });
}

// ─── Streak (today injected — see file header) ───────────────────────────────

export function calculateStreak(
  entries: readonly SleepEntry[],
  today: LocalCalendarDate,
): StreakData {
  // Day numbers, newest first (lexical desc on YYYY-MM-DD equals chronological desc).
  const days = [...entries]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((e) => ({ day: dayNumber(e.date), date: e.date as string }));

  const newest = days[0];
  if (newest === undefined) {
    return { current: 0, best: 0, last_logged_date: '', weekly_count: 0 };
  }

  const todayNum = dayNumber(today);

  // Current streak: 0 if the most recent entry is more than 1 day stale.
  let current = 0;
  if (todayNum - newest.day <= 1) {
    current = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = days[i - 1];
      const cur = days[i];
      if (prev !== undefined && cur !== undefined && prev.day - cur.day === 1) current++;
      else break;
    }
  }

  // Best streak across all entries.
  let best = 1;
  let temp = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const cur = days[i];
    if (prev !== undefined && cur !== undefined && prev.day - cur.day === 1) {
      temp++;
      best = Math.max(best, temp);
    } else {
      temp = 1;
    }
  }
  best = Math.max(best, current);

  const weekAgo = todayNum - 7;
  const weekly_count = days.filter((d) => d.day >= weekAgo).length;

  return { current, best, last_logged_date: newest.date, weekly_count };
}
