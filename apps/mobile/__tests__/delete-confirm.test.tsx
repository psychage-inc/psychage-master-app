import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
jest.mock('@/lib/moment-store', () => ({ resetMomentStore: jest.fn() }));
jest.mock('@/lib/persistence/account-deletion', () => ({
  requestRemoteAccountDeletion: jest.fn(() => Promise.resolve({ ok: true, deleted: true })),
  clearAuthSessionLocal: jest.fn(() => Promise.resolve()),
}));

import DeleteConfirmScreen from '@/app/settings/delete-confirm';
import { subscribeLocalMindMateClear } from '@/features/mindmate/local-conversation';
import { CT4_SETTINGS } from '@/features/settings/copy';
import { storage } from '@/lib/adapters/storage';
import { resetMomentStore } from '@/lib/moment-store';
import { clearAuthSessionLocal, requestRemoteAccountDeletion } from '@/lib/persistence/account-deletion';

import { renderWithProviders } from './_helpers';

const resetMock = resetMomentStore as jest.Mock;
const remoteMock = requestRemoteAccountDeletion as jest.Mock;
const clearMock = clearAuthSessionLocal as jest.Mock;

describe('S48 delete-confirm', () => {
  beforeEach(() => {
    resetMock.mockClear();
    remoteMock.mockClear();
    remoteMock.mockResolvedValue({ ok: true, deleted: true });
    clearMock.mockClear();
    (router.replace as jest.Mock).mockClear();
  });

  it('success: server cascade + local wipe + store reset + session cleared, then replaces route', async () => {
    storage.set('mobile:appearance', JSON.stringify({ version: 1, mode: 'night', reducedMotion: true }));
    renderWithProviders(<DeleteConfirmScreen />, { haptics: true });

    fireEvent.press(screen.getByTestId('destructive-action'));

    await waitFor(() => expect(router.replace as jest.Mock).toHaveBeenCalledWith('/'));
    expect(remoteMock).toHaveBeenCalledTimes(1); // server cascade attempted
    expect(storage.get('mobile:appearance')).toBeNull(); // LOCAL hard-immediate wipe
    expect(resetMock).toHaveBeenCalledTimes(1); // live-instance reset
    expect(clearMock).toHaveBeenCalledTimes(1); // dead session dropped on success
  });

  it('item 8: account deletion also clears the local MindMate transcript', async () => {
    const onLocalClear = jest.fn();
    const unsubscribe = subscribeLocalMindMateClear(onLocalClear);
    renderWithProviders(<DeleteConfirmScreen />, { haptics: true });

    fireEvent.press(screen.getByTestId('destructive-action'));

    await waitFor(() => expect(router.replace as jest.Mock).toHaveBeenCalledWith('/'));
    expect(remoteMock).toHaveBeenCalledTimes(1); // delete_account() cascade (account-deletion.ts)
    expect(onLocalClear).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('failure: surfaces that server data may remain; local still wiped; no silent navigate', async () => {
    remoteMock.mockResolvedValueOnce({ ok: false, reason: 'offline' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    storage.set('mobile:appearance', JSON.stringify({ version: 1, mode: 'night' }));
    renderWithProviders(<DeleteConfirmScreen />, { haptics: true });

    fireEvent.press(screen.getByTestId('destructive-action'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy).toHaveBeenCalledWith(
      CT4_SETTINGS.deleteConfirm.serverFailTitle,
      CT4_SETTINGS.deleteConfirm.serverFailBody,
      expect.anything(),
    );
    expect(storage.get('mobile:appearance')).toBeNull(); // on-device data IS gone
    expect(clearMock).not.toHaveBeenCalled(); // session kept so a retry can re-run the cascade
    expect(router.replace as jest.Mock).not.toHaveBeenCalled(); // navigation only via the Alert ack
    alertSpy.mockRestore();
  });

  it('offers no undo / recovery affordance (hard-immediate)', () => {
    renderWithProviders(<DeleteConfirmScreen />, { haptics: true });
    expect(screen.queryByText(/undo/i)).toBeNull();
    expect(screen.queryByText(/recover/i)).toBeNull();
  });
});
