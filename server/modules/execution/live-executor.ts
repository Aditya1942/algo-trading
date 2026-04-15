import type { Signal } from '../strategy/types.ts'
import type { ExecutionContext, Executor, Fill } from './types.ts'

export class LiveExecutor implements Executor {
  async execute(_signal: Signal, _context: ExecutionContext): Promise<Fill> {
    throw new Error('Live execution not yet implemented')
  }
}
