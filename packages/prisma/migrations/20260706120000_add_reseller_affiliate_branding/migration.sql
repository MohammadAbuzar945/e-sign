-- AlterTable
ALTER TABLE "ResellerProfile" ADD COLUMN     "brandingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brandingLogo" TEXT,
ADD COLUMN     "brandingUrl" TEXT,
ADD COLUMN     "brandingCompanyDetails" TEXT;
