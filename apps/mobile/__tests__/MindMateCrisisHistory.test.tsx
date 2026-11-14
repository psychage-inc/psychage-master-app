import { fireEvent, screen, waitFor } from '@testing-library/react-native';

// Item 6 regression: a user message the server (or the client pre-check) answered as a
// crisis must never be sent back in the history of later turns — neither the flagged
// user message nor the crisis reply. Also confirms the client renders the server's
// crisis text for an isCrisis response.

jest.mock('@/features/offline/useIsOnline', () => ({ useIsOnline: jest.fn(() => true) }));

import { MindMateView } from '@/features/mindmate/components/MindMateView';
import type { SendMessageInput, sendMessage } from '@/features/mindmate/mindmate-service';
import type { ChatTurnMeta } from '@/features/mindmate/types';

import { renderWithProviders } from './_helpers';

const SERVER_CRISIS_TEXT = 'You deserve support right now. You can call or text 988.';

// Records every payload; the turn whose last user message is in `crisisTurns` is
// answered the way the server answers a crisis (JSON isCrisis → meta CRISIS + text).
function recordingSend(crisisTurns: string[]) {
  const inputs: SendMessageInput[] = [];
  const impl = (async function* (input: SendMessageInput, onMeta: (m: ChatTurnMeta) => void) {
    inputs.push(input);
    const last = input.messages[input.messages.length - 1]?.content ?? '';
    if (crisisTurns.includes(last)) {
      onMeta({ citations: [], safetyLevel: 'CRISIS', isCrisis: true, sessionId: 's1' });
      yield SERVER_CRISIS_TEXT;
      return;
    }
    yield `reply to ${last}`;
    onMeta({ citations: [], safetyLevel: 'SAFE', isCrisis: false, sessionId: 's1' });
  }) as unknown as typeof sendMessage;
  return { impl, inputs };
}

function say(text: string) {
  fireEvent.changeText(screen.getByTestId('mindmate-input'), text);
  fireEvent.press(screen.getByTestId('mindmate-send'));
}

describe('MindMate crisis-flagged messages stay out of later history (item 6)', () => {
  it('server crisis verdict: shows the server crisis text; neither side is resent', async () => {
    const { impl, inputs } = recordingSend(['everything feels pointless lately']);
    renderWithProviders(
      <MindMateView region="US" sendImpl={impl} persistImpl={async () => null} onRequestCrisis={jest.fn()} />,
      { haptics: true },
    );

    say('what is anxiety');
    await waitFor(() => expect(screen.getByText('reply to what is anxiety')).toBeTruthy());

    say('everything feels pointless lately');
    // The client renders the server's crisis copy verbatim, with the crisis card.
    await waitFor(() => expect(screen.getByText(SERVER_CRISIS_TEXT)).toBeTruthy());
    expect(screen.getByTestId('mindmate-crisis-card')).toBeTruthy();

    say('what helps with sleep');
    await waitFor(() => expect(screen.getByText('reply to what helps with sleep')).toBeTruthy());

    expect(inputs).toHaveLength(3);
    expect(inputs[2]?.messages).toEqual([
      { role: 'user', content: 'what is anxiety' },
      { role: 'assistant', content: 'reply to what is anxiety' },
      { role: 'user', content: 'what helps with sleep' },
    ]);
  });

  it('client pre-check crisis: the flagged message is never sent on a later turn', async () => {
    const { impl, inputs } = recordingSend([]);
    renderWithProviders(
      <MindMateView region="US" sendImpl={impl} persistImpl={async () => null} onRequestCrisis={jest.fn()} />,
      { haptics: true },
    );

    say('I want to kill myself');
    await waitFor(() => expect(screen.getByTestId('mindmate-crisis-card')).toBeTruthy());
    expect(inputs).toHaveLength(0);

    say('what helps with sleep');
    await waitFor(() => expect(screen.getByText('reply to what helps with sleep')).toBeTruthy());

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.messages).toEqual([{ role: 'user', content: 'what helps with sleep' }]);
  });
});
