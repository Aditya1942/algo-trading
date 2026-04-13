import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTrackedInstruments,
  addTrackedInstrument,
  deleteTrackedInstrument,
  pauseInstrument,
  resumeInstrument,
  getTrackedInstrumentKeys,
  getCandles,
} from '@/lib/api'

export const marketDataKeys = {
  all: ['market-data'] as const,
  instruments: () => [...marketDataKeys.all, 'instruments'] as const,
  trackedKeys: () => [...marketDataKeys.all, 'tracked-keys'] as const,
  candles: (id: number, from?: string, to?: string, interval?: string) =>
    [...marketDataKeys.all, 'candles', id, from, to, interval] as const,
}

export function useTrackedInstrumentsQuery() {
  return useQuery({
    queryKey: marketDataKeys.instruments(),
    queryFn: getTrackedInstruments,
    refetchInterval: 5_000, // live progress updates
  })
}

export function useTrackedInstrumentKeysQuery() {
  return useQuery({
    queryKey: marketDataKeys.trackedKeys(),
    queryFn: getTrackedInstrumentKeys,
  })
}

export function useAddInstrumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { instrumentKey: string; name?: string; exchange?: string }) =>
      addTrackedInstrument(vars.instrumentKey, vars.name, vars.exchange),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: marketDataKeys.instruments() })
      qc.invalidateQueries({ queryKey: marketDataKeys.trackedKeys() })
    },
  })
}

export function useDeleteInstrumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteTrackedInstrument,
    onSuccess: () => qc.invalidateQueries({ queryKey: marketDataKeys.instruments() }),
  })
}

export function usePauseInstrumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: pauseInstrument,
    onSuccess: () => qc.invalidateQueries({ queryKey: marketDataKeys.instruments() }),
  })
}

export function useResumeInstrumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resumeInstrument,
    onSuccess: () => qc.invalidateQueries({ queryKey: marketDataKeys.instruments() }),
  })
}

export function useCandlesQuery(instrumentId: number, from?: string, to?: string, interval: '1d' | '1h' | '1m' = '1d') {
  return useQuery({
    queryKey: marketDataKeys.candles(instrumentId, from, to, interval),
    queryFn: () => getCandles(instrumentId, from, to, interval),
    enabled: !!instrumentId,
    staleTime: 5 * 60 * 1000, // historical data rarely changes
  })
}
