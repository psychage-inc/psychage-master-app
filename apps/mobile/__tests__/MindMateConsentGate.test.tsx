import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Component, type ReactNode } from 'react';
import { Linking } from 'react-native';

// Compliance item 5 — the MindMate consent gate, re-consent, 403 CONSENT_REQUIRED
// handoff and the session greeting. Consent RPCs are a fake MindMateConsentApi.

jest.mock('@/features/offline/useIsOnline', () => ({ useIsOnline: jest.fn(() => true) }));

let mockSession: { userId: string } | null = null;
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ session: mockSession }),
}));

import { MindMateView } from '@/features/mindmate/components/MindMateView';
import type { MindMateConsentApi, MindMateConsentStatus } from '@/features/mindmate/consent-api';
import {
  MINDMATE_CONSENT_COPY,
  MINDMATE_HEALTH_DATA_POLICY_URL,
  MINDMATE_SESSION_GREETING,
} from '@/features/mindmate/consent-copy';
import { ConsentRequiredError } from '@/features/mindmate/errors';
import { clearLocalMindMateConversations } from '@/features/mindmate/local-conversation';
import type { sendMessage } from '@/features/mindmate/mindmate-service';

import { renderWithProviders } from './_helpers';

type FakeApi = { [K in keyof MindMateConsentApi]: jest.Mock } & { status: MindMateConsentStatus };

function fakeApi(initial: MindMateConsentStatus): FakeApi {
  const api: FakeApi = {
    status: initial,
    getStatus: jest.fn(async (): Promise<MindMateConsentStatus> => api.status),
    grant: jest.fn(async () => {
      api.status = 'current';
    }),
    withdraw: jest.fn(async () => {
      api.status = 'none';
    }),
    deleteConversations: jest.fn(async () => {}),
  };
  return api;
}

const reply = (text: string) =>
  (async function* () {
    yield text;
  }) as unknown as typeof sendMessage;

function render(
  api: FakeApi,
  props: Partial<Parameters<typeof MindMateView>[0]> = {},
) {
  return renderWithProviders(
    <MindMateView
      region="US"
      sendImpl={reply('ok')}
      persistImpl={async () => null}
      getConsentApi={() => api}
      onBack={jest.fn()}
      onRequestCrisis={jest.fn()}
      {...props}
    />,
    { haptics: true },
  );
}

