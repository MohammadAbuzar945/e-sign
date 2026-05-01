-- CreateEnum
CREATE TYPE "KbaMode" AS ENUM ('PER_ENVELOPE', 'PER_RECIPIENT');

-- CreateEnum
CREATE TYPE "KbaScopeType" AS ENUM ('ENVELOPE', 'RECIPIENT');

-- CreateEnum
CREATE TYPE "KbaAnswerType" AS ENUM ('STRING', 'NUMERIC', 'MCQ');

-- CreateTable
CREATE TABLE "EnvelopeKbaPolicy" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "mode" "KbaMode" NOT NULL DEFAULT 'PER_ENVELOPE',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvelopeKbaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbaChallenge" (
    "id" TEXT NOT NULL,
    "scopeType" "KbaScopeType" NOT NULL,
    "answerType" "KbaAnswerType" NOT NULL,
    "question" TEXT NOT NULL,
    "answerHash" TEXT NOT NULL,
    "mcqOptions" JSONB,
    "mcqCorrectOptionKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "envelopeId" TEXT,
    "recipientId" INTEGER,

    CONSTRAINT "KbaChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbaAttempt" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbaAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvelopeKbaPolicy_envelopeId_key" ON "EnvelopeKbaPolicy"("envelopeId");

-- CreateIndex
CREATE INDEX "KbaChallenge_envelopeId_idx" ON "KbaChallenge"("envelopeId");

-- CreateIndex
CREATE INDEX "KbaChallenge_recipientId_idx" ON "KbaChallenge"("recipientId");

-- CreateIndex
CREATE INDEX "KbaChallenge_scopeType_isActive_idx" ON "KbaChallenge"("scopeType", "isActive");

-- CreateIndex
CREATE INDEX "KbaAttempt_challengeId_attemptedAt_idx" ON "KbaAttempt"("challengeId", "attemptedAt");

-- CreateIndex
CREATE INDEX "KbaAttempt_recipientId_attemptedAt_idx" ON "KbaAttempt"("recipientId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "EnvelopeKbaPolicy" ADD CONSTRAINT "EnvelopeKbaPolicy_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbaChallenge" ADD CONSTRAINT "KbaChallenge_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbaChallenge" ADD CONSTRAINT "KbaChallenge_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbaAttempt" ADD CONSTRAINT "KbaAttempt_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "KbaChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbaAttempt" ADD CONSTRAINT "KbaAttempt_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
