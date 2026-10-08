import express from 'express'
import request from 'supertest'

const userId = '11111111-1111-4111-8111-111111111111'
const recipientId = '22222222-2222-4222-8222-222222222222'

const mockSettle = jest.fn()

jest.mock('../../src/services/internalTransfer', () => {
  const actual = jest.requireActual('../../src/services/internalTransfer')
  return {
    ...actual,
    settleInternalTransfer: (...args: unknown[]) => mockSettle(...args),
  }
})

jest.mock('../../src/middleware/authenticate', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.auth = {
      userId,
      walletAddress: 'GTEST',
      network: 'TESTNET',
    }
    req.authKind = 'session'
    req.authScopes = ['*']
    next()
  },
}))

jest.mock('../../src/middleware/apiKeyAuth', () => ({
  requireScope: () => (_req: any, _res: any, next: any) => next(),
  requireWithdrawScope: (_req: any, _res: any, next: any) => next(),
}))

jest.mock('../../src/middleware/idempotency', () => ({
  idempotent: () => (_req: any, _res: any, next: any) => next(),
}))

jest.mock('../../src/middleware/rateLimiter', () => ({
  sensitiveRateLimiter: (_req: any, _res: any, next: any) => next(),
}))

jest.mock('../../src/middleware/subAccount', () => ({
  requireSubAccountPermission: () => (_req: any, _res: any, next: any) => next(),
}))

const mockUserUpdate = jest.fn()
jest.mock('../../src/db', () => ({
  __esModule: true,
  default: {
    user: { update: (...args: unknown[]) => mockUserUpdate(...args) },
  },
}))

import transferRouter from '../../src/routes/transfer'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/transfer', transferRouter)
  app.use((error: any, _req: any, res: any, _next: any) => {
    res.status(error?.statusCode ?? 500).json({ error: error?.message ?? 'error' })
  })
  return app
}

describe('internal transfer route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserUpdate.mockResolvedValue({ transferHandle: 'alice' })
    mockSettle.mockResolvedValue({
      id: 'transfer-1',
      senderTransactionId: 'tx-out',
      recipientTransactionId: 'tx-in',
      recipientHandle: '@bob',
      amount: 25,
      assetSymbol: 'USDC',
      complianceScore: 15,
      createdAt: new Date('2026-10-08T10:00:00.000Z'),
    })
  })

  it('registers a normalized public handle', async () => {
    const res = await request(buildApp())
      .put('/api/v1/transfer/handle')
      .send({ handle: '@Alice' })

    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: { transferHandle: 'alice' },
      })
    )
    expect(res.body).toEqual({ handle: '@alice' })
  })

  it('settles by public handle without exposing the recipient internal id', async () => {
    const res = await request(buildApp()).post('/api/v1/transfer').send({
      recipientHandle: '@bob',
      amount: 25,
      assetSymbol: 'USDC',
      note: 'lunch',
    })

    expect(res.status).toBe(201)
    expect(mockSettle).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: userId,
        senderUserId: userId,
        recipientHandle: '@bob',
        amount: 25,
        assetSymbol: 'USDC',
      })
    )
    expect(res.body.transfer.recipientHandle).toBe('@bob')
    expect(JSON.stringify(res.body)).not.toContain(recipientId)
  })

  it('rejects ambiguous recipient selectors before settlement', async () => {
    const res = await request(buildApp()).post('/api/v1/transfer').send({
      recipientHandle: '@bob',
      recipientUserId: recipientId,
      amount: 25,
      assetSymbol: 'USDC',
    })

    expect(res.status).toBe(400)
    expect(mockSettle).not.toHaveBeenCalled()
  })
})
