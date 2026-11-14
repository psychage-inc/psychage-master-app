import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

// Minimum-app-version startup gate: below-min blocks, equal/above passes, RPC error
// or invalid response shows a retry that re-checks, and crisis help is on every
// blocking screen.

jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.1.0' }));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('@/features/crisis/dialer', () => ({ dial: jest.fn() }));

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ rpc: mockRpc }) }));

import * as Application from 'expo-application';
import { dial } from '@/features/crisis/dialer';
import { MIN_VERSION_COPY, MinVersionGate } from '@/features/app-gate/MinVersionGate';

import { renderWithProviders } from './_helpers';

const dialMock = dial as unknown as jest.Mock;
const app = Application as { nativeApplicationVersion: string | null };

function renderGate() {
  return renderWithProviders(
    <MinVersionGate>
      <Text testID="app-routes">routes</Text>
    </MinVersionGate>,
    { query: true },
  );
}

function expectCrisisAction() {
  expect(screen.getByText(MIN_VERSION_COPY.crisisLead)).toBeTruthy();
  fireEvent.press(screen.getByTestId('gate-crisis-call'));
  expect(dialMock).toHaveBeenLastCalledWith('tel:988');
  fireEvent.press(screen.getByTestId('gate-crisis-text'));
  expect(dialMock).toHaveBeenLastCalledWith('sms:988');
}

beforeEach(() => {
  mockRpc.mockReset();
  dialMock.mockReset();
  app.nativeApplicationVersion = '1.1.0';
});

describe('MinVersionGate', () => {
  it('asks the RPC for this platform and shows a neutral loading state while checking', async () => {
    let resolve: (v: unknown) => void = () => {};
    mockRpc.mockReturnValue(new Promise((r) => (resolve = r)));
    renderGate();
    expect(screen.getByTestId('gate-checking')).toBeTruthy();
    expect(screen.getByText(MIN_VERSION_COPY.checking)).toBeTruthy();
    expect(screen.queryByTestId('app-routes')).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('get_min_app_version', { p_platform: 'ios' });
    resolve({ data: '1.0.0', error: null });
    expect(await screen.findByTestId('app-routes')).toBeTruthy();
  });

  it('blocks below the minimum with a non-dismissable update screen and no routes', async () => {
    mockRpc.mockResolvedValue({ data: '1.2.0', error: null });
    renderGate();
    expect(await screen.findByTestId('gate-update-required')).toBeTruthy();
    expect(screen.getByText(MIN_VERSION_COPY.updateTitle)).toBeTruthy();
    expect(screen.getByText(MIN_VERSION_COPY.updateBody)).toBeTruthy();
    expect(screen.queryByTestId('app-routes')).toBeNull();
    // Non-dismissable: no retry / close / continue control on this screen.
    expect(screen.queryByTestId('gate-retry')).toBeNull();
    expectCrisisAction();
  });

  it('passes when the installed version equals the minimum', async () => {
    mockRpc.mockResolvedValue({ data: '1.1.0', error: null });
    renderGate();
    expect(await screen.findByTestId('app-routes')).toBeTruthy();
  });

  it('passes when the installed version is above the minimum', async () => {
    app.nativeApplicationVersion = '1.3.0';
    mockRpc.mockResolvedValue({ data: '1.1.0', error: null });
    renderGate();
    expect(await screen.findByTestId('app-routes')).toBeTruthy();
  });

  it('shows a retryable error on RPC failure, and Retry re-runs the check', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'network' } });
    renderGate();
    expect(await screen.findByTestId('gate-error')).toBeTruthy();
    expect(screen.queryByTestId('app-routes')).toBeNull();
    expectCrisisAction();
    expect(mockRpc).toHaveBeenCalledTimes(1);

    mockRpc.mockResolvedValueOnce({ data: '1.0.0', error: null });
    fireEvent.press(screen.getByTestId('gate-retry'));
    expect(await screen.findByTestId('app-routes')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('a thrown/rejected RPC is an error, not a pass', async () => {
    mockRpc.mockRejectedValue(new Error('offline'));
    renderGate();
    expect(await screen.findByTestId('gate-error')).toBeTruthy();
    expect(screen.queryByTestId('app-routes')).toBeNull();
  });

  it.each([null, '', '1.1', 'v1.1.0', 110, { min: '1.1.0' }])(
    'treats an invalid response (%j) as an error, never a pass',
    async (data) => {
      mockRpc.mockResolvedValue({ data, error: null });
      renderGate();
      expect(await screen.findByTestId('gate-error')).toBeTruthy();
      expect(screen.queryByTestId('app-routes')).toBeNull();
    },
  );

  it('an unreadable installed version is an error, never a pass', async () => {
    app.nativeApplicationVersion = null;
    mockRpc.mockResolvedValue({ data: '1.0.0', error: null });
    renderGate();
    await waitFor(() => expect(screen.getByTestId('gate-error')).toBeTruthy());
    expect(screen.queryByTestId('app-routes')).toBeNull();
  });
});
