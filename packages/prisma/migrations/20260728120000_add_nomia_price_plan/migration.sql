-- CreateEnum
CREATE TYPE "NomiaPricePlanCategory" AS ENUM ('PAYG', 'MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "NomiaPricePlan" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "NomiaPricePlanCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "paystackPlanCodeTest" TEXT NOT NULL,
    "paystackPlanCodeLive" TEXT NOT NULL,
    "paystackPaymentUrlTest" TEXT,
    "paystackPaymentUrlLive" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NomiaPricePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NomiaPricePlan_category_sortOrder_idx" ON "NomiaPricePlan"("category", "sortOrder");
CREATE INDEX "NomiaPricePlan_isEnabled_idx" ON "NomiaPricePlan"("isEnabled");
CREATE INDEX "NomiaPricePlan_paystackPlanCodeTest_idx" ON "NomiaPricePlan"("paystackPlanCodeTest");
CREATE INDEX "NomiaPricePlan_paystackPlanCodeLive_idx" ON "NomiaPricePlan"("paystackPlanCodeLive");

-- Seed current hardcoded catalog
INSERT INTO "NomiaPricePlan" (
  "id", "createdAt", "updatedAt", "category", "name", "credits", "priceInCents", "currency",
  "paystackPlanCodeTest", "paystackPlanCodeLive", "paystackPaymentUrlTest", "paystackPaymentUrlLive",
  "isEnabled", "sortOrder"
) VALUES
  ('payg-20', NOW(), NOW(), 'PAYG', '20 envelopes', 20, 19000, 'ZAR', 'PLN_bit1oy0ayiqpkdu', 'PLN_qcz1c2zdiyk3lw3', NULL, NULL, true, 10),
  ('payg-50', NOW(), NOW(), 'PAYG', '50 envelopes', 50, 45000, 'ZAR', 'PLN_59961ig3ply5r3s', 'PLN_jw0og1p6hc4oz9d', NULL, NULL, true, 20),
  ('payg-100', NOW(), NOW(), 'PAYG', '100 envelopes', 100, 85000, 'ZAR', 'PLN_ktbomtrjkiz73i1', 'PLN_arl2oksyipcd4aq', NULL, NULL, true, 30),
  ('payg-200', NOW(), NOW(), 'PAYG', '200 envelopes', 200, 160000, 'ZAR', 'PLN_kxqcw02dow71g6c', 'PLN_y1fcc9z6et50sx3', NULL, NULL, true, 40),
  ('payg-500', NOW(), NOW(), 'PAYG', '500 envelopes', 500, 375000, 'ZAR', 'PLN_5nmok91ploz44u6', 'PLN_9n7qj5gj3462buu', NULL, NULL, true, 50),
  ('payg-1000', NOW(), NOW(), 'PAYG', '1000 envelopes', 1000, 700000, 'ZAR', 'PLN_f54sm9jv38v7r5m', 'PLN_aiohn8rtai2dtq1', NULL, NULL, true, 60),
  ('monthly-20', NOW(), NOW(), 'MONTHLY', '20 envelopes', 20, 17000, 'ZAR', 'PLN_1croxh14pyq4cj7', 'PLN_4yptquhayqxdx68', NULL, NULL, true, 110),
  ('monthly-50', NOW(), NOW(), 'MONTHLY', '50 envelopes', 50, 40000, 'ZAR', 'PLN_zel9llutx085dp9', 'PLN_m0iv4x08zo10128', NULL, NULL, true, 120),
  ('monthly-100', NOW(), NOW(), 'MONTHLY', '100 envelopes', 100, 75000, 'ZAR', 'PLN_yvo5ujkxt1diiak', 'PLN_hhfxiemem179vbl', NULL, NULL, true, 130),
  ('monthly-200', NOW(), NOW(), 'MONTHLY', '200 envelopes', 200, 140000, 'ZAR', 'PLN_0oqk4fljy5uais0', 'PLN_4lu7sf9rbtotr2n', NULL, NULL, true, 140),
  ('monthly-500', NOW(), NOW(), 'MONTHLY', '500 envelopes', 500, 325000, 'ZAR', 'PLN_27yc6cxtga9huy7', 'PLN_b3xu6wzwym77ifa', NULL, NULL, true, 150),
  ('monthly-1000', NOW(), NOW(), 'MONTHLY', '1000 envelopes', 1000, 600000, 'ZAR', 'PLN_q4qbiwreibc8qr5', 'PLN_sat4vs3qy4btmjj', NULL, NULL, true, 160),
  ('annual-240', NOW(), NOW(), 'ANNUAL', '240 envelopes', 240, 170000, 'ZAR', 'PLN_coac3n7m4jo59ct', 'PLN_9xcixnz5a5kh14x', NULL, NULL, true, 210),
  ('annual-600', NOW(), NOW(), 'ANNUAL', '600 envelopes', 600, 400000, 'ZAR', 'PLN_8kh731h1ojcx37d', 'PLN_aq2fdnx8jpzxnuf', NULL, NULL, true, 220),
  ('annual-1200', NOW(), NOW(), 'ANNUAL', '1200 envelopes', 1200, 750000, 'ZAR', 'PLN_tzngz1lbhvxnufb', 'PLN_4od24fxbpa947cw', NULL, NULL, true, 230),
  ('annual-2400', NOW(), NOW(), 'ANNUAL', '2400 envelopes', 2400, 1400000, 'ZAR', 'PLN_kn6j6ur12pedilo', 'PLN_lybvu4aaf5ry1jf', NULL, NULL, true, 240),
  ('annual-6000', NOW(), NOW(), 'ANNUAL', '6000 envelopes', 6000, 3250000, 'ZAR', 'PLN_moko1x694rvm5l8', 'PLN_tdlrkbcuxy1w91v', NULL, NULL, true, 250),
  ('annual-12000', NOW(), NOW(), 'ANNUAL', '12000 envelopes', 12000, 6000000, 'ZAR', 'PLN_scnf05tt3vrui2i', 'PLN_60j0btaxtinfc7j', NULL, NULL, true, 260)
ON CONFLICT ("id") DO NOTHING;
