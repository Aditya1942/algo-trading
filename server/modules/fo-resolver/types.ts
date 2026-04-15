import type { FoContractConfig } from '../../shared/contracts/index.ts'

export interface ResolvedFoContract {
  instrumentKey: string
  lotSize: number
  expiry: string
}

export type { FoContractConfig }
