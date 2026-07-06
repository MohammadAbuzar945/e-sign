-- CreateEnum
CREATE TYPE "ResellerApplicationStatus" AS ENUM ('PENDING', 'TERMS_SENT', 'TERMS_COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResellerProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ResellerCreditTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "ResellerApplication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organisationId" TEXT NOT NULL,
    "applicantUserId" INTEGER NOT NULL,
    "status" "ResellerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termsSentAt" TIMESTAMP(3),
    "termsCompletedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "snapshotOrgName" TEXT NOT NULL,
    "snapshotApplicantName" TEXT NOT NULL,
    "snapshotApplicantEmail" TEXT NOT NULL,
    "snapshotCompletedDocCount" INTEGER NOT NULL,
    "snapshotUniqueSignerCount" INTEGER NOT NULL,
    "snapshotOrgUserCount" INTEGER NOT NULL,
    "snapshotOrgSignupDate" TIMESTAMP(3) NOT NULL,
    "termsTemplateId" TEXT,
    "termsEnvelopeId" TEXT,
    "externalDocGenRequestId" TEXT,

    CONSTRAINT "ResellerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerProfile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organisationId" TEXT NOT NULL,
    "status" "ResellerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "affiliateSlug" TEXT NOT NULL,
    "paystackPublicKey" TEXT,
    "paystackSecretKey" TEXT,
    "paystackCallbackUrl" TEXT,
    "vatNumber" TEXT,
    "allowNegativeCredits" BOOLEAN NOT NULL DEFAULT false,
    "instructionsDismissedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerPackage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resellerProfileId" TEXT NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "catalogPackageId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paystackPlanCode" TEXT,
    "paystackPaymentUrl" TEXT,

    CONSTRAINT "ResellerPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerCreditTransaction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resellerProfileId" TEXT NOT NULL,
    "resellerOrganisationId" TEXT NOT NULL,
    "purchaserOrganisationId" TEXT NOT NULL,
    "purchaserUserId" INTEGER NOT NULL,
    "packageId" TEXT,
    "paystackReference" TEXT,
    "credits" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" "ResellerCreditTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "purchaserName" TEXT NOT NULL,
    "purchaserEmail" TEXT NOT NULL,
    "purchaserOrganisationName" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResellerApplication_organisationId_key" ON "ResellerApplication"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerApplication_termsEnvelopeId_key" ON "ResellerApplication"("termsEnvelopeId");

-- CreateIndex
CREATE INDEX "ResellerApplication_status_idx" ON "ResellerApplication"("status");

-- CreateIndex
CREATE INDEX "ResellerApplication_applicantUserId_idx" ON "ResellerApplication"("applicantUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerProfile_organisationId_key" ON "ResellerProfile"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerProfile_affiliateSlug_key" ON "ResellerProfile"("affiliateSlug");

-- CreateIndex
CREATE INDEX "ResellerProfile_affiliateSlug_idx" ON "ResellerProfile"("affiliateSlug");

-- CreateIndex
CREATE INDEX "ResellerProfile_status_idx" ON "ResellerProfile"("status");

-- CreateIndex
CREATE INDEX "ResellerPackage_resellerProfileId_idx" ON "ResellerPackage"("resellerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerPackage_resellerProfileId_catalogPackageId_key" ON "ResellerPackage"("resellerProfileId", "catalogPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerCreditTransaction_paystackReference_key" ON "ResellerCreditTransaction"("paystackReference");

-- CreateIndex
CREATE INDEX "ResellerCreditTransaction_resellerProfileId_idx" ON "ResellerCreditTransaction"("resellerProfileId");

-- CreateIndex
CREATE INDEX "ResellerCreditTransaction_resellerOrganisationId_idx" ON "ResellerCreditTransaction"("resellerOrganisationId");

-- CreateIndex
CREATE INDEX "ResellerCreditTransaction_purchaserOrganisationId_idx" ON "ResellerCreditTransaction"("purchaserOrganisationId");

-- CreateIndex
CREATE INDEX "ResellerCreditTransaction_status_idx" ON "ResellerCreditTransaction"("status");

-- CreateIndex
CREATE INDEX "ResellerCreditTransaction_createdAt_idx" ON "ResellerCreditTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "ResellerApplication" ADD CONSTRAINT "ResellerApplication_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerApplication" ADD CONSTRAINT "ResellerApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerProfile" ADD CONSTRAINT "ResellerProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerPackage" ADD CONSTRAINT "ResellerPackage_resellerProfileId_fkey" FOREIGN KEY ("resellerProfileId") REFERENCES "ResellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCreditTransaction" ADD CONSTRAINT "ResellerCreditTransaction_resellerProfileId_fkey" FOREIGN KEY ("resellerProfileId") REFERENCES "ResellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCreditTransaction" ADD CONSTRAINT "ResellerCreditTransaction_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ResellerPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
