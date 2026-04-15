import { describe, expect, test } from 'bun:test'
import { resolveContract } from '../resolver.ts'

describe('resolveContract', () => {
  test('throws a not implemented error for the MVP stub', async () => {
    await expect(
      resolveContract(
        {
          underlying: 'NIFTY',
          instrumentType: 'CE',
          expiryPolicy: 'current_week',
          strikeSelection: 'atm',
          lotMultiplier: 1,
        },
        22450,
        new Date('2024-01-15T09:15:00+05:30'),
      ),
    ).rejects.toThrow('F&O resolution not yet implemented')
  })
})
