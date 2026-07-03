import { storage } from '@/lib/adapters/storage';

export interface ReadState {
  progress: number; // progress 0..1
  lastAt: number;
  // Optional display metadata captured from the real reader so the Today
  // "Pick up where you left off" rail can render real titles without a refetch.
  // Optional + tolerant-parse keeps this backward-compatible with rows written
  // before these fields existed (CLAUDE.md §13 — additive, no migration needed).
  title?: string;
  readTime?: number; // minutes
}

export type ReadMeta = Pick<ReadState, 'title' | 'readTime'>;

const STORAGE_KEY = 'psychage:reads';

// A persisted row must at least carry the numeric fields the consumers touch:
// getInProgressReads filters on `progress` and sorts on `lastAt`. Rows failing
// this are dropped (reseed-on-anomaly at row granularity).
function isReadState(value: unknown): value is ReadState {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { progress?: unknown }).progress === 'number' &&
    typeof (value as { lastAt?: unknown }).lastAt === 'number'
  );
}

// Legacy 'psychage:' key with live user data — structurally validated on read
// instead of SR-13-enveloped: wrapping it in a versioned envelope would orphan
// every existing row. Anomalies (JSON.parse('"null"') → null, arrays, scalars,
// wrong-typed rows) reseed to the empty default so Object.entries() in
// getInProgressReads never crashes the Today render (PR-006). Never writes —
// getters must not write; setProgress owns persistence.
function getStoredData(): Record<string, ReadState> {
  const raw = storage.get(STORAGE_KEY);
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  const valid: Record<string, ReadState> = {};
  for (const [id, row] of Object.entries(parsed)) {
    if (isReadState(row)) valid[id] = row;
  }
  return valid;
}

export const readingProgressStore = {
  setProgress(id: string, progress: number, meta?: ReadMeta): void {
    const data = getStoredData();
    const prev = data[id];
    data[id] = {
      progress,
      lastAt: Date.now(),
      // Preserve prior metadata when this write doesn't carry it.
      title: meta?.title ?? prev?.title,
      readTime: meta?.readTime ?? prev?.readTime,
    };
    storage.set(STORAGE_KEY, JSON.stringify(data));
  },

  getInProgressReads() {
    const reads = getStoredData();
    return Object.entries(reads)
      .filter(([, r]) => r.progress > 0.02 && r.progress < 0.98)
      .sort((a, b) => b[1].lastAt - a[1].lastAt)
      .map(([id, r]) => ({ id, ...r }));
  },
};
