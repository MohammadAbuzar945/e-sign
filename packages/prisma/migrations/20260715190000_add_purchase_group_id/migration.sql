-- Link split hybrid purchases (reseller portion + Nomia remainder) for invoices and history.
ALTER TABLE "OrganisationCreditPurchase" ADD COLUMN "purchaseGroupId" TEXT;
ALTER TABLE "ResellerCreditTransaction" ADD COLUMN "purchaseGroupId" TEXT;

CREATE INDEX "OrganisationCreditPurchase_purchaseGroupId_idx" ON "OrganisationCreditPurchase"("purchaseGroupId");
CREATE INDEX "ResellerCreditTransaction_purchaseGroupId_idx" ON "ResellerCreditTransaction"("purchaseGroupId");
