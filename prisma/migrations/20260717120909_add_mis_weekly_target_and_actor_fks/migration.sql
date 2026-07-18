-- CreateEnum
CREATE TYPE "MisSystemKey" AS ENUM ('CHECKLIST_DELEGATION', 'ORDER_TO_PAYMENT', 'PMS', 'POLITICAL', 'HR');

-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "createdByUserId" INTEGER;

-- AlterTable
ALTER TABLE "follow_ups" ADD COLUMN     "createdByUserId" INTEGER;

-- AlterTable
ALTER TABLE "indents" ADD COLUMN     "createdByUserId" INTEGER;

-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "createdByUserId" INTEGER;

-- AlterTable
ALTER TABLE "otp_stage_events" ADD COLUMN     "actorUserId" INTEGER;

-- AlterTable
ALTER TABLE "pipeline_stage_events" ADD COLUMN     "actorUserId" INTEGER;

-- CreateTable
CREATE TABLE "mis_weekly_targets" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "systemKey" "MisSystemKey" NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "target" INTEGER NOT NULL,
    "setByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mis_weekly_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mis_weekly_targets_systemKey_weekStart_idx" ON "mis_weekly_targets"("systemKey", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "mis_weekly_targets_userId_systemKey_weekStart_key" ON "mis_weekly_targets"("userId", "systemKey", "weekStart");

-- CreateIndex
CREATE INDEX "enquiries_createdByUserId_createdAt_idx" ON "enquiries"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "follow_ups_createdByUserId_createdAt_idx" ON "follow_ups"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "indents_createdByUserId_createdAt_idx" ON "indents"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "job_applications_createdByUserId_createdAt_idx" ON "job_applications"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "otp_stage_events_actorUserId_createdAt_idx" ON "otp_stage_events"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "pipeline_stage_events_actorUserId_createdAt_idx" ON "pipeline_stage_events"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "otp_stage_events" ADD CONSTRAINT "otp_stage_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stage_events" ADD CONSTRAINT "pipeline_stage_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indents" ADD CONSTRAINT "indents_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mis_weekly_targets" ADD CONSTRAINT "mis_weekly_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mis_weekly_targets" ADD CONSTRAINT "mis_weekly_targets_setByUserId_fkey" FOREIGN KEY ("setByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
