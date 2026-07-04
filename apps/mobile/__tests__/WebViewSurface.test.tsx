import { screen, waitFor } from '@testing-library/react-native';

// Mock WebView as a plain host-component string — no JSX/createElement in the
// factory, which NativeWind's babel transform would otherwise rewrite into an
// out-of-scope _ReactNativeCSSInterop reference.
jest.mock('react-native-webview', () => ({ WebView: 'RNCWebViewMock' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/features/offline/useIsOnline', () => ({ useIsOnline: jest.fn(() => true) }));

import { type WvtIssuer, stubWvtIssuer } from '@/features/webview/auth-handshake';
import { router } from 'expo-router';
import { WebViewSurface } from '@/features/webview/WebViewSurface';
import { useIsOnline } from '@/features/offline/useIsOnline';

import { renderWithProviders } from './_helpers';

const onlineMock = useIsOnline as unknown as jest.Mock;
const fakeIssuer: WvtIssuer = { issue: async () => ({ wvt: 'fake-token', expiresAt: 0 }) };

describe('WebViewSurface (SYS-S8 chrome)', () => {
  beforeEach(() => {
    onlineMock.mockReturnValue(true);
  });

  it('PR-057: the gated stub issuer renders the unavailable state, never a sign-in bounce', async () => {
    renderWithProviders(<WebViewSurface surface="library" issuer={stubWvtIssuer} />, { haptics: true });
    await waitFor(() => expect(screen.getByTestId('wv-unavailable')).toBeTruthy());
    expect(router.push).not.toHaveBeenCalledWith('/sign-in');
  });

  it('renders the GlobalHeader + back over a paper base — no white flash', () => {
    renderWithProviders(<WebViewSurface surface="library" issuer={fakeIssuer} />, { haptics: true });
    expect(screen.getByText('Psychage')).toBeTruthy(); // GlobalHeader chrome
    expect(screen.getByTestId('wv-back')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('#F9F7F3'); // paper base behind the WebView
    expect(tree).not.toContain('#ffffff');
    expect(tree).not.toContain('bg-white');
  });

  it('mounts the WebView hidden (opacity 0, transparent) until it loads', async () => {
    renderWithProviders(<WebViewSurface surface="library" issuer={fakeIssuer} />, { haptics: true });
    const wv = await waitFor(() => screen.getByTestId('wv-webview'));
    expect(wv.props.style.opacity).toBe(0);
    expect(wv.props.style.backgroundColor).toBe('transparent');
  });

  it('hands off to the offline fallback instead of a dead WebView', () => {
    onlineMock.mockReturnValue(false);
    renderWithProviders(<WebViewSurface surface="library" issuer={fakeIssuer} />, { haptics: true });
    expect(screen.getByTestId('wv-offline')).toBeTruthy();
  });
});
