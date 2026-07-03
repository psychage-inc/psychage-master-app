// Reading text size — an app-level override for the size of long-form READING
// content (article body, Learn intro), layered on top of RN's native Dynamic Type.
// Mobile-local, forward-only versioned migrator (Sacred Rule #13) + a reactive
// layer so the S45 radio drives wrapped reading surfaces immediately.
//
// SCOPE: only the four body variants scale, and only inside a ReadingTextSizeProvider
// (the article reader + Learn). Chrome, captions, and headings are unchanged, and
// any Text outside a provider renders at the 'default' size — so this never reflows
// settings rows, buttons, or navigation. The pure `readingBodySizeClass()` mapping
// is the unit test target (no React, no react-native import).
//
// RESEED-ON-ANOMALY (a derived preference, never throws).

import { storage } from '@/lib/adapters/storage';
import type { Storage } from '@/lib/adapters/storage';

export type ReadingTextSize = 'small' | 'default' | 'large';

/** The body variants that scale with the reading size (others stay fixed). */
export type BodyVariant = 'bodyLarge' | 'body';

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'mobile:reading-text-size';

const SIZES: readonly ReadingTextSize[] = ['small', 'default', 'large'];

export interface ReadingTextSizeState {
  readonly version: number;
  readonly size: ReadingTextSize;
}

// (variant, size) → NativeWind size class. 'default' reproduces the pre-existing
// Text sizes exactly (body→text-base, bodySm→text-sm), so wrapping a surface with
// the provider at the default size is a visual no-op.
const BODY_SIZE_CLASS: Record<BodyVariant, Record<ReadingTextSize, string>> = {
  bodyLarge: { small: 'text-base', default: 'text-lg', large: 'text-xl' },
  body: { small: 'text-sm', default: 'text-base', large: 'text-lg' },
};

/** Pure (variant, size) → size class. The unit-test target for the scaling map. */
export function readingBodySizeClass(variant: BodyVariant, size: ReadingTextSize): string {
  return BODY_SIZE_CLASS[variant][size];
}

function seed(): ReadingTextSizeState {
  return { version: SCHEMA_VERSION, size: 'default' };
}

function normalizeSize(value: unknown): ReadingTextSize {
  return SIZES.includes(value as ReadingTextSize) ? (value as ReadingTextSize) : 'default';
}

/**
 * Parse + migrate the raw persisted JSON into the current schema.
 * - null / parse failure / non-object / missing version / future version → seed.
 * - matching version → pass-through (size normalized to a known bucket).
 */
export function migrate(rawJson: string | null): ReadingTextSizeState {
  if (rawJson === null) return seed();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return seed();
  }

  if (typeof parsed !== 'object' || parsed === null) return seed();

  const e = parsed as { version?: unknown; size?: unknown };
  if (typeof e.version !== 'number') return seed();
  if (e.version !== SCHEMA_VERSION) return seed();

  return { version: SCHEMA_VERSION, size: normalizeSize(e.size) };
}

/** DI-style read → migrate → write-back-if-needed (mirrors loadAppearance). */
export function loadReadingTextSize(s: Storage): ReadingTextSizeState {
  const raw = s.get(STORAGE_KEY);
  const state = migrate(raw);
  if (raw === null || raw !== JSON.stringify(state)) {
    s.set(STORAGE_KEY, JSON.stringify(state));
  }
  return state;
}

// ── reactive singleton layer (useSyncExternalStore-compatible) ───────────────

let cache: ReadingTextSizeState | null = null;
const listeners = new Set<() => void>();

function ensureLoaded(): ReadingTextSizeState {
  if (cache === null) cache = loadReadingTextSize(storage);
  return cache;
}

function write(next: ReadingTextSizeState): void {
  cache = next;
  storage.set(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

export function getReadingTextSizeSnapshot(): ReadingTextSizeState {
  return ensureLoaded();
}

export function subscribeReadingTextSize(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setReadingTextSize(size: ReadingTextSize): void {
  write({ ...ensureLoaded(), size });
}

/** Pure read (no React) — the current reading size, for non-hook consumers. */
export function getReadingTextSizeValue(): ReadingTextSize {
  return ensureLoaded().size;
}

/**
 * Drop the in-memory cache and re-notify subscribers so the next read
 * re-hydrates from disk. Used after a disk wipe (S48 delete / privacy clear)
 * so a stale cache can't keep serving — or re-persist — deleted data (PR-013).
 */
export function reloadReadingTextSizeFromDisk(): void {
  cache = null;
  for (const listener of listeners) listener();
}

/** Test seam: drop the in-memory cache + listeners so a fresh-storage test re-hydrates. */
export function __resetReadingTextSizeCacheForTests(): void {
  cache = null;
  listeners.clear();
}
