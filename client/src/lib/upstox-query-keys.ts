/** Prefix for all Upstox proxy queries — use with removeQueries on logout. */
export const UPSTOX_QUERY_ROOT = 'upstox' as const

export const upstoxKeys = {
  all: [UPSTOX_QUERY_ROOT] as const,
  profile: () => [...upstoxKeys.all, 'profile'] as const,
  funds: () => [...upstoxKeys.all, 'funds'] as const,
  holdings: () => [...upstoxKeys.all, 'holdings'] as const,
  orders: () => [...upstoxKeys.all, 'orders'] as const,
  instrumentSearch: (q: string) => [...upstoxKeys.all, 'instrument-search', q] as const,
}

export const instrumentsKeys = {
  all: ['instruments'] as const,
  stored: (search: string, page: number) => [...instrumentsKeys.all, 'stored', search, page] as const,
  storedCount: () => [...instrumentsKeys.all, 'stored-count'] as const,
}
