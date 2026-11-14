-- CreateEnum
CREATE TYPE "SheetSyncTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'CATCH_UP');

-- CreateEnum
CREATE TYPE "SheetSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "sheet_sync_runs" (
    "id" SERIAL NOT NULL,
    "trigger" "SheetSyncTrigger" NOT NULL,
    "status" "SheetSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "checklistRows" INTEGER,
    "delegationRows" INTEGER,
    "error" TEXT,
    "triggeredByUserId" INTEGER,

    CONSTRAINT "sheet_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sheet_sync_runs_status_startedAt_idx" ON "sheet_sync_runs"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "sheet_sync_runs" ADD CONSTRAINT "sheet_sync_runs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
