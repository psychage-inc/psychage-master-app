// The only on-device copy of a MindMate conversation is the in-memory transcript held
// by a mounted useMindMateChat (messages are never written to MMKV / secure-store).
// This signal lets Settings > Privacy > MindMate "Delete all conversations" and
// account deletion clear that copy too — a MindMate screen still mounted under the
// settings stack must not keep showing (or keep appending to) a deleted conversation.

const listeners = new Set<() => void>();

/** Clear every mounted MindMate transcript (and its server conversation link). */
export function clearLocalMindMateConversations(): void {
  for (const listener of listeners) listener();
}

export function subscribeLocalMindMateClear(onClear: () => void): () => void {
  listeners.add(onClear);
  return () => {
    listeners.delete(onClear);
  };
}
