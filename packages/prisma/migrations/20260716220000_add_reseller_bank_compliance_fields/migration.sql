-- CreateEnum
CREATE TYPE "ResellerVatStatus" AS ENUM ('NOT_REGISTERED', 'REGISTERED');

-- AlterTable
ALTER TABLE "ResellerProfile" ADD COLUMN     "vatStatus" "ResellerVatStatus",
ADD COLUMN     "physicalAddress" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "bankDetailsConfirmedAt" TIMESTAMP(3);
