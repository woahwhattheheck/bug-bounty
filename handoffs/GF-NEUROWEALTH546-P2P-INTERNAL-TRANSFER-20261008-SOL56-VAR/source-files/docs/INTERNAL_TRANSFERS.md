# Internal peer-to-peer transfers

`POST /api/v1/transfer` moves ownership of the same asset between two
NeuroWealth users without a Stellar round trip. Settlement is a single
serializable database transaction: the sender's unlocked positions are debited
and the recipient receives the same protocol/asset slices. No network fee or
external transaction hash is created.

## Public handles and privacy

Users claim a case-normalized public transfer handle with
`PUT /api/v1/transfer/handle`. Handles contain 3-32 lowercase letters,
numbers, or underscores and are unique. The transfer route is the recipient
lookup surface and is protected by the sensitive-action rate limiter, so there
is no unauthenticated handle-enumeration endpoint. Missing and inactive
recipients intentionally collapse to the same `Recipient unavailable` error.

## Safety and authorization

- self-transfers are rejected;
- sender and recipient must be active and on the same configured network;
- only ACTIVE positions for the requested asset are considered;
- any position backing an ACTIVE collateral loan is excluded from available
  balance before the debit;
- delegated sends use the existing WITHDRAW sub-account middleware;
- when the acting user is also the recipient sub-account's parent, the existing
  DEPOSIT permission gate must be ACTIVE before settlement;
- the entire debit/credit plus paired transaction records runs at SERIALIZABLE
  isolation and retries serialization conflicts, so concurrent sends cannot
  create value.

A transfer records `INTERNAL_TRANSFER_OUT` for the sender and
`INTERNAL_TRANSFER_IN` for the recipient. The immutable transfer row keeps the
paired transaction ids, public handle snapshot, compliance result, and settle
timestamp. An `AuditPayloadHash` receipt is written in the same transaction.

## Compliance

Internal transfers are not exempt money movement. The existing #321 scorer now
treats internal IN/OUT rows as money movement for velocity and structuring
features. The sender also gets the NEW_DESTINATION signal when the recipient
has not appeared in that sender's prior internal-transfer history. The score,
model version, reason codes and feature snapshot are persisted on the transfer
for compliance review.

## Tax/accounting treatment

An internal transfer is recorded as a transfer, not as an external
`WITHDRAWAL`/`DEPOSIT`. The on-chain event tax hooks therefore do **not**
create a new cost-basis lot or a disposal for these two internal ledger rows.
QuickBooks/Xero exports classify OUT as `Transfer Out` and IN as
`Transfer In`.

That treatment describes NeuroWealth's bookkeeping behavior only. A payment,
gift, or change of beneficial ownership between different people can still have
jurisdiction-specific tax consequences outside the platform's cost-basis
engine.

## Recall policy

v1 settles immediately. The optional recall window proposed in #546 is kept
**off**: exposing a reversible state would weaken the instant-settlement
guarantee and require separate recipient-spend reservation semantics. A later
feature can add recall only with an explicit pending-state model.
