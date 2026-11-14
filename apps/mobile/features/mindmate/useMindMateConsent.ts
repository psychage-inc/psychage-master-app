import { useCallback, useEffect, useRef, useState } from 'react';

import type { MindMateConsentApi, MindMateConsentStatus } from './consent-api';

// Loads the signed-in user's MindMate consent status from the server (the single
// authority) and exposes the grant/withdraw actions. Signed out → no RPC at all
// (mindmate_consent_status throws without a session); the chat's own sign-in path
// applies. A failed load is an explicit 'error' state — never treated as consent.

export type MindMateConsentState =
  | { kind: 'signed-out' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; status: MindMateConsentStatus };

export interface UseMindMateConsent {
  state: MindMateConsentState;
  /** Re-fetch the status from the server (Retry, and after a 403 CONSENT_REQUIRED). */
  reload: () => void;
  /** Record consent for this build's version, then re-read the status. Rejects on failure. */
  grant: () => Promise<void>;
  /** Withdraw consent, then re-read the status. Rejects on failure. */
  withdraw: () => Promise<void>;
}

export function useMindMateConsent({
  signedIn,
  getApi,
}: {
  signedIn: boolean;
  /** Resolved lazily — only a signed-in user ever touches the RPC client. */
  getApi: () => MindMateConsentApi;
}): UseMindMateConsent {
  const [state, setState] = useState<MindMateConsentState>(
    signedIn ? { kind: 'loading' } : { kind: 'signed-out' },
  );
  // Only the latest load may write state — a slow earlier response must not
  // overwrite a newer one (e.g. Retry tapped twice, or reload right after grant).
  const requestSeq = useRef(0);
  const getApiRef = useRef(getApi);
  getApiRef.current = getApi;

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setState({ kind: 'loading' });
    try {
      const status = await getApiRef.current().getStatus();
      if (seq === requestSeq.current) setState({ kind: 'ready', status });
    } catch {
      if (seq === requestSeq.current) setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    if (!signedIn) {
      requestSeq.current++;
      setState({ kind: 'signed-out' });
      return;
    }
    void load();
  }, [signedIn, load]);

  const reload = useCallback(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  const grant = useCallback(async () => {
    await getApiRef.current().grant();
    await load();
  }, [load]);

  const withdraw = useCallback(async () => {
    await getApiRef.current().withdraw();
    await load();
  }, [load]);

  return { state, reload, grant, withdraw };
}
