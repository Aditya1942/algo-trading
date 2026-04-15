import type { FoContractConfig } from '../../shared/contracts/index.ts'
import type { ResolvedFoContract } from './types.ts'

export async function resolveContract(
  _config: FoContractConfig,
  _referencePrice: number,
  _referenceDate: Date,
): Promise<ResolvedFoContract> {
  throw new Error('F&O resolution not yet implemented')
}
