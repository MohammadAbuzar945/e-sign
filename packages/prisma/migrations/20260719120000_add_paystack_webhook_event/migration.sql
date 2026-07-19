-- CreateEnum
CREATE TYPE "PaystackWebhookEventStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "PaystackWebhookEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "event" TEXT NOT NULL,
    "status" "PaystackWebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "reference" TEXT,
    "customerEmail" TEXT,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaystackWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaystackWebhookEvent_event_idx" ON "PaystackWebhookEvent"("event");

-- CreateIndex
CREATE INDEX "PaystackWebhookEvent_status_idx" ON "PaystackWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "PaystackWebhookEvent_createdAt_idx" ON "PaystackWebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PaystackWebhookEvent_reference_idx" ON "PaystackWebhookEvent"("reference");

-- CreateIndex
CREATE INDEX "PaystackWebhookEvent_customerEmail_idx" ON "PaystackWebhookEvent"("customerEmail");
