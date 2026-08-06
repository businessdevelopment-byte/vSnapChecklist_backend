-- CreateEnum
CREATE TYPE "DelegationReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "delegation_history" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "DelegationReviewStatus",
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" INTEGER;

-- CreateIndex
CREATE INDEX "delegation_history_reviewStatus_createdAt_idx" ON "delegation_history"("reviewStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "delegation_history" ADD CONSTRAINT "delegation_history_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
