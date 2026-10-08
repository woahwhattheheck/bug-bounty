import {
  scoreTransaction,
  type TransactionContext,
} from '../../../src/compliance/scoring'

describe('internal-transfer compliance scoring', () => {
  it('applies velocity, structuring, and first-recipient signals to internal sends', () => {
    const at = new Date('2026-10-08T10:00:00.000Z')
    const prior = [1, 2, 3].map((hoursAgo) => ({
      type: 'INTERNAL_TRANSFER_OUT' as const,
      amount: 9_500,
      assetSymbol: 'USDC',
      createdAt: new Date(at.getTime() - hoursAgo * 60 * 60 * 1000),
      isAgentDriven: false,
    }))

    const context: TransactionContext = {
      transaction: {
        id: 'pending',
        userId: 'sender',
        type: 'INTERNAL_TRANSFER_OUT',
        amount: 9_500,
        assetSymbol: 'USDC',
        createdAt: at,
        destinationAddress: 'internal:recipient-b',
        isAgentDriven: false,
      },
      account: {
        userId: 'sender',
        accountCreatedAt: new Date('2025-01-01T00:00:00.000Z'),
        transactionHistory: prior,
        knownDestinationAddresses: ['internal:recipient-a'],
        destinationAccountAgeMs: 60 * 24 * 60 * 60 * 1000,
      },
    }

    const result = scoreTransaction(context)

    expect(result.reasonCodes).toContain('NEW_DESTINATION_NO_HISTORY')
    expect(result.reasonCodes).toContain('STRUCTURING_SUB_THRESHOLD_PATTERN')
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        'VELOCITY_HIGH_FREQUENCY',
        'VELOCITY_HIGH_VOLUME',
      ])
    )
    expect(result.totalScore).toBeGreaterThan(0)
  })

  it('does not mark a known internal recipient as new', () => {
    const at = new Date('2026-10-08T10:00:00.000Z')
    const result = scoreTransaction({
      transaction: {
        id: 'pending',
        userId: 'sender',
        type: 'INTERNAL_TRANSFER_OUT',
        amount: 100,
        assetSymbol: 'USDC',
        createdAt: at,
        destinationAddress: 'internal:recipient-a',
        isAgentDriven: false,
      },
      account: {
        userId: 'sender',
        accountCreatedAt: new Date('2025-01-01T00:00:00.000Z'),
        transactionHistory: [],
        knownDestinationAddresses: ['internal:recipient-a'],
      },
    })

    expect(result.reasonCodes).not.toContain('NEW_DESTINATION_NO_HISTORY')
  })
})
