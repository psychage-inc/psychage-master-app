import { FlashList } from '@shopify/flash-list';
import { useMemo } from 'react';
import { View } from 'react-native';

import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import { MindMateIntro } from './MindMateIntro';

// FlashList per the stack rule (any list >20 items) — a conversation grows past
// that. v2 auto-sizes, so no estimatedItemSize. The intro (mascot + session greeting
// + Help Now) is always the oldest row, so every session starts with the greeting and
// it scrolls with the conversation.
//
// getItemType keys the recycle pool by role (D-01, SR-2). User and assistant bubbles
// carry different NativeWind style sets (the assistant bubble's `shadow-sm` sets CSS
// variables; the user bubble sets none). Without per-role pools FlashList reuses a
// user cell for an assistant row whenever the older user bubble is off-screen and a
// lone user message is prepended — which is exactly the crisis path (no assistant
// placeholder). css-interop then has to upgrade an already-mounted View, and its
// dev-only upgrade warning throws while serialising the props ("Couldn't find a
// navigation context") — inside the very render that should have shown the crisis
// card. Per-role pools mean a cell never changes role, so no post-mount upgrade. The
// greeting row has its own pool for the same reason.

type Row = { kind: 'greeting' } | { kind: 'message'; message: ChatMessage };

const GREETING_ROW: Row = { kind: 'greeting' };

export function MessageList({
  messages,
  onHelpNow,
}: {
  messages: ChatMessage[];
  /** The greeting's Help Now control — opens the crisis route. */
  onHelpNow: () => void;
}) {
  // FlashList inverted renders bottom-up. We reverse so newest is at index 0; the
  // greeting goes last (= visually first).
  const rows = useMemo<Row[]>(
    () => [
      ...[...messages].reverse().map((message): Row => ({ kind: 'message', message })),
      GREETING_ROW,
    ],
    [messages],
  );

  return (
    <View className="flex-1" style={{ transform: [{ scaleY: -1 }] }}>
      <FlashList
        data={rows}
        contentContainerStyle={{ paddingVertical: 16 }}
        keyExtractor={(r) => (r.kind === 'greeting' ? 'mm-greeting' : r.message.id)}
        getItemType={(r) => (r.kind === 'greeting' ? 'greeting' : r.message.role)}
        renderItem={({ item }) => (
          <View style={{ transform: [{ scaleY: -1 }] }}>
            {item.kind === 'greeting' ? (
              <MindMateIntro onHelpNow={onHelpNow} />
            ) : (
              <MessageBubble message={item.message} />
            )}
          </View>
        )}
        keyboardShouldPersistTaps="handled"
        testID="mindmate-message-list"
      />
    </View>
  );
}
