-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tableSessionId" TEXT;

-- CreateTable
CREATE TABLE "TableSession" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableSession_token_key" ON "TableSession"("token");

-- CreateIndex
CREATE INDEX "TableSession_tableId_idx" ON "TableSession"("tableId");

-- CreateIndex
CREATE INDEX "TableSession_status_idx" ON "TableSession"("status");

-- CreateIndex
CREATE INDEX "Order_tableSessionId_idx" ON "Order"("tableSessionId");

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (hand-authored, not representable in schema.prisma)
-- Enforces "at most one ACTIVE TableSession per Table" at the DB level, as
-- a last-resort safety net. A plain @@unique([tableId]) would be wrong (it
-- would also forbid a table ever having more than one CLOSED session in
-- its history), and Prisma's schema language has no declarative syntax for
-- a partial/conditional unique index, so this constraint exists only here.
-- The primary defense against a duplicate ACTIVE session is a Table row
-- lock in the Phase 2D.2 session-lifecycle server actions (not yet
-- implemented) - this index only catches what that lock should already
-- have prevented.
CREATE UNIQUE INDEX "TableSession_one_active_per_table" ON "TableSession"("tableId") WHERE "status" = 'ACTIVE';
