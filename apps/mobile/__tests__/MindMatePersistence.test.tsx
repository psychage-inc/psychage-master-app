import { fireEvent, screen, waitFor } from '@testing-library/react-native';

// MindMateView reads live connectivity for its status strip (PR-070) — mock the
// seam so the real NetInfo native module never loads under jest.
jest.mock('@/features/offline/useIsOnline', () => ({ useIsOnline: jest.fn(() => true) }));

import { MindMateView } from '@/features/mindmate/components/MindMateView';
import type { persistExchange } from '@/features/mindmate/persistence/chat-store';
import type { sendMessage } from '@/features/mindmate/mindmate-service';
import type { ChatTurnMeta } from '@/features/mindmate/types';

import { renderWithProviders } from './_helpers';

// A streaming impl that yields two tokens then reports a SAFE turn meta.
function streamSafe(meta: Partial<ChatTurnMeta> = {}) {
  return (async function* (
    _input: unknown,
    onMeta: (m: ChatTurnMeta) => void,
  ): AsyncGenerator<string> {
    yield 'Anxiety ';
    yield 'is common.';
    onMeta({ citations: [], safetyLevel: 'SAFE', isCrisis: false, sessionId: 's1', ...meta });
  }) as unknown as typeof sendMessage;
}

describe('MindMate persistence wiring', () => {
  it('persists a completed exchange after a successful turn', async () => {
    const persistImpl = jest.fn(async () => 'conv-1') as unknown as typeof persistExchange;

    renderWithProviders(
      <MindMateView region="US" sendImpl={streamSafe()} persistImpl={persistImpl} />,
      { haptics: true },
    );

    fireEvent.changeText(screen.getByTestId('mindmate-input'), 'what is anxiety');
    fireEvent.press(screen.getByTestId('mindmate-send'));

    await waitFor(() => expect(persistImpl).toHaveBeenCalledTimes(1));
    expect(persistImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        userContent: 'what is anxiety',
        assistantContent: 'Anxiety is common.',
        safetyLevel: 'SAFE',
        conversationId: null,
      }),
    );
  });

  it('NEVER persists a crisis turn (client pre-check short-circuits the send)', async () => {
    const persistImpl = jest.fn(async () => null) as unknown as typeof persistExchange;
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

    fireEvent.changeText(screen.getByTestId('mindmate-input'), 'I want to kill myself');
    fireEvent.press(screen.getByTestId('mindmate-send'));

    await waitFor(() => expect(screen.getByTestId('mindmate-crisis-card')).toBeTruthy());
    expect(persistImpl).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