class Boundary extends Component<{ children: ReactNode; onError: (e: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

describe('MindMate consent gate (item 5)', () => {
  beforeEach(() => {
    mockSession = { userId: 'u1' };
  });

  it("status 'none': shows the consent text word for word, nothing pre-ticked, no chat", async () => {
    render(fakeApi('none'));
    await waitFor(() => expect(screen.getByTestId('mindmate-consent-screen')).toBeTruthy());

    expect(screen.getByText('Before you use MindMate')).toBeTruthy();
    expect(
      screen.getByText(
        'MindMate is an AI system, not a person, therapist, or clinician. It explains mental health topics for education. It cannot diagnose, treat, or give medical advice.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Your messages may include health information. When you send a message:'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'It goes to Anthropic, an AI company in the United States, which processes it for Psychage only. Anthropic does not use your messages to train its models and deletes them within 30 days, except messages flagged for a safety review, which it may keep longer.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'When AI Chat History is on, Psychage stores the conversation in your account until you delete it.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Psychage never sells your messages or uses them for advertising.')).toBeTruthy();
    expect(
      screen.getByText(
        'You can withdraw this consent and delete your conversations at any time in Settings > Privacy > MindMate.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Read the Consumer Health Data Privacy Policy')).toBeTruthy();
    expect(screen.getByText('I agree to MindMate processing my messages')).toBeTruthy();
    expect(screen.getByText('Not now')).toBeTruthy();

    // Nothing pre-ticked: no switch, no checkbox anywhere on the consent screen.
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    // No chat before consent.
    expect(screen.queryByTestId('mindmate-input')).toBeNull();
    expect(screen.queryByTestId('mindmate-message-list')).toBeNull();
  });

  it('agree records consent, then opens the chat', async () => {
    const api = fakeApi('none');
    render(api);
    await waitFor(() => expect(screen.getByTestId('mindmate-consent-agree')).toBeTruthy());

    fireEvent.press(screen.getByTestId('mindmate-consent-agree'));

    await waitFor(() => expect(screen.getByTestId('mindmate-input')).toBeTruthy());
    expect(api.grant).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('mindmate-consent-screen')).toBeNull();
  });

  it('Not now leaves MindMate and records nothing', async () => {
    const api = fakeApi('none');
    const onBack = jest.fn();
    render(api, { onBack });
    await waitFor(() => expect(screen.getByTestId('mindmate-consent-not-now')).toBeTruthy());

    fireEvent.press(screen.getByTestId('mindmate-consent-not-now'));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(api.grant).not.toHaveBeenCalled();
    expect(api.withdraw).not.toHaveBeenCalled();
  });

  it('the policy link opens the Consumer Health Data Privacy Policy', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(fakeApi('none'));
    await waitFor(() => expect(screen.getByTestId('mindmate-consent-policy-link')).toBeTruthy());

    fireEvent.press(screen.getByTestId('mindmate-consent-policy-link'));

    expect(openURL).toHaveBeenCalledWith('https://www.psychage.com/legal/privacy#health-data');
    expect(MINDMATE_HEALTH_DATA_POLICY_URL).toBe('https://www.psychage.com/legal/privacy#health-data');
    openURL.mockRestore();
  });

  it('a failed grant is shown and keeps the user on the consent screen', async () => {
    const api = fakeApi('none');
    api.grant.mockRejectedValueOnce(new Error('grant_mindmate_consent failed'));
    render(api);
    await waitFor(() => expect(screen.getByTestId('mindmate-consent-agree')).toBeTruthy());

    fireEvent.press(screen.getByTestId('mindmate-consent-agree'));

    await waitFor(() => expect(screen.getByTestId('mindmate-consent-error')).toBeTruthy());
    expect(screen.getByTestId('mindmate-consent-screen')).toBeTruthy();
    expect(screen.queryByTestId('mindmate-input')).toBeNull();
  });

  it('a status load error shows Retry and no chat; Retry re-checks', async () => {
    const api = fakeApi('current');
    api.getStatus.mockRejectedValueOnce(new Error('network'));
    render(api);

    await waitFor(() => expect(screen.getByTestId('mindmate-consent-load-error')).toBeTruthy());
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.queryByTestId('mindmate-input')).toBeNull();

    fireEvent.press(screen.getByTestId('mindmate-consent-retry'));

    await waitFor(() => expect(screen.getByTestId('mindmate-input')).toBeTruthy());
    expect(api.getStatus).toHaveBeenCalledTimes(2);
  });

  it("status 'current' goes straight to the chat (no consent screen)", async () => {
    render(fakeApi('current'));
    await waitFor(() => expect(screen.getByTestId('mindmate-input')).toBeTruthy());
    expect(screen.queryByTestId('mindmate-consent-screen')).toBeNull();
  });

  it('signed out: no consent RPC runs (it needs a session)', () => {
    mockSession = null;
    const api = fakeApi('none');
    render(api);
    expect(api.getStatus).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mindmate-consent-screen')).toBeNull();
  });
});

describe('MindMate re-consent (item 5)', () => {
  beforeEach(() => {
    mockSession = { userId: 'u1' };
  });

  it("status 'outdated': shows the re-consent prompt; Review and agree opens the consent screen", async () => {
    const api = fakeApi('outdated');
    render(api, { consentChangeSummary: 'MindMate now keeps fewer messages.' });

    await waitFor(() => expect(screen.getByTestId('mindmate-reconsent-screen')).toBeTruthy());
    expect(
      screen.getByText(
        'MindMate has changed how it handles your messages. MindMate now keeps fewer messages. Please review and agree again to keep using MindMate.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('MindMate has changed how it handles your messages.')).toBeTruthy();

    fireEvent.press(screen.getByText('Review and agree'));
    expect(screen.getByText(MINDMATE_CONSENT_COPY.title)).toBeTruthy();

    fireEvent.press(screen.getByTestId('mindmate-consent-agree'));
    await waitFor(() => expect(screen.getByTestId('mindmate-input')).toBeTruthy());
    expect(api.grant).toHaveBeenCalledTimes(1);
  });

  it('Turn off MindMate withdraws consent and leaves', async () => {
    const api = fakeApi('outdated');
    const onBack = jest.fn();
    render(api, { consentChangeSummary: 'Summary.', onBack });
    await waitFor(() => expect(screen.getByTestId('mindmate-reconsent-turn-off')).toBeTruthy());

    fireEvent.press(screen.getByText('Turn off MindMate'));

    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(api.withdraw).toHaveBeenCalledTimes(1);
    expect(api.grant).not.toHaveBeenCalled();
  });

  it('outdated with no change summary throws (fail fast)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const onError = jest.fn();
    renderWithProviders(
      <Boundary onError={onError}>
        <MindMateView
          region="US"
          sendImpl={reply('ok')}
          getConsentApi={() => fakeApi('outdated')}
          consentChangeSummary={null}
        />
      </Boundary>,
      { haptics: true },
    );
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0].message).toMatch(/MINDMATE_CONSENT_CHANGE_SUMMARY is null/);
    (console.error as jest.Mock).mockRestore();
  });
});

