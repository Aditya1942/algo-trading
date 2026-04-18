import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listCustomStrategies,
  getCustomStrategy,
  createCustomStrategy,
  updateCustomStrategy,
  deleteCustomStrategy,
  validateCustomStrategy,
  type CustomStrategyInput,
} from '@/lib/api'
import { backtestKeys } from './backtest-queries'

export const customStrategyKeys = {
  all: ['custom-strategies'] as const,
  list: () => [...customStrategyKeys.all, 'list'] as const,
  detail: (id: number) => [...customStrategyKeys.all, 'detail', id] as const,
}

export function useCustomStrategiesQuery() {
  return useQuery({
    queryKey: customStrategyKeys.list(),
    queryFn: listCustomStrategies,
  })
}

export function useCustomStrategyQuery(id: number) {
  return useQuery({
    queryKey: customStrategyKeys.detail(id),
    queryFn: () => getCustomStrategy(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: customStrategyKeys.all })
  qc.invalidateQueries({ queryKey: backtestKeys.strategies() })
}

export function useCreateCustomStrategyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomStrategyInput) => createCustomStrategy(input),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useUpdateCustomStrategyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<CustomStrategyInput> }) =>
      updateCustomStrategy(id, patch),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteCustomStrategyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCustomStrategy(id),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useValidateCustomStrategyMutation() {
  return useMutation({
    mutationFn: (id: number) => validateCustomStrategy(id),
  })
}
