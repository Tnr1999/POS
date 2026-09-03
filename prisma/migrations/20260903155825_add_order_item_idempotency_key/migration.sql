-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_idempotencyKey_key" ON "OrderItem"("idempotencyKey");
