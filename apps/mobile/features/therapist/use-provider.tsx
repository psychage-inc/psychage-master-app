import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// The ONE linked provider (V1 — multi-provider is premium / V1.1, rules/auth.md §3).
// Provider contact is PII and sensitive (rules/auth.md §1): NEVER to analytics/Sentry
// (Sacred Rule #11). Held in-memory here for the flow — real persistence is
// account-tier (Tier-2) and SERVER-side, gated behind the SR-4/sync layer. Flagged.

export interface Provider {
  readonly name: string;
  /** Optional email/phone. PII — kept local, never logged. */
  readonly contact?: string;
}

interface ProviderContextValue {
  readonly provider: Provider | null;
  setProvider(provider: Provider | null): void;
}

const ProviderContext = createContext<ProviderContextValue>({
  provider: null,
  setProvider: () => {},
});

// Module-level mirror of the linked provider so the PURE PDF builder (build-html.ts,
// no React) can stamp "Prepared for" on the flow's summary (S39). Same rules as the
// context state: in-memory only, never persisted, never logged (Sacred Rule #11).
let linkedProvider: Provider | null = null;

/** The provider linked in the current flow, or null. In-memory only — PII stays local. */
export function getLinkedProvider(): Provider | null {
  return linkedProvider;
}

/** Mirror sync — driven by ProviderProvider; exported for the builder's Vitest seam. */
export function syncLinkedProvider(provider: Provider | null): void {
  linkedProvider = provider;
}

export function ProviderProvider({
  children,
  initialProvider = null,
}: {
  children: ReactNode;
  initialProvider?: Provider | null;
}) {
  const [provider, setProvider] = useState<Provider | null>(initialProvider);
  // Keep the mirror exactly in step while mounted; clear it when the flow unmounts so a
  // later flow never inherits a stale provider name.
  useEffect(() => {
    syncLinkedProvider(provider);
    return () => syncLinkedProvider(null);
  }, [provider]);
  const value = useMemo<ProviderContextValue>(() => ({ provider, setProvider }), [provider]);
  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
}

export function useProvider(): ProviderContextValue {
  return useContext(ProviderContext);
}
