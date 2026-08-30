import { Component, type ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';

import { MINDMATE_COPY } from '../copy';

// D-01 / SR-2 fail-safe. Isolates a render failure inside the message list so the rest
// of the screen — the header's Help-now pill, the inline CrisisCard and the composer —
// stays mounted. Without this, any throw in the list climbs to the root ErrorBoundary,
// which replaces the whole app with "Something went wrong" and no crisis affordance.
// Deliberately minimal: no retry, no logging (rule 11 — the error message could carry
// message text), and used for this one path only. Class component because React only
// exposes render-error capture through getDerivedStateFromError.

type Props = { readonly children: ReactNode };
type State = { readonly failed: boolean };

export class MessageListBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <View className="flex-1 items-center justify-center px-6" testID="mindmate-list-fallback">
          <Text
            variant="caption"
            className="text-center text-text-secondary dark:text-text-secondary-dark"
          >
            {MINDMATE_COPY.listFallback}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}
