-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "changeAmount" INTEGER,
ADD COLUMN     "discountAmount" INTEGER,
ADD COLUMN     "grandTotalAmount" INTEGER,
ADD COLUMN     "paidAmount" INTEGER,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "serviceChargeAmount" INTEGER,
ADD COLUMN     "serviceChargeRate" INTEGER,
ADD COLUMN     "subtotalAmount" INTEGER,
ADD COLUMN     "taxAmount" INTEGER,
ADD COLUMN     "taxRate" INTEGER;
