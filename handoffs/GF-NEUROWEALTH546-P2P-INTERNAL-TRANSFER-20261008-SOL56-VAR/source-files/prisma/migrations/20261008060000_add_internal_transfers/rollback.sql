-- Rollback for #546 internal-transfer tables/handle.
-- PostgreSQL enum labels cannot be removed safely in-place while retaining
-- arbitrary dependent history, so the two TransactionType labels intentionally
-- remain available after a rollback. They are harmless once the table/route are gone.

DROP TABLE IF EXISTS "internal_transfers";
DROP INDEX IF EXISTS "users_transferHandle_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "transferHandle";
