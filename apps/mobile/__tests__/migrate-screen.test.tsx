import { fireEvent, screen } from '@testing-library/react-native';

import MigrateScreen from '@/app/(auth)/migrate';
import { AUTH_COPY } from '@/features/auth';

import { renderWithProviders } from './_helpers';

// PR-058 — /migrate is reachable by bare deep link, so the real network push must
// NOT auto-run on mount: it requires an explicit Start tap (auto-run only behind
// ?auto=1), and the terminal states carry an exit that survives a cold start.

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({})),
  router: {
    canGoBack: jest.fn(() => false),
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('@/features/auth/migration/remote', () => ({
  productionMigrationRemote: {
    fetchAccountEntries: jest.fn(async () => []),
    pushMergedEntries: jest.fn(async () => undefined),
  },
}));

jest.mock('@/lib/moment-store', () => ({
  getMomentStore: () => ({ getRange: () => [] }),
}));

const routerMock = jest.requireMock('expo-router') as {
  useLocalSearchParams: jest.Mock;
  router: { canGoBack: jest.Mock; replace: jest.Mock };
};
const remoteMock = jest.requireMock('@/features/auth/migration/remote') as {
  productionMigrationRemote: { fetchAccountEntries: jest.Mock; pushMergedEntries: jest.Mock };
};

describe('S36 Migrate screen (PR-058)', () => {
  beforeEach(() => {
    routerMock.useLocalSearchParams.mockReturnValue({});
    routerMock.router.canGoBack.mockReturnValue(false);
    routerMock.router.replace.mockClear();
    remoteMock.productionMigrationRemote.fetchAccountEntries.mockClear();
    remoteMock.productionMigrationRemote.pushMergedEntries.mockClear();
  });

  it('does NOT auto-run on a bare open — it waits for an explicit Start tap', () => {
    renderWithProviders(<MigrateScreen />, { haptics: true });

    expect(screen.getByTestId('migrate-start')).toBeTruthy();
    expect(remoteMock.productionMigrationRemote.fetchAccountEntries).not.toHaveBeenCalled();
    expect(remoteMock.productionMigrationRemote.pushMergedEntries).not.toHaveBeenCalled();
  });

  it('runs the migration after Start and then shows an exit button', async () => {
    renderWithProviders(<MigrateScreen />, { haptics: true });

    fireEvent.press(screen.getByTestId('migrate-start'));

    expect(await screen.findByTestId('migrate-exit')).toBeTruthy();
    expect(remoteMock.productionMigrationRemote.fetchAccountEntries).toHaveBeenCalledTimes(1);
    expect(screen.getByText(AUTH_COPY.migrateEmptyLine)).toBeTruthy();
  });

  it('auto-runs only when ?auto=1 is present', async () => {
    routerMock.useLocalSearchParams.mockReturnValue({ auto: '1' });
    renderWithProviders(<MigrateScreen />, { haptics: true });

    expect(screen.queryByTestId('migrate-start')).toBeNull();
    expect(await screen.findByTestId('migrate-exit')).toBeTruthy();
    expect(remoteMock.productionMigrationRemote.fetchAccountEntries).toHaveBeenCalledTimes(1);
  });

  it('the exit button falls back to "/" on a cold start (nothing to pop)', async () => {
    renderWithProviders(<MigrateScreen />, { haptics: true });

    fireEvent.press(screen.getByTestId('migrate-start'));
    fireEvent.press(await screen.findByTestId('migrate-exit'));

    expect(routerMock.router.replace).toHaveBeenCalledWith('/');
  });

  it('shows the exit button on the honest offline outcome too', async () => {
    remoteMock.productionMigrationRemote.fetchAccountEntries.mockRejectedValueOnce(
      new Error('offline'),
    );
    renderWithProviders(<MigrateScreen />, { haptics: true });

    fireEvent.press(screen.getByTestId('migrate-start'));

    expect(await screen.findByTestId('migrate-exit')).toBeTruthy();
    expect(screen.getByText(AUTH_COPY.offlineLine)).toBeTruthy();
  });
});
