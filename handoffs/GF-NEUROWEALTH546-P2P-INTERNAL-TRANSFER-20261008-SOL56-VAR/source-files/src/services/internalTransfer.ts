import { Prisma, TransactionStatus, TransactionType } from '@prisma/client'
import db from '../db'
import { auditPayloadHashFor } from '../audit/chain'
import {
  scoreTransaction,
  type HistoricalTransaction,
  type TransactionTypeLike,
} from '../compliance/scoring'
import { AppError } from '../utils/errors'

const MAX_SERIALIZABLE_ATTEMPTS = 3
const HISTORY_LIMIT = 200

export const TRANSFER_HANDLE_RE = /^[a-z0-9_]{3,32}$/

export function normalizeTransferHandle(value: string): string {
  const normalized = value.trim().replace(/^@/, '').toLowerCase()
  if (!TRANSFER_HANDLE_RE.test(normalized)) {
    throw new AppError(
      400,
      'Handle must be 3-32 characters using lowercase letters, numbers, or underscore'
    )
  }
  return normalized
}

export interface InternalTransferInput {
  actorUserId: string
  senderUserId: string
  actingAsUserId?: string | null
  recipientHandle?: string
  recipientUserId?: string
  amount: number
  assetSymbol: string
  note?: string
}

export interface InternalTransferResult {
  id: string
  senderTransactionId: string
  recipientTransactionId: string
  recipientHandle: string
  amount: number
  assetSymbol: string
  complianceScore: number
  createdAt: Date
}

function isSerializableConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  )
}

function toScoringType(type: TransactionType): TransactionTypeLike | null {
  switch (type) {
    case TransactionType.DEPOSIT:
    case TransactionType.WITHDRAWAL:
    case TransactionType.YIELD_CLAIM:
    case TransactionType.REBALANCE:
    case TransactionType.SWAP:
    case TransactionType.REFERRAL_REWARD:
    case TransactionType.INTERNAL_TRANSFER_IN:
    case TransactionType.INTERNAL_TRANSFER_OUT:
      return type
    default:
      return null
  }
}

async function buildComplianceContext(params: {
  senderUserId: string
  recipientUserId: string
  recipientCreatedAt: Date
  amount: number
  assetSymbol: string
  now: Date
}) {
  const [sender, historyRows, priorRecipients, childCount, recentChildDeposits] =
    await Promise.all([
      db.user.findUnique({
        where: { id: params.senderUserId },
        select: { id: true, createdAt: true },
      }),
      db.transaction.findMany({
        where: {
          userId: params.senderUserId,
          status: TransactionStatus.CONFIRMED,
        },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
        select: {
          type: true,
          amount: true,
          assetSymbol: true,
          createdAt: true,
        },
      }),
      db.internalTransfer.findMany({
        where: { senderUserId: params.senderUserId },
        select: { recipientUserId: true },
        distinct: ['recipientUserId'],
      }),
      db.subAccount.count({
        where: { parentUserId: params.senderUserId, status: 'ACTIVE' },
      }),
      db.subAccount.findMany({
        where: { parentUserId: params.senderUserId, status: 'ACTIVE' },
        select: { childUserId: true },
      }),
    ])

  if (!sender) throw new AppError(404, 'Sender not found')

  const history: HistoricalTransaction[] = historyRows.flatMap((row) => {
    const type = toScoringType(row.type)
    if (!type) return []
    return [
      {
        type,
        amount: Number(row.amount),
        assetSymbol: row.assetSymbol,
        createdAt: row.createdAt,
        isAgentDriven: false,
      },
    ]
  })

  const childIds = recentChildDeposits.map((row) => row.childUserId)
  const since = new Date(params.now.getTime() - 24 * 60 * 60 * 1000)
  const activeChildDeposits =
    childIds.length === 0
      ? []
      : await db.transaction.findMany({
          where: {
            userId: { in: childIds },
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.CONFIRMED,
            createdAt: { gte: since },
          },
          select: { userId: true },
          distinct: ['userId'],
        })

  return {
    transaction: {
      id: 'pending-internal-transfer',
      userId: params.senderUserId,
      type: 'INTERNAL_TRANSFER_OUT' as const,
      amount: params.amount,
      assetSymbol: params.assetSymbol,
      createdAt: params.now,
      destinationAddress: `internal:${params.recipientUserId}`,
      isAgentDriven: false,
    },
    account: {
      userId: params.senderUserId,
      accountCreatedAt: sender.createdAt,
      transactionHistory: history,
      knownDestinationAddresses: priorRecipients.map(
        (row) => `internal:${row.recipientUserId}`
      ),
      destinationAccountAgeMs: Math.max(
        0,
        params.now.getTime() - params.recipientCreatedAt.getTime()
      ),
      subAccount: {
        childCount,
        recentChildDepositCount: activeChildDeposits.length,
      },
    },
  }
}