describe('403 CONSENT_REQUIRED (item 5)', () => {
  beforeEach(() => {
    mockSession = { userId: 'u1' };
  });

  it('returns to the consent flow and keeps the unsent message in the input', async () => {
    const api = fakeApi('current');
    let calls = 0;
    const sendImpl = (async function* () {
      calls += 1;
      if (calls === 1) {
        api.status = 'none'; // the server's view: consent was withdrawn elsewhere
        throw new ConsentRequiredError();
      }
      yield 'Anxiety is a common experience.';
    }) as unknown as typeof sendMessage;

    render(api, { sendImpl });
    await waitFor(() => expect(screen.getByTestId('mindmate-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('mindmate-input'), 'what is anxiety');
    fireEvent.press(screen.getByTestId('mindmate-send'));

    // Status re-checked → consent screen.
    await waitFor(() => expect(screen.getByTestId('mindmate-consent-screen')).toBeTruthy());
    expect(api.getStatus).toHaveBeenCalledTimes(2);

    fireEvent.press(screen.getByTestId('mindmate-consent-agree'));
    await waitFor(() => expect(screen.getByTestId('mindmate-input')).toBeTruthy());

    // The refused text is back in the composer, not in the transcript.
    expect(screen.getByTestId('mindmate-input').props.value).toBe('what is anxiety');
    expect(screen.queryByText('what is anxiety')).toBeNull();
    expect(calls).toBe(1);
  });
});

describe('MindMate session greeting (item 5)', () => {
  beforeEach(() => {
    mockSession = null;
  });

  it('opens every session with the greeting and a Help Now control to the crisis route', async () => {
    const onRequestCrisis = jest.fn();
    render(fakeApi('current'), { onRequestCrisis });

    expect(
      screen.getByText(
        "Hi, I'm MindMate, an AI guide to mental health topics. I'm not a therapist and I can't diagnose or treat. If you're in crisis, tap Help Now or call or text 988.",
      ),
    ).toBeTruthy();
    expect(MINDMATE_SESSION_GREETING).toContain('988');

    fireEvent.press(screen.getByLabelText('Help Now'));
    expect(onRequestCrisis).toHaveBeenCalledTimes(1);

    // Still the first row after the conversation starts.
    fireEvent.changeText(screen.getByTestId('mindmate-input'), 'what is sleep hygiene');
    fireEvent.press(screen.getByTestId('mindmate-send'));
    await waitFor(() => expect(screen.getByText('ok')).toBeTruthy());
    expect(screen.getByTestId('mindmate-greeting')).toBeTruthy();
  });
});

describe('local MindMate copy clearing (items 6 + 8)', () => {
  beforeEach(() => {
    mockSession = null;
  });

  it('clearLocalMindMateConversations wipes the mounted transcript', async () => {
    render(fakeApi('current'));
    fireEvent.changeText(screen.getByTestId('mindmate-input'), 'what is sleep hygiene');
    fireEvent.press(screen.getByTestId('mindmate-send'));
    await waitFor(() => expect(screen.getByText('what is sleep hygiene')).toBeTruthy());

    act(() => clearLocalMindMateConversations());

    expect(screen.queryByText('what is sleep hygiene')).toBeNull();
    expect(screen.queryByText('ok')).toBeNull();
  });
});
