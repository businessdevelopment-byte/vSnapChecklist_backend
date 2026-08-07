-- AlterTable
ALTER TABLE "otp_jobs" ADD COLUMN     "assignedMember" TEXT;

-- AlterTable
ALTER TABLE "pipeline_jobs" ADD COLUMN     "assignedMember" TEXT;

-- CreateIndex
CREATE INDEX "otp_jobs_assignedMember_idx" ON "otp_jobs"("assignedMember");

-- CreateIndex
CREATE INDEX "pipeline_jobs_assignedMember_idx" ON "pipeline_jobs"("assignedMember");
