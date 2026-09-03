-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;