async function resolveRecipient(input: InternalTransferInput) {
  if (Boolean(input.recipientHandle) === Boolean(input.recipientUserId)) {
    throw new AppError(
      400,
      'Provide exactly one of recipientHandle or recipientUserId'
    )
  }

  const recipient = input.recipientHandle
    ? await db.user.findUnique({
        where: { transferHandle: normalizeTransferHandle(input.recipientHandle) },
        select: {
          id: true,
          transferHandle: true,
          isActive: true,
          network: true,
          createdAt: true,
        },
      })
    : await db.user.findUnique({
        where: { id: input.recipientUserId! },
        select: {
          id: true,
          transferHandle: true,
          isActive: true,
          network: true,
          createdAt: true,
        },
      })

  // Keep "missing" and "frozen" indistinguishable to a handle guesser.
  if (!recipient || !recipient.isActive) {
    throw new AppError(404, 'Recipient unavailable')
  }
  if (!recipient.transferHandle) {
    throw new AppError(409, 'Recipient has no public transfer handle')
  }
  if (recipient.id === input.senderUserId) {
    throw new AppError(400, 'Self-transfer is not allowed')
  }
  return recipient
}

export async function settleInternalTransfer(
  input: InternalTransferInput
): Promise<InternalTransferResult> {
  const now = new Date()
  const recipient = await resolveRecipient(input)

  const sender = await db.user.findUnique({
    where: { id: input.senderUserId },
    select: { id: true, isActive: true, network: true },
  })
  if (!sender || !sender.isActive) throw new AppError(403, 'Sender unavailable')
  if (sender.network !== recipient.network) {
    throw new AppError(409, 'Recipient is on a different network')
  }

  const compliance = scoreTransaction(
    await buildComplianceContext({
      senderUserId: input.senderUserId,
      recipientUserId: recipient.id,
      recipientCreatedAt: recipient.createdAt,
      amount: input.amount,
      assetSymbol: input.assetSymbol,
      now,
    })
  )

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(
        async (tx) => {
          const [freshSender, freshRecipient] = await Promise.all([
            tx.user.findUnique({
              where: { id: input.senderUserId },
              select: { isActive: true, network: true },
            }),
            tx.user.findUnique({
              where: { id: recipient.id },
              select: { isActive: true, network: true, transferHandle: true },
            }),
          ])

          if (!freshSender?.isActive) {
            throw new AppError(403, 'Sender unavailable')
          }
          if (
            !freshRecipient?.isActive ||
            !freshRecipient.transferHandle ||
            freshRecipient.network !== freshSender.network
          ) {
            throw new AppError(404, 'Recipient unavailable')
          }

          // If the actor is the recipient's parent, depositing into that child
          // must pass the same DEPOSIT gate used by the normal deposit path.
          if (input.actorUserId !== recipient.id) {
            const link = await tx.subAccount.findUnique({
              where: {
                parentUserId_childUserId: {
                  parentUserId: input.actorUserId,
                  childUserId: recipient.id,
                },
              },
              select: { status: true, permissions: true },
            })
            if (
              link &&
              (link.status !== 'ACTIVE' || !link.permissions.includes('DEPOSIT'))
            ) {
              throw new AppError(403, 'Recipient sub-account deposit not permitted')
            }
          }

          const positions = await tx.position.findMany({
            where: {
              userId: input.senderUserId,
              assetSymbol: input.assetSymbol,
              status: 'ACTIVE',
            },
            orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
          })

          const lockedRows =
            positions.length === 0
              ? []
              : await tx.collateralLoan.findMany({
                  where: {
                    positionId: { in: positions.map((p) => p.id) },
                    status: 'ACTIVE',
                  },
                  select: { positionId: true },
                })
          const locked = new Set(lockedRows.map((row) => row.positionId))
          const movable = positions.filter((position) => !locked.has(position.id))
          const available = movable.reduce(
            (sum, position) =>
              sum.add(new Prisma.Decimal(position.currentValue)),
            new Prisma.Decimal(0)
          )
          let remaining = new Prisma.Decimal(input.amount)
          if (available.lt(remaining)) {
            throw new AppError(409, 'Insufficient unlocked balance')
          }

          for (const position of movable) {
            if (remaining.lte(0)) break

            const current = new Prisma.Decimal(position.currentValue)
            if (current.lte(0)) continue
            const debit = current.lt(remaining) ? current : remaining
            const ratio = debit.div(current)
            const deposited = new Prisma.Decimal(position.depositedAmount)
            const yieldEarned = new Prisma.Decimal(position.yieldEarned)
            const principalDebit = deposited.mul(ratio)
            const yieldDebit = yieldEarned.mul(ratio)

            await tx.position.update({
              where: { id: position.id },
              data: {
                currentValue: current.sub(debit),
                depositedAmount: deposited.sub(principalDebit),
                yieldEarned: yieldEarned.sub(yieldDebit),
              },
            })

            const recipientPosition = await tx.position.findFirst({
              where: {
                userId: recipient.id,
                protocolName: position.protocolName,
                assetSymbol: position.assetSymbol,
                status: 'ACTIVE',
              },
              orderBy: { openedAt: 'asc' },
            })

            if (recipientPosition) {
              await tx.position.update({
                where: { id: recipientPosition.id },
                data: {
                  currentValue: { increment: debit },
                  depositedAmount: { increment: principalDebit },
                  yieldEarned: { increment: yieldDebit },
                },
              })
            } else {
              await tx.position.create({
                data: {
                  userId: recipient.id,
                  protocolName: position.protocolName,
                  assetSymbol: position.assetSymbol,
                  assetAddress: position.assetAddress,
                  currentValue: debit,
                  depositedAmount: principalDebit,
                  yieldEarned: yieldDebit,
                },
              })
            }

            remaining = remaining.sub(debit)
          }

          if (remaining.gt(0)) {
            throw new AppError(409, 'Insufficient unlocked balance')
          }

          const [senderTransaction, recipientTransaction] = await Promise.all([
            tx.transaction.create({
              data: {
                userId: input.senderUserId,
                actingAsUserId: input.actingAsUserId ?? null,
                type: TransactionType.INTERNAL_TRANSFER_OUT,
                status: TransactionStatus.CONFIRMED,
                assetSymbol: input.assetSymbol,
                amount: new Prisma.Decimal(input.amount),
                network: freshSender.network,
                memo: input.note ?? null,
                confirmedAt: now,
              },
            }),
            tx.transaction.create({
              data: {
                userId: recipient.id,
                type: TransactionType.INTERNAL_TRANSFER_IN,
                status: TransactionStatus.CONFIRMED,
                assetSymbol: input.assetSymbol,
                amount: new Prisma.Decimal(input.amount),
                network: freshRecipient.network,
                memo: input.note ?? null,
                confirmedAt: now,
              },
            }),
          ])

          const transfer = await tx.internalTransfer.create({
            data: {
              senderUserId: input.senderUserId,
              recipientUserId: recipient.id,
              senderTransactionId: senderTransaction.id,
              recipientTransactionId: recipientTransaction.id,
              recipientHandle: freshRecipient.transferHandle,
              assetSymbol: input.assetSymbol,
              amount: new Prisma.Decimal(input.amount),
              note: input.note ?? null,
              complianceScore: compliance.totalScore,
              complianceModelVersion: compliance.modelVersion,
              complianceReasons: compliance.reasonCodes,
              complianceFeatures: compliance.features as unknown as Prisma.InputJsonValue,
              settledAt: now,
            },
          })

          await tx.auditPayloadHash.create({
            data: {
              tableName: 'internal_transfers',
              kind: 'INTERNAL_TRANSFER_SETTLED',
              payloadHash: auditPayloadHashFor({
                id: transfer.id,
                senderUserId: input.senderUserId,
                recipientUserId: recipient.id,
                senderTransactionId: senderTransaction.id,
                recipientTransactionId: recipientTransaction.id,
                assetSymbol: input.assetSymbol,
                amount: input.amount,
                complianceScore: compliance.totalScore,
                settledAt: transfer.settledAt,
              }),
            },
          })

          return {
            id: transfer.id,
            senderTransactionId: senderTransaction.id,
            recipientTransactionId: recipientTransaction.id,
            recipientHandle: `@${freshRecipient.transferHandle}`,
            amount: Number(transfer.amount),
            assetSymbol: transfer.assetSymbol,
            complianceScore: transfer.complianceScore,
            createdAt: transfer.createdAt,
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      if (attempt < MAX_SERIALIZABLE_ATTEMPTS && isSerializableConflict(error)) {
        continue
      }
      throw error
    }
  }

  throw new AppError(409, 'Transfer could not be serialized; retry safely')
}
