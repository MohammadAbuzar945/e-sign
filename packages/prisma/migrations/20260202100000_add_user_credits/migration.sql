-- CreateTable
CREATE TABLE "UserCredits" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserCredits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCredits_userId_idx" ON "UserCredits"("userId");

-- CreateIndex
CREATE INDEX "UserCredits_isActive_idx" ON "UserCredits"("isActive");

-- AddForeignKey
ALTER TABLE "UserCredits" ADD CONSTRAINT "UserCredits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
