-- CreateEnum
CREATE TYPE "ResellerPayoutMode" AS ENUM ('OWN_PAYSTACK', 'NOMIA_SUBACCOUNT');

-- CreateEnum
CREATE TYPE "ResellerSubaccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- AlterTable
ALTER TABLE "ResellerProfile"
ADD COLUMN "payoutMode" "ResellerPayoutMode" NOT NULL DEFAULT 'OWN_PAYSTACK',
ADD COLUMN "paystackSubaccountCode" TEXT,
ADD COLUMN "paystackSubaccountId" INTEGER,
ADD COLUMN "bankCode" TEXT,
ADD COLUMN "bankName" TEXT,
ADD COLUMN "bankAccountNumber" TEXT,
ADD COLUMN "bankAccountName" TEXT,
ADD COLUMN "subaccountStatus" "ResellerSubaccountStatus",
ADD COLUMN "subaccountVerifiedAt" TIMESTAMP(3),
ADD COLUMN "subaccountFailureReason" TEXT,
ADD COLUMN "platformFeePercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "ResellerCreditTransaction"
ADD COLUMN "payoutMode" "ResellerPayoutMode" NOT NULL DEFAULT 'OWN_PAYSTACK',
ADD COLUMN "paystackSubaccountCode" TEXT;
