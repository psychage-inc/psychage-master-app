import { fireEvent, screen, waitFor } from '@testing-library/react-native';

// The status strip reads real connectivity; NetInfo has no native binding under
// jest, so pin the seam (same pattern as WebViewSurface.test).
jest.mock('@/features/offline/useIsOnline', () => ({ useIsOnline: jest.fn(() => true) }));

import { MindMateView } from '@/features/mindmate/components/MindMateView';
import { MindMateUnavailableError } from '@/features/mindmate/errors';
import type { sendMessage } from '@/features/mindmate/mindmate-service';
import { useIsOnline } from '@/features/offline/useIsOnline';

import { renderWithProviders } from './_helpers';

const onlineMock = useIsOnline as unknown as jest.Mock;

// A sendImpl that fails as if no session exists (NO_SESSION) — drives the sign-in
// state. Throws on call; the hook's `for await` sits inside its try, so the throw
// is caught exactly like a rejected stream.
const failNoSession = (() => {
  throw new MindMateUnavailableError('Sign in to chat with MindMate.', { code: 'NO_SESSION' });
}) as unknown as typeof sendMessage;

describe('MindMateView', () => {
  beforeEach(() => {
    onlineMock.mockReturnValue(true);
  });

  it('status strip shows Online while connected', () => {
    const noop = jest.fn() as unknown as typeof sendMessage;
    renderWithProviders(<MindMateView region="US" sendImpl={noop} />, { haptics: true });
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.queryByText('Offline')).toBeNull();
  });

  it('status strip shows a calm Offline when the device is disconnected', () => {
    onlineMock.mockReturnValue(false);
    const noop = jest.fn() as unknown as typeof sendMessage;
    renderWithProviders(<MindMateView region="US" sendImpl={noop} />, { haptics: true });
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.queryByText('Online')).toBeNull();
  });

  it('renders the mascot-fronted intro before any message', () => {
    const noop = jest.fn() as unknown as typeof sendMessage;
    renderWithProviders(<MindMateView region="US" sendImpl={noop} />, { haptics: true });
    expect(screen.getByTestId('mindmate-intro')).toBeTruthy();
    // The mascot is decorative and accessibilityElementsHidden; RNTL excludes
    // hidden elements from queries by default, so opt in to assert it rendered.
    expect(screen.getByTestId('mindmate-mascot', { includeHiddenElements: true })).toBeTruthy();
  });

  it('SR-2: a crisis-style message routes to crisis and never calls the backend', async () => {
    const sendSpy = jest.fn() as unknown as typeof sendMessage;
    const onRequestCrisis = jest.fn();

    renderWithProviders(
      <MindMateView region="US" sendImpl={sendSpy} onRequestCrisis={onRequestCrisis} />,
      { haptics: true },
    );

    fireEvent.changeText(screen.getByTestId('mindmate-input'), 'I want to kill myself');
    fireEvent.press(screen.getByTestId('mindmate-send'));

    await waitFor(() => expect(onRequestCrisis).toHaveBeenCalled());
    expect(screen.getByTestId('mindmate-crisis-card')).toBeTruthy();
    // The crisis pre-check intercepts — the AI backend is not consulted for this turn.
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('shows the sign-in state when there is no session', async () => {
    renderWithProviders(<MindMateView region="US" sendImpl={failNoSession} onSignIn={jest.fn()} />, {
      haptics: true,
    });

    fireEvent.changeText(screen.getByTestId('mindmate-input'), 'what is anxiety');
    fireEvent.press(screen.getByTestId('mindmate-send'));

    await waitFor(() => expect(screen.getByTestId('mindmate-signin')).toBeTruthy());
  });

  it('P9: a transient failure shows a calm retry; Try again replays the turn without duplicating it', async () => {
    // First turn fails (transient backend error), the retry streams a reply. The throw
    // lives in the generator body so it surfaces during iteration — exactly like a
    // dropped stream — and is caught by the hook.
    let calls = 0;
    const flaky = (async function* () {
      calls += 1;
      if (calls === 1) throw new Error('network down');
      yield 'Anxiety is a common experience.';
    }) as unknown as typeof sendMessage;

    renderWithProviders(
      <MindMateView region="US" sendImpl={flaky} persistImpl={async () => null} />,
      { haptics: true },
    );

    fireEvent.changeText(screen.getByTestId('mindmate-input'), 'what is anxiety');
    fireEvent.press(screen.getByTestId('mindmate-send'));

    // Calm error with a retry affordance — not a dead screen, not the sign-in card.
    await waitFor(() => expect(screen.getByTestId('mindmate-retry')).toBeTruthy());
    expect(screen.queryByTestId('mindmate-signin')).toBeNull();

    fireEvent.press(screen.getByTestId('mindmate-retry'));

    // The reply streams in on retry and the error/retry clears.
    await waitFor(() =>
      expect(screen.getByText('Anxiety is a common experience.')).toBeTruthy(),
    );
    expect(screen.queryByTestId('mindmate-retry')).toBeNull();

    // Exactly one user message — retry replayed the same turn, it didn't append a new one.
    expect(screen.getAllByText('what is anxiety')).toHaveLength(1);
  });
});
