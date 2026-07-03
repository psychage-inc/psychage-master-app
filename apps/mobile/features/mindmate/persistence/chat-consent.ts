// MindMate conversation-persistence CONSENT — mobile-local, forward-only versioned
// migrator (Sacred Rule #13) + a reactive layer so the in-chat banner drives the
// live persistence gate immediately.
//
// THIS IS THE USER-CONSENT GATE for saving MindMate conversations to Supabase. The
// best-effort dual-write (features/mindmate/persistence/chat-store.ts persistExchange)
// is allowed to leave the device ONLY when this is true. Default is OFF (opt-in):
// nothing about a conversation is written until the person turns it on (App Store
// Guideline 5.1.1 — data-collection consent). With consent OFF the chat is exactly
// as ephemeral as it was before this gate existed.
//
// DELIBERATELY SEPARATE from lib/persistence/sync-consent.ts (the check-in cloud-
// backup gate, SR-4/ADR-001): that is a different lane with its own schema; folding
// chat consent into it would couple two unrelated privacy gates. Same SHAPE, own key.
//
// `migrate()` is the pure SR-13 unit; `loadChatConsent(storage)` is the DI-style read;
// the pure `getChatPersistConsent()` is the non-React gate consumed by the writer.

import { storage } from '@/lib/adapters/storage';
import type { Storage } from '@/lib/adapters/storage';

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'mobile:mindmate-consent';

export interface ChatConsentState {
  readonly version: number;
  readonly chatPersistConsent: boolean;
}

function seed(): ChatConsentState {
  // Default OFF — explicit opt-in. No conversation leaves the device until consented.
  return { version: SCHEMA_VERSION, chatPersistConsent: false };
}

/**
 * Parse + migrate the raw persisted JSON into the current schema.
 * - null / parse failure / non-object / missing version / future version → seed (OFF).
 * - matching version → pass-through (consent normalized to a strict boolean).
 */
export function migrate(rawJson: string | null): ChatConsentState {
  if (rawJson === null) return seed();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return seed();
  }

  if (typeof parsed !== 'object' || parsed === null) return seed();

  const e = parsed as { version?: unknown; chatPersistConsent?: unknown };
  if (typeof e.version !== 'number') return seed();
  if (e.version !== SCHEMA_VERSION) return seed();

  return { version: SCHEMA_VERSION, chatPersistConsent: e.chatPersistConsent === true };
}

/** DI-style read → migrate → write-back-if-needed (mirrors loadSyncConsent). */
export function loadChatConsent(s: Storage): ChatConsentState {
  const raw = s.get(STORAGE_KEY);
  const state = migrate(raw);
  if (raw === null || raw !== JSON.stringify(state)) {
    s.set(STORAGE_KEY, JSON.stringify(state));
  }
  return state;
}

// ── reactive singleton layer (useSyncExternalStore-compatible) ───────────────

let cache: ChatConsentState | null = null;
const listeners = new Set<() => void>();

function ensureLoaded(): ChatConsentState {
  if (cache === null) cache = loadChatConsent(storage);
  return cache;
}

function write(next: ChatConsentState): void {
  cache = next;
  storage.set(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

/** Current snapshot (stable identity until a setter runs — safe for useSyncExternalStore). */
export function getChatConsentSnapshot(): ChatConsentState {
  return ensureLoaded();
}

export function subscribeChatConsent(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setChatPersistConsent(on: boolean): void {
  write({ ...ensureLoaded(), chatPersistConsent: on });
}

/** Pure read for the write gate (no React) — the user's conversation-save consent. */
export function getChatPersistConsent(): boolean {
  return ensureLoaded().chatPersistConsent;
}

/**
 * Drop the in-memory cache and re-notify subscribers so the next read
 * re-hydrates from disk. Used after a disk wipe (S48 delete / privacy clear)
 * so a stale cache can't keep serving — or re-persist — deleted data (PR-013).
 */
export function reloadChatConsentFromDisk(): void {
  cache = null;
  for (const listener of listeners) listener();
}

/** Test seam: drop the in-memory cache + listeners so a fresh-storage test re-hydrates. */
export function __resetChatConsentCacheForTests(): void {
  cache = null;
  listeners.clear();
}
