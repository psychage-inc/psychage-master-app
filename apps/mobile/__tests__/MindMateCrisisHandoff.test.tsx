import { fireEvent, screen, waitFor } from '@testing-library/react-native';

// D-01 regression suite (SR-2 delivery). A person who types crisis language into
// MindMate must reach crisis resources — with the chat still standing — no matter
// what else on the screen fails. Each test below removes one link in the chain and
// asserts the handoff still lands. Nothing here touches detection: `precheckCrisis`
// and the server verdict are consumed exactly as shipped.

// The status strip reads live connectivity; NetInfo has no native binding under jest.
jest.mock('@/features/offline/useIsOnline', () => ({ useIsOnline: jest.fn(() => true) }));

// Simulates the field failure: the message list throws while rendering the very turn
// that carries the crisis state (in the wild: FlashList recycled a user cell into the
// assistant bubble and NativeWind's dev-only upgrade warning threw mid-render). The
// mock throws for the crisis message only, so earlier turns render normally.
jest.mock('@/features/mindmate/components/MessageBubble', () => {
  const actual = jest.requireActual('@/features/mindmate/components/MessageBubble');
  return {
    ...actual,
    // Invoked as a plain function inside this wrapper's render (its hooks attach to the
    // wrapper), which keeps the factory free of createElement — the NativeWind babel
    // preset rewrites that to an out-of-scope import jest-hoist rejects.
    MessageBubble: (props: { message: { content: string } }) => {
      if (props.message.content === 'I want to kill myself') {
        throw new Error('simulated message-list render failure');
      }
      return actual.MessageBubble(props);
    },
  };
});

import { MessageList } from '@/features/mindmate/components/MessageList';
import { MindMateView } from '@/features/mindmate/components/MindMateView';
import type { sendMessage } from '@/features/mindmate/mindmate-service';
import type { persistExchange } from '@/features/mindmate/persistence/chat-store';
import type { ChatMessage, ChatTurnMeta } from '@/features/mindmate/types';

import { renderWithProviders } from './_helpers';

const CRISIS_TEXT = 'I want to kill myself';

function sendCrisisMessage() {
  fireEvent.changeText(screen.getByTestId('mindmate-input'), CRISIS_TEXT);
  fireEvent.press(screen.getByTestId('mindmate-send'));
}

describe('MindMate crisis handoff (D-01 / SR-2)', () => {
  // React reports every error a boundary catches through console.error; the tests
  // below provoke those on purpose. Silence the noise, keep the assertions.
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('crisis surface stays reachable when the message list throws during render', async () => {
    const sendSpy = jest.fn() as unknown as typeof sendMessage;
    const onRequestCrisis = jest.fn();

    renderWithProviders(
      <MindMateView region="US" sendImpl={sendSpy} onRequestCrisis={onRequestCrisis} />,
      { haptics: true },
    );

    // The mocked bubble throws for this exact message — the list render fails.
    sendCrisisMessage();

    // Delivery still lands on all three fronts:
    //   1. navigation to /crisis was requested,
    await waitFor(() => expect(onRequestCrisis).toHaveBeenCalledTimes(1));
    //   2. the inline crisis card is on screen (hotline Call + Get crisis support),
    expect(screen.getByTestId('mindmate-crisis-card')).toBeTruthy();
    expect(screen.getByTestId('mindmate-crisis-cta')).toBeTruthy();
    //   3. the always-on Help-now pill is still mounted (screen did not fall over).
    expect(screen.getByLabelText('Help now')).toBeTruthy();
    // The failed list degrades to a calm placeholder instead of taking the screen down.
    expect(screen.getByTestId('mindmate-list-fallback')).toBeTruthy();
    // Detection short-circuited the backend as before.
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('a navigation failure still shows crisis resources', async () => {
    const sendSpy = jest.fn() as unknown as typeof sendMessage;
    const onRequestCrisis = jest.fn(() => {
      throw new Error('navigation unavailable');
    });

    renderWithProviders(
      <MindMateView region="US" sendImpl={sendSpy} onRequestCrisis={onRequestCrisis} />,
      { haptics: true },
    );

    // Must not throw out of the send handler.
    sendCrisisMessage();

    await waitFor(() => expect(onRequestCrisis).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('mindmate-crisis-card')).toBeTruthy();
    expect(screen.getByTestId('mindmate-crisis-call')).toBeTruthy();
    expect(screen.getByLabelText('Help now')).toBeTruthy();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('nothing from a crisis exchange is written to Supabase (client pre-check path)', async () => {
    const persistImpl = jest.fn(async () => 'conv-should-never-exist') as unknown as typeof persistExchange;
    const sendSpy = jest.fn() as unknown as typeof sendMessage;

    renderWithProviders(
      <MindMateView
        region="US"
        sendImpl={sendSpy}
        persistImpl={persistImpl}
        onRequestCrisis={jest.fn()}
      />,
      { haptics: true },
    );

    sendCrisisMessage();

    await waitFor(() => expect(screen.getByTestId('mindmate-crisis-card')).toBeTruthy());
    expect(persistImpl).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('nothing from a crisis exchange is written to Supabase (server CRISIS verdict path)', async () => {
    // A message the client pre-check does NOT catch, which the server then flags CRISIS.
    const serverCrisis = (async function* (
      _input: unknown,
      onMeta: (m: ChatTurnMeta) => void,
    ): AsyncGenerator<string> {
      onMeta({ citations: [], safetyLevel: 'CRISIS', isCrisis: true, sessionId: 's-crisis' });
      yield 'Trained people are ready to listen.';
    }) as unknown as typeof sendMessage;
    const persistImpl = jest.fn(async () => 'conv-should-never-exist') as unknown as typeof persistExchange;
    const onRequestCrisis = jest.fn();

    renderWithProviders(
      <MindMateView
        region="US"
        sendImpl={serverCrisis}
        persistImpl={persistImpl}
        onRequestCrisis={onRequestCrisis}
      />,
      { haptics: true },
    );

    fireEvent.changeText(screen.getByTestId('mindmate-input'), 'everything feels pointless lately');
    fireEvent.press(screen.getByTestId('mindmate-send'));

    await waitFor(() => expect(onRequestCrisis).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('mindmate-crisis-card')).toBeTruthy());
    // The turn completed (text streamed) — and still nothing was persisted.
    await waitFor(() => expect(screen.getByText('Trained people are ready to listen.')).toBeTruthy());
    expect(persistImpl).not.toHaveBeenCalled();
  });

  it('MessageList keys FlashList recycle pools by role so cells never change role', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hello' },
      { id: 'a1', role: 'assistant', content: 'Hi — what would you like to understand?' },
    ];
    renderWithProviders(<MessageList messages={messages} />, { haptics: true });

    // A user cell must never be recycled into an assistant row (and vice versa): the
    // two bubbles carry different NativeWind style sets, and a post-mount style upgrade
    // is what threw inside the crisis render in the field.
    expect(screen.getByTestId('flashlist-item-type:user')).toBeTruthy();
    expect(screen.getByTestId('flashlist-item-type:assistant')).toBeTruthy();
    expect(screen.queryByTestId('flashlist-item-type:default')).toBeNull();
  });
});
