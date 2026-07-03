// PR-006: reading-progress + tool-usage parse persisted JSON unvalidated.
// JSON.parse('"null"') → the string "null"… but JSON.parse('null') → null, and
// corrupt/wrong-typed payloads flowed straight into Object.entries(null)
// (Today render crash) and `data.usage[id] =` (recordUse TypeError). These
// tests pin the structural validation + reseed-to-default, and that the
// tool-usage getter no longer writes during read.

import { beforeEach, describe, expect, it } from 'vitest';

import { storage } from '@/lib/adapters/storage';
import { readingProgressStore } from '@/lib/reading-progress-store';
import { toolUsageStore } from '@/lib/tool-usage-store';

const READS_KEY = 'psychage:reads';
const USAGE_KEY = 'psychage:tool_usage';

beforeEach(() => {
  storage.remove(READS_KEY);
  storage.remove(USAGE_KEY);
});

describe('reading-progress store hardening', () => {
  it.each(['null', '"null"', '[1]', '42', 'not json{{{'])(
    'returns no in-progress reads (no throw) for raw %s',
    (raw) => {
      storage.set(READS_KEY, raw);
      expect(readingProgressStore.getInProgressReads()).toEqual([]);
    },
  );

  it('drops rows with a non-numeric progress but keeps valid siblings', () => {
    storage.set(
      READS_KEY,
      JSON.stringify({
        good: { progress: 0.5, lastAt: 1000, title: 'Kept' },
        bad: { progress: 'half', lastAt: 2000 },
        alsoBad: null,
        scalar: 7,
      }),
    );
    const reads = readingProgressStore.getInProgressReads();
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ id: 'good', progress: 0.5, title: 'Kept' });
  });

  it('round-trips valid data written through setProgress', () => {
    readingProgressStore.setProgress('a1', 0.4, { title: 'Article', readTime: 6 });
    const reads = readingProgressStore.getInProgressReads();
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ id: 'a1', progress: 0.4, title: 'Article', readTime: 6 });
  });

  it('setProgress over a corrupt blob reseeds instead of throwing', () => {
    storage.set(READS_KEY, 'null');
    expect(() => readingProgressStore.setProgress('a1', 0.3)).not.toThrow();
    expect(readingProgressStore.getInProgressReads()[0]?.id).toBe('a1');
  });
});

describe('tool-usage store hardening', () => {
  it.each(['null', '"null"', '[1]', '42', 'not json{{{'])(
    'getUsage returns the safe default (no throw) for raw %s',
    (raw) => {
      storage.set(USAGE_KEY, raw);
      const data = toolUsageStore.getUsage();
      expect(typeof data.installedAt).toBe('number');
      expect(data.usage).toEqual({});
    },
  );

  it('recordUse over a corrupt blob reseeds instead of throwing', () => {
    storage.set(USAGE_KEY, 'null'); // old code: data.usage[id] on null → TypeError
    expect(() => toolUsageStore.recordUse('toolkit')).not.toThrow();
    expect(typeof toolUsageStore.getUsage().usage.toolkit).toBe('number');
  });

  it('reseeds the whole envelope when usage is not a plain object', () => {
    storage.set(USAGE_KEY, JSON.stringify({ installedAt: 123, usage: [1, 2] }));
    const data = toolUsageStore.getUsage();
    expect(data.usage).toEqual({});
    expect(typeof data.installedAt).toBe('number'); // fresh default, not the corrupt row
  });

  it('drops non-numeric / unknown-tool usage entries, keeps valid ones', () => {
    storage.set(
      USAGE_KEY,
      JSON.stringify({
        installedAt: 123,
        usage: { toolkit: 456, clarity: 'yesterday', notATool: 789 },
      }),
    );
    expect(toolUsageStore.getUsage()).toEqual({ installedAt: 123, usage: { toolkit: 456 } });
  });

  it('round-trips valid data written through recordUse', () => {
    toolUsageStore.recordUse('navigator');
    const data = toolUsageStore.getUsage();
    expect(typeof data.installedAt).toBe('number');
    expect(typeof data.usage.navigator).toBe('number');
  });

  it('seeds installedAt ONCE on first read — a stable dormant-nudge baseline', () => {
    // Second-pass review: a per-call Date.now() fallback (no seed write) kept
    // resetting the baseline, so the dormant-tool nudge could never fire for a
    // user who had never opened a tool. First read persists the seed; later
    // reads return the SAME installedAt.
    const first = toolUsageStore.getUsage().installedAt;
    expect(storage.get(USAGE_KEY)).not.toBeNull();
    expect(toolUsageStore.getUsage().installedAt).toBe(first);
    toolUsageStore.recordUse('mindmate');
    expect(toolUsageStore.getUsage().installedAt).toBe(first);
  });
});
