import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  runBacktest,
  getBacktestHistory,
  getBacktestResult,
  getStrategies,
  type BacktestConfig,
} from '@/lib/api'

export const backtestKeys = {
  all: ['backtest'] as const,
  history: () => [...backtestKeys.all, 'history'] as const,
  result: (id: number) => [...backtestKeys.all, 'result', id] as const,
  strategies: () => ['strategies'] as const,
}

export function useStrategiesQuery() {
  return useQuery({
    queryKey: backtestKeys.strategies(),
    queryFn: getStrategies,
    staleTime: 60 * 60 * 1000, // strategies rarely change
  })
}

export function useRunBacktestMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: BacktestConfig) => runBacktest(config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backtestKeys.history() })
    },
  })
}

export function useBacktestHistoryQuery() {
  return useQuery({
    queryKey: backtestKeys.history(),
    queryFn: getBacktestHistory,
  })
}

export function useBacktestResultQuery(id: number) {
  return useQuery({
    queryKey: backtestKeys.result(id),
    queryFn: () => getBacktestResult(id),
    enabled: id > 0,
  })
}
