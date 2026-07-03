/**
 * Bookmarks (Saved Items) — on-device, local-first store.
 *
 * Replaces the auth-gated Supabase backend (P13): saving an article / provider /
 * tool now works fully signed-out and persists on the device, mirroring
 * `lib/persistence/my-providers.ts` ("works fully signed-out, no auth wall"). The
 * key is registered in `lib/persistence/known-keys.ts` so "delete my record"
 * (S48) erases it — the local-first replacement for the old DB FK CASCADE.
 *
 * Forward-only versioned migrator (Sacred Rule #13) — `migrate()` is the pure
 * unit-test target — plus a reactive layer (useSyncExternalStore-compatible) so a
 * save/unsave updates every saved surface immediately. We persist only the
 * (type, id) pair + a savedAt timestamp — all PUBLIC identifiers, never symptom /
 * mood / navigator state (Sacred Rule #4).
 */

import { storage } from '@/lib/adapters/storage';
import type { Storage } from '@/lib/adapters/storage';
import type { BookmarkRef, ResourceType } from './types';

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'mobile:bookmarks';
export const MAX_BOOKMARKS = 500;

const RESOURCE_TYPES: readonly ResourceType[] = ['article', 'video', 'provider', 'tool'];

export interface StoredBookmark {
  readonly resource_type: ResourceType;
  readonly resource_id: string;
  /** ISO timestamp the resource was saved. */
  readonly savedAt: string;
}

export interface BookmarkStoreState {
  readonly version: number;
  readonly items: readonly StoredBookmark[];
}

function seed(): BookmarkStoreState {
  return { version: SCHEMA_VERSION, items: [] };
}

/** Unique key for a (type, id) pair — used for dedupe + the synthesized row id. */
export function bookmarkKey(ref: BookmarkRef): string {
  return `${ref.resource_type}:${ref.resource_id}`;
}

function normalizeItem(value: unknown): StoredBookmark | null {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as Record<string, unknown>;
  if (!RESOURCE_TYPES.includes(e.resource_type as ResourceType)) return null;
  if (typeof e.resource_id !== 'string' || e.resource_id.length === 0) return null;
  return {
    resource_type: e.resource_type as ResourceType,
    resource_id: e.resource_id,
    savedAt: typeof e.savedAt === 'string' && e.savedAt.length > 0 ? e.savedAt : '',
  };
}

/**
 * Parse + migrate the raw persisted JSON into the current schema.
 * - null / parse failure / non-object / missing or future version → seed.
 * - matching version → items normalized, deduped by (type, id), capped.
 */
export function migrate(rawJson: string | null): BookmarkStoreState {
  if (rawJson === null) return seed();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return seed();
  }

  if (typeof parsed !== 'object' || parsed === null) return seed();
  const e = parsed as { version?: unknown; items?: unknown };
  if (typeof e.version !== 'number' || e.version !== SCHEMA_VERSION) return seed();
  if (!Array.isArray(e.items)) return seed();

  const seen = new Set<string>();
  const items: StoredBookmark[] = [];
  for (const raw of e.items) {
    const item = normalizeItem(raw);
    if (!item) continue;
    const key = bookmarkKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= MAX_BOOKMARKS) break;
  }
  return { version: SCHEMA_VERSION, items };
}

// ── pure transforms (exported for tests) ─────────────────────────────────────

/** Idempotent add — newest-first; a duplicate (type, id) is a no-op. */
export function addItem(
  prev: readonly StoredBookmark[],
  ref: BookmarkRef,
  nowIso: string,
): StoredBookmark[] {
  const key = bookmarkKey(ref);
  if (prev.some((b) => bookmarkKey(b) === key)) return [...prev];
  const next: StoredBookmark = {
    resource_type: ref.resource_type,
    resource_id: ref.resource_id,
    savedAt: nowIso,
  };
  return [next, ...prev].slice(0, MAX_BOOKMARKS);
}

/** Remove the matching (type, id) — removing an absent item is a no-op. */
export function removeItem(prev: readonly StoredBookmark[], ref: BookmarkRef): StoredBookmark[] {
  const key = bookmarkKey(ref);
  return prev.filter((b) => bookmarkKey(b) !== key);
}

// ── reactive singleton layer (useSyncExternalStore-compatible) ───────────────

let cache: BookmarkStoreState | null = null;
const listeners = new Set<() => void>();

/** DI-style read → migrate → write-back-if-needed (mirrors loadReadingTextSize). */
export function loadBookmarks(s: Storage): BookmarkStoreState {
  const raw = s.get(STORAGE_KEY);
  const state = migrate(raw);
  if (raw === null || raw !== JSON.stringify(state)) {
    s.set(STORAGE_KEY, JSON.stringify(state));
  }
  return state;
}

function ensureLoaded(): BookmarkStoreState {
  if (cache === null) cache = loadBookmarks(storage);
  return cache;
}

function write(items: readonly StoredBookmark[]): void {
  const next: BookmarkStoreState = { version: SCHEMA_VERSION, items };
  cache = next;
  storage.set(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

export function getBookmarksSnapshot(): BookmarkStoreState {
  return ensureLoaded();
}

export function subscribeBookmarks(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Save a resource (idempotent). Newest-saved sorts first. */
export function saveBookmark(ref: BookmarkRef): void {
  const next = addItem(ensureLoaded().items, ref, new Date().toISOString());
  write(next);
}

/** Remove a saved resource (no-op if absent). */
export function removeBookmark(ref: BookmarkRef): void {
  write(removeItem(ensureLoaded().items, ref));
}

/** Pure read (no React) — is this resource currently saved? */
export function isBookmarked(ref: BookmarkRef): boolean {
  const key = bookmarkKey(ref);
  return ensureLoaded().items.some((b) => bookmarkKey(b) === key);
}

/**
 * Drop the in-memory cache and re-notify subscribers so the next read
 * re-hydrates from disk. Used after a disk wipe (S48 delete / privacy clear)
 * so a stale cache can't keep serving — or re-persist — deleted data (PR-013).
 */
export function reloadBookmarksFromDisk(): void {
  cache = null;
  for (const listener of listeners) listener();
}

/** Test seam: drop the in-memory cache + listeners so a fresh-storage test re-hydrates. */
export function __resetBookmarksCacheForTests(): void {
  cache = null;
  listeners.clear();
}
