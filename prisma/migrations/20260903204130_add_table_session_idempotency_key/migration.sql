-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TableSession_idempotencyKey_key" ON "TableSession"("idempotencyKey");
