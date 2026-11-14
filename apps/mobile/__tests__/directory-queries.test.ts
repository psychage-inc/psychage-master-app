import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the shared anon client so the search path is exercised without a network.
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: vi.fn() }));

import {
  buildSearchRpcArgs,
  getProviderById,
  hasSearchScope,
  searchProviders,
} from '@/features/directory/queries';
import type { ProviderSearchParams } from '@/features/directory/types';
import { getSupabaseClient } from '@/lib/supabase';

const clientMock = getSupabaseClient as unknown as ReturnType<typeof vi.fn>;

/** Minimal chainable PostgREST-builder stub that resolves to `result`. */
function builder(result: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'in', 'order', 'limit', 'or', 'eq', 'ilike', 'not', 'maybeSingle']) {
    b[m] = () => b;
  }
  // biome-ignore lint/suspicious/noThenProperty: a PostgREST query builder is itself thenable (`await query`); this stub must mirror that so the cascade can await it.
  (b as { then: unknown }).then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return b;
}

beforeEach(() => {
  clientMock.mockReset();
});

describe('searchProviders — RPC only, no fallback', () => {
  it('throws (error state + retry) when no client is configured — never a silent empty', async () => {
    clientMock.mockReturnValue(null);
    await expect(searchProviders({ query: 'swanson' })).rejects.toThrow();
  });

  it('refuses a wholly-unscoped call: returns EMPTY without hitting the RPC (no 423k-row scan)', async () => {
    const rpc = vi.fn();
    clientMock.mockReturnValue({ rpc });
    const res = await searchProviders({ page: 1, per_page: 20 });
    expect(res.providers).toEqual([]);
    expect(res.total_count).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps RPC rows and computes has_more from total_count', async () => {
    const rows = [
      { id: 'p1', display_name: 'BRIAN SWANSON', status: 'seeded', tier: 'free', specialty_tags: [], total_count: 40 },
      { id: 'p2', display_name: 'SHANA SWIMMER', status: 'seeded', tier: 'free', specialty_tags: [], total_count: 40 },
    ];
    clientMock.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: rows, error: null }) });

    const res = await searchProviders({ state: 'CA', page: 1, per_page: 20 });
    expect(res.providers.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(res.providers[0]?.display_name).toBe('BRIAN SWANSON');
    expect(res.total_count).toBe(40);
    expect(res.has_more).toBe(true); // 0 + 20 < 40
  });

  it('throws on an RPC error and never queries the providers table directly', async () => {
    const from = vi.fn(() => builder({ data: [{ id: 'other' }], error: null }));
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } });
    clientMock.mockReturnValue({ rpc, from });

    await expect(searchProviders({ query: 'swanson', state: 'CA' })).rejects.toThrow(/timeout/);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it('returns a genuine empty (no throw) when the RPC succeeds with zero rows', async () => {
    clientMock.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) });
    const res = await searchProviders({ state: 'CA' });
    expect(res.providers).toEqual([]);
    expect(res.total_count).toBe(0);
  });

  it('sends State, City and Provider type — and no coordinate, radius or accepting keys at all', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    clientMock.mockReturnValue({ rpc });
    // Cast: a stale caller passing the removed fields must still not leak them.
    const legacy = {
      state: 'CA',
      city: 'Reseda',
      provider_type_ids: ['t1'],
      latitude: 34.2,
      longitude: -118.5,
      radius_miles: 25,
      accepting_patients: true,
    } as ProviderSearchParams;
    await searchProviders(legacy);

    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe('search_providers_v3');
    expect(args.p_state).toBe('CA');
    expect(args.p_city).toBe('Reseda');
    expect(args.p_provider_type_ids).toEqual(['t1']);
    for (const key of ['p_latitude', 'p_longitude', 'p_radius_miles', 'p_accepting']) {
      expect(Object.hasOwn(args, key)).toBe(false);
    }
  });

  it('never offers a distance sort to the RPC', () => {
    const args = buildSearchRpcArgs({ state: 'CA', sort_by: 'name' }, 20, 0);
    expect(args.p_sort).toBe('name');
    expect(buildSearchRpcArgs({ state: 'CA' }, 20, 0).p_sort).toBe('relevance');
  });

  it('city+state with zero hits re-runs the SAME RPC city-only and reports the dropped filter', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ id: 'p1', display_name: 'A', status: 'seeded', tier: 'free', total_count: 1 }],
        error: null,
      });
    const from = vi.fn();
    clientMock.mockReturnValue({ rpc, from });

    const res = await searchProviders({ state: 'CA', city: 'Reseda' });
    expect(res.dropped_filters).toEqual(['state']);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect((rpc.mock.calls[1] as [string, Record<string, unknown>])[1].p_state).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

describe('hasSearchScope', () => {
  it('does not treat coordinates or accepting as a scope', () => {
    expect(hasSearchScope({ latitude: 1, longitude: 2, accepting_patients: true } as ProviderSearchParams)).toBe(false);
    expect(hasSearchScope({ state: 'CA' })).toBe(true);
    expect(hasSearchScope({ provider_type_ids: ['t1'] })).toBe(true);
  });
});

describe('getProviderById', () => {
  it('returns null (not a stub provider) when the client is absent', async () => {
    clientMock.mockReturnValue(null);
    expect(await getProviderById('p1')).toBeNull();
  });

  it('returns null on a genuine not-found, but throws on a query error', async () => {
    clientMock.mockReturnValue({ from: vi.fn(() => builder({ data: null, error: null })) });
    expect(await getProviderById('missing')).toBeNull();

    clientMock.mockReturnValue({ from: vi.fn(() => builder({ data: null, error: { message: 'boom' } })) });
    await expect(getProviderById('p1')).rejects.toThrow();
  });

  it('maps a found row into the detail shape', async () => {
    clientMock.mockReturnValue({
      from: vi.fn(() =>
        builder({
          data: {
            id: 'p1',
            display_name: 'BRIAN SWANSON',
            status: 'seeded',
            tier: 'free',
            provider_type: { id: 't1', slug: 'psychologist', label: 'Psychologist' },
            locations: [],
            specialties: [],
          },
          error: null,
        }),
      ),
    });
    const p = await getProviderById('p1');
    expect(p?.display_name).toBe('BRIAN SWANSON');
    expect(p?.provider_type?.label).toBe('Psychologist');
  });
});
