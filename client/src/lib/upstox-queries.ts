import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  getFundsAndMargin,
  getHoldings,
  getOrderHistory,
  getUserProfile,
  logout,
  searchInstruments,
  getStoredInstruments,
  getStoredInstrumentsCount,
} from '@/lib/api'
import { upstoxKeys, instrumentsKeys } from '@/lib/upstox-query-keys'

export function useUpstoxProfileQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: upstoxKeys.profile(),
    queryFn: getUserProfile,
    enabled: options?.enabled ?? true,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 401) return false
      return failureCount < 1
    },
  })
}

export function useFundsAndMarginQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: upstoxKeys.funds(),
    queryFn: getFundsAndMargin,
    enabled: options?.enabled ?? true,
  })
}

export function useHoldingsQuery() {
  return useQuery({
    queryKey: upstoxKeys.holdings(),
    queryFn: getHoldings,
  })
}

export function useOrderHistoryQuery() {
  return useQuery({
    queryKey: upstoxKeys.orders(),
    queryFn: getOrderHistory,
  })
}

export function useInstrumentSearchQuery(query: string) {
  return useQuery({
    queryKey: upstoxKeys.instrumentSearch(query),
    queryFn: () => searchInstruments(query),
    enabled: query.length >= 2,
  })
}

export function useStoredInstrumentsQuery(search: string, page: number) {
  return useQuery({
    queryKey: instrumentsKeys.stored(search, page),
    queryFn: () => getStoredInstruments(search, page),
  })
}

export function useStoredInstrumentsCountQuery() {
  return useQuery({
    queryKey: instrumentsKeys.storedCount(),
    queryFn: getStoredInstrumentsCount,
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.removeQueries({ queryKey: upstoxKeys.all })
    },
  })
}
