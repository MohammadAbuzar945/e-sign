CREATE TABLE "PendingCreditReseal" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organisationId" TEXT NOT NULL,
  "documentId" INTEGER NOT NULL,
  "teamId" INTEGER NOT NULL,
  "creditsRequired" INTEGER NOT NULL,
  "lastRetriedAt" TIMESTAMP(3),
  "lastError" TEXT,

  CONSTRAINT "PendingCreditReseal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingCreditReseal_documentId_key"
ON "PendingCreditReseal"("documentId");

CREATE INDEX "PendingCreditReseal_organisationId_createdAt_idx"
ON "PendingCreditReseal"("organisationId", "createdAt");

ALTER TABLE "PendingCreditReseal"
ADD CONSTRAINT "PendingCreditReseal_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
