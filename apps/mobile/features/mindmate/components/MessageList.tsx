import { FlashList } from '@shopify/flash-list';
import { useMemo } from 'react';
import { View } from 'react-native';

import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import { MindMateIntro } from './MindMateIntro';

// FlashList per the stack rule (any list >20 items) — a conversation grows past
// that. v2 auto-sizes, so no estimatedItemSize. The intro is the empty state.
//
// getItemType keys the recycle pool by role (D-01, SR-2). User and assistant bubbles
// carry different NativeWind style sets (the assistant bubble's `shadow-sm` sets CSS
// variables; the user bubble sets none). Without per-role pools FlashList reuses a
// user cell for an assistant row whenever the older user bubble is off-screen and a
// lone user message is prepended — which is exactly the crisis path (no assistant
// placeholder). css-interop then has to upgrade an already-mounted View, and its
// dev-only upgrade warning throws while serialising the props ("Couldn't find a
// navigation context") — inside the very render that should have shown the crisis
// card. Per-role pools mean a cell never changes role, so no post-mount upgrade.
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  // FlashList inverted renders bottom-up. We reverse the array so newest is at index 0.
  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <View className="flex-1" style={{ transform: [{ scaleY: -1 }] }}>
      <FlashList
        data={displayMessages}
        contentContainerStyle={{ paddingVertical: 16 }}
        keyExtractor={(m) => m.id}
        getItemType={(m) => m.role}
        renderItem={({ item }) => (
          <View style={{ transform: [{ scaleY: -1 }] }}>
            <MessageBubble message={item} />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ transform: [{ scaleY: -1 }] }}>
            <MindMateIntro />
          </View>
        }
        keyboardShouldPersistTaps="handled"
        testID="mindmate-message-list"
      />
    </View>
  );
}
