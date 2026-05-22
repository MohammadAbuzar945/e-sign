-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN "includeQrCodeInCertificate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "includeQrCodeInCertificate" BOOLEAN;

-- AlterTable
ALTER TABLE "Envelope" ADD COLUMN "includeQrCodeInCertificate" BOOLEAN;
