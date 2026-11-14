import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

// Settings > Privacy > MindMate (item 6, mobile half).

let mockSession: { userId: string } | null = { userId: 'u1' };
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ session: mockSession }),
}));

import { MindMatePrivacySection } from '@/features/mindmate/components/MindMatePrivacySection';
import type { MindMateConsentApi, MindMateConsentStatus } from '@/features/mindmate/consent-api';
import { subscribeLocalMindMateClear } from '@/features/mindmate/local-conversation';

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

const BODY =
  'Turning this off stops MindMate from sending your messages to Anthropic. You can also delete all MindMate conversations. Deletion removes them from Psychage within 30 days, including backups. Anthropic deletes any copy automatically within 30 days.';

function render(api: FakeApi) {
  return renderWithProviders(<MindMatePrivacySection getConsentApi={() => api} />, { haptics: true });
}

// Press the destructive button of the most recent Alert.alert call.
function confirmAlert(alertSpy: jest.SpyInstance) {
  const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2] as AlertButton[];
  const destructive = buttons.find((b) => b.style === 'destructive');
  if (!destructive?.onPress) throw new Error('no destructive button');
  destructive.onPress();
}

describe('Settings > Privacy > MindMate', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    mockSession = { userId: 'u1' };
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("consent 'current' reads On; text and buttons word for word", async () => {
    render(fakeApi('current'));
    await waitFor(() => expect(screen.getByText('MindMate consent: On')).toBeTruthy());
    expect(screen.getByText(BODY)).toBeTruthy();
    expect(screen.getByText('Turn off MindMate')).toBeTruthy();
    expect(screen.getByText('Delete all conversations')).toBeTruthy();
    expect(screen.getByTestId('mindmate-privacy-toggle').props.value).toBe(true);
  });

  it.each(['none', 'outdated'] as const)("consent '%s' reads Off and cannot be switched on here", async (status) => {
    const api = fakeApi(status);
    render(api);
    await waitFor(() => expect(screen.getByText('MindMate consent: Off')).toBeTruthy());
    const toggle = screen.getByTestId('mindmate-privacy-toggle');
    expect(toggle.props.value).toBe(false);
    expect(toggle.props.disabled).toBe(true);

    // Even a forced ON transition does nothing — turning on is the consent screen's job.
    fireEvent(toggle, 'valueChange', true);
    expect(api.grant).not.toHaveBeenCalled();
    expect(api.withdraw).not.toHaveBeenCalled();
  });

  it('the toggle turns consent off (withdraw), then reads Off', async () => {
    const api = fakeApi('current');
    render(api);
    await waitFor(() => expect(screen.getByText('MindMate consent: On')).toBeTruthy());

    fireEvent(screen.getByTestId('mindmate-privacy-toggle'), 'valueChange', false);

    await waitFor(() => expect(screen.getByText('MindMate consent: Off')).toBeTruthy());
    expect(api.withdraw).toHaveBeenCalledTimes(1);
  });

  it('Turn off MindMate withdraws, then reads Off', async () => {
    const api = fakeApi('current');
    render(api);
    await waitFor(() => expect(screen.getByText('MindMate consent: On')).toBeTruthy());

    fireEvent.press(screen.getByTestId('mindmate-privacy-turn-off'));

    await waitFor(() => expect(screen.getByText('MindMate consent: Off')).toBeTruthy());
    expect(api.withdraw).toHaveBeenCalledTimes(1);
  });

  it('a failed withdraw is shown, consent stays On', async () => {
    const api = fakeApi('current');
    api.withdraw.mockRejectedValueOnce(new Error('withdraw_mindmate_consent failed'));
    render(api);
    await waitFor(() => expect(screen.getByText('MindMate consent: On')).toBeTruthy());

    fireEvent.press(screen.getByTestId('mindmate-privacy-turn-off'));

    await waitFor(() => expect(screen.getByTestId('mindmate-privacy-error')).toBeTruthy());
    expect(screen.getByText('MindMate consent: On')).toBeTruthy();
  });

  it('Delete all conversations confirms, deletes server copies and clears the local copy', async () => {
    const api = fakeApi('current');
    const onLocalClear = jest.fn();
    const unsubscribe = subscribeLocalMindMateClear(onLocalClear);
    render(api);
    await waitFor(() => expect(screen.getByText('Delete all conversations')).toBeTruthy());

    fireEvent.press(screen.getByTestId('mindmate-privacy-delete-all'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('Delete all conversations');
    // Nothing deleted until the user confirms.
    expect(api.deleteConversations).not.toHaveBeenCalled();

    await act(async () => confirmAlert(alertSpy));

    await waitFor(() => expect(screen.getByTestId('mindmate-privacy-deleted')).toBeTruthy());
    expect(api.deleteConversations).toHaveBeenCalledTimes(1);
    expect(onLocalClear).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('a failed delete is shown and the local copy is left alone', async () => {
    const api = fakeApi('current');
    api.deleteConversations.mockRejectedValueOnce(new Error('delete_mindmate_conversations failed'));
    const onLocalClear = jest.fn();
    const unsubscribe = subscribeLocalMindMateClear(onLocalClear);
    render(api);
    await waitFor(() => expect(screen.getByText('Delete all conversations')).toBeTruthy());

    fireEvent.press(screen.getByTestId('mindmate-privacy-delete-all'));
    await act(async () => confirmAlert(alertSpy));

    await waitFor(() => expect(screen.getByTestId('mindmate-privacy-error')).toBeTruthy());
    expect(screen.queryByTestId('mindmate-privacy-deleted')).toBeNull();
    expect(onLocalClear).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('a status load error is shown with Retry', async () => {
    const api = fakeApi('current');
    api.getStatus.mockRejectedValueOnce(new Error('network'));
    render(api);

    await waitFor(() => expect(screen.getByTestId('mindmate-privacy-load-error')).toBeTruthy());
    fireEvent.press(screen.getByTestId('mindmate-privacy-retry'));
    await waitFor(() => expect(screen.getByText('MindMate consent: On')).toBeTruthy());
  });

  it('signed out: no RPC runs', () => {
    mockSession = null;
    const api = fakeApi('current');
    render(api);
    expect(api.getStatus).not.toHaveBeenCalled();
    expect(screen.getByText('Sign in to manage MindMate consent.')).toBeTruthy();
  });
});
