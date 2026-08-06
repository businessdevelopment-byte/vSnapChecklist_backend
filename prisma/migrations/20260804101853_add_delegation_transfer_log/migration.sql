-- AlterTable
ALTER TABLE "task_transfer_logs" ADD COLUMN     "delegationTaskId" INTEGER;

-- CreateIndex
CREATE INDEX "task_transfer_logs_delegationTaskId_idx" ON "task_transfer_logs"("delegationTaskId");

-- AddForeignKey
ALTER TABLE "task_transfer_logs" ADD CONSTRAINT "task_transfer_logs_delegationTaskId_fkey" FOREIGN KEY ("delegationTaskId") REFERENCES "delegation_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
