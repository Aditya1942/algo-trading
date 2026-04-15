import { BacktestExecutor } from './backtest-executor.ts'
import { LiveExecutor } from './live-executor.ts'
import { PaperExecutor } from './paper-executor.ts'
import type { Executor } from './types.ts'

export interface ExecutorFactoryOptions {
  slippagePct?: number
}

export function getExecutorForMode(
  mode: 'backtest' | 'paper' | 'live',
  options: ExecutorFactoryOptions = {},
): Executor {
  if (mode === 'backtest') {
    return new BacktestExecutor({ slippagePct: options.slippagePct })
  }

  if (mode === 'paper') {
    return new PaperExecutor({ slippagePct: options.slippagePct })
  }

  return new LiveExecutor()
}
