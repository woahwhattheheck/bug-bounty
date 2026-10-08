import { NextFunction, Request, Response, Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import db from '../db'
import { requireAuth } from '../middleware/authenticate'
import { requireScope, requireWithdrawScope } from '../middleware/apiKeyAuth'
import { idempotent } from '../middleware/idempotency'
import { sensitiveRateLimiter } from '../middleware/rateLimiter'
import { requireSubAccountPermission } from '../middleware/subAccount'
import { validate } from '../middleware/validate'
import { onChainAmountSchema } from '../validators/common-validators'
import {
  normalizeTransferHandle,
  settleInternalTransfer,
} from '../services/internalTransfer'
import { sendError } from '../utils/errors'

const router = Router()

const setHandleSchema = z.object({
  handle: z.string().trim().min(3).max(33),
})

const transferSchema = z
  .object({
    userId: z.string().uuid().optional(),
    recipientHandle: z.string().trim().min(3).max(33).optional(),
    recipientUserId: z.string().uuid().optional(),
    amount: onChainAmountSchema,
    assetSymbol: z.string().trim().min(1).max(32),
    note: z.string().trim().max(280).optional(),
  })
  .refine(
    (body) =>
      Number(Boolean(body.recipientHandle)) +
        Number(Boolean(body.recipientUserId)) ===
      1,
    {
      message: 'Provide exactly one of recipientHandle or recipientUserId',
      path: ['recipientHandle'],
    }
  )

router.put(
  '/handle',
  requireAuth,
  sensitiveRateLimiter,
  validate({ body: setHandleSchema, errorMessage: 'Validation error' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const handle = normalizeTransferHandle(req.body.handle)
      const updated = await db.user.update({
        where: { id: req.auth!.userId },
        data: { transferHandle: handle },
        select: { transferHandle: true },
      })
      return res.status(200).json({ handle: `@${updated.transferHandle}` })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return sendError(res, 409, 'Handle unavailable')
      }
      return next(error)
    }
  }
)

router.post(
  '/',
  requireAuth,
  requireScope('withdraw:write'),
  requireWithdrawScope,
  idempotent({ required: true, failClosed: true, ttlSeconds: 86400 }),
  // The transfer endpoint is itself the only recipient-handle lookup surface.
  // Rate-limiting it here prevents handle-guessing from becoming an enumeration
  // oracle while keeping lookup and debit inside one authenticated operation.
  sensitiveRateLimiter,
  validate({ body: transferSchema, errorMessage: 'Validation error' }),
  requireSubAccountPermission('WITHDRAW'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const senderUserId = req.body.userId ?? req.auth!.userId
      const result = await settleInternalTransfer({
        actorUserId: req.auth!.userId,
        senderUserId,
        actingAsUserId: req.auth!.actingAsUserId ?? null,
        recipientHandle: req.body.recipientHandle,
        recipientUserId: req.body.recipientUserId,
        amount: req.body.amount,
        assetSymbol: req.body.assetSymbol,
        note: req.body.note,
      })

      return res.status(201).json({
        status: 'CONFIRMED',
        transfer: {
          id: result.id,
          recipientHandle: result.recipientHandle,
          amount: result.amount,
          assetSymbol: result.assetSymbol,
          complianceScore: result.complianceScore,
          settledAt: result.createdAt,
        },
      })
    } catch (error) {
      return next(error)
    }
  }
)

export default router
