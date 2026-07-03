// My providers — mobile-local saved-provider list + per-provider "contacted" flag.
// Forward-only versioned migrator (Sacred Rule #13) plus a reactive layer so the
// directory's "My providers" surface updates the moment a provider is saved, called,
// or marked contacted.
//
// Local-first by design: works fully signed-out (no auth wall, no server). We
// denormalize a tiny snapshot (id, name, credentials, type, phone, city/state)
// captured at save time so the list renders + dials without re-fetching N providers.
// These are PUBLIC, non-PII provider fields (the same data the public directory
// shows) — NEVER symptom / mood / navigator state, which never persists (Sacred
// Rule #4). migrate() is pure (the SR-13 test unit).

import { storage } from '@/lib/adapters/storage';
import type { Storage } from '@/lib/adapters/storage';

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'mobile:my-providers';
export const MAX_PROVIDERS = 100;

export interface SavedProvider {
  /** Directory provider id, or `manual:<token>` for a manually-entered provider. */
  readonly id: string;
  readonly name: string;
  readonly credentials: string | null;
  readonly typeLabel: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly state: string | null;
  /** ISO timestamp the provider was saved. */
  readonly savedAt: string;
  /** ISO timestamp the user marked them called/contacted; null when not contacted. */
  readonly contactedAt: string | null;
  /** True for a manually-entered provider (not from the NPI directory). */
  readonly manual: boolean;
}

/** The fields a caller supplies when saving — the store stamps savedAt/contactedAt. */
export type SavedProviderInput = Pick<SavedProvider, 'id' | 'name'> &
  Partial<Pick<SavedProvider, 'credentials' | 'typeLabel' | 'phone' | 'city' | 'state' | 'manual'>>;

export interface MyProviders {
  readonly version: number;
  readonly items: readonly SavedProvider[];
}

function seed(): MyProviders {
  return { version: SCHEMA_VERSION, items: [] };
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeItem(value: unknown): SavedProvider | null {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as Record<string, unknown>;
  if (typeof e.id !== 'string' || e.id.length === 0) return null;
  if (typeof e.name !== 'string' || e.name.length === 0) return null;
  return {
    id: e.id,
    name: e.name,
    credentials: str(e.credentials),
    typeLabel: str(e.typeLabel),
    phone: str(e.phone),
    city: str(e.city),
    state: str(e.state),
    savedAt: str(e.savedAt) ?? '',
    contactedAt: str(e.contactedAt),
    manual: e.manual === true,
  };
}

/**
 * Parse + migrate the raw persisted JSON into the current schema.
 * - null / parse failure / non-object / missing or future version → seed.
 * - matching version → items normalized, deduped by id, capped.
 */
export function migrate(rawJson: string | null): MyProviders {
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
  const items: SavedProvider[] = [];
  for (const raw of e.items) {
    const item = normalizeItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= MAX_PROVIDERS) break;
  }
  return { version: SCHEMA_VERSION, items };
}

// ── pure transforms (exported for tests) ─────────────────────────────────────

/** Add (newest-first) if absent, or remove if already saved — toggle by id. */
export function toggleSaved(
  prev: readonly SavedProvider[],
  input: SavedProviderInput,
  nowIso: string,
): SavedProvider[] {
  if (prev.some((p) => p.id === input.id)) return prev.filter((p) => p.id !== input.id);
  const next: SavedProvider = {
    id: input.id,
    name: input.name,
    credentials: input.credentials ?? null,
    typeLabel: input.typeLabel ?? null,
    phone: input.phone ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    savedAt: nowIso,
    contactedAt: null,
    manual: input.manual ?? false,
  };
  return [next, ...prev].slice(0, MAX_PROVIDERS);
}

/** Set/clear the contacted flag for one provider. */
export function setContacted(
  prev: readonly SavedProvider[],
  id: string,
  contacted: boolean,
  nowIso: string,
): SavedProvider[] {
  return prev.map((p) => (p.id === id ? { ...p, contactedAt: contacted ? nowIso : null } : p));
}

/** Remove one provider by id. */
export function removeById(prev: readonly SavedProvider[], id: string): SavedProvider[] {
  return prev.filter((p) => p.id !== id);
}

/** DI-style read → migrate → write-back-if-needed. */
export function loadMyProviders(s: Storage): MyProviders {
  const raw = s.get(STORAGE_KEY);
  const value = migrate(raw);
  if (raw === null || raw !== JSON.stringify(value)) s.set(STORAGE_KEY, JSON.stringify(value));
  return value;
}

// ── reactive singleton layer (useSyncExternalStore-compatible) ───────────────

let cache: MyProviders | null = null;
const listeners = new Set<() => void>();

function ensureLoaded(): MyProviders {
  if (cache === null) cache = loadMyProviders(storage);
  return cache;
}

function write(items: readonly SavedProvider[]): void {
  const next: MyProviders = { version: SCHEMA_VERSION, items };
  cache = next;
  storage.set(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

export function getMyProvidersSnapshot(): MyProviders {
  return ensureLoaded();
}

export function subscribeMyProviders(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function isProviderSaved(id: string): boolean {
  return ensureLoaded().items.some((p) => p.id === id);
}

/** Save (if absent) or unsave (if present) a provider. No-op on empty id/name. */
export function toggleSavedProvider(input: SavedProviderInput): void {
  if (!input.id || !input.name) return;
  write(toggleSaved(ensureLoaded().items, input, new Date().toISOString()));
}

/** Mark a saved provider called/contacted (or clear it). */
export function setProviderContacted(id: string, contacted: boolean): void {
  write(setContacted(ensureLoaded().items, id, contacted, new Date().toISOString()));
}

/** Add a provider the user types in by hand (not from the directory). Returns its id. */
export function addManualProvider(input: { name: string; phone?: string | null }): string | null {
  const name = input.name.trim();
  if (!name) return null;
  const id = `manual:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  write(
    toggleSaved(
      ensureLoaded().items,
      { id, name, phone: input.phone?.trim() || null, manual: true },
      new Date().toISOString(),
    ),
  );
  return id;
}

export function removeProvider(id: string): void {
  write(removeById(ensureLoaded().items, id));
}

/**
 * Drop the in-memory cache and re-notify subscribers so the next read
 * re-hydrates from disk. Used after a disk wipe (S48 delete / privacy clear)
 * so a stale cache can't keep serving — or re-persist — deleted data (PR-013).
 */
export function reloadMyProvidersFromDisk(): void {
  cache = null;
  for (const listener of listeners) listener();
}

/** Test seam: drop the in-memory cache + listeners so a fresh-storage test re-hydrates. */
export function __resetMyProvidersCacheForTests(): void {
  cache = null;
  listeners.clear();
}
