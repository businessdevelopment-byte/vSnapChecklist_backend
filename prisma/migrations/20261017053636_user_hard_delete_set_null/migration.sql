-- DropForeignKey
ALTER TABLE "delegation_history" DROP CONSTRAINT "delegation_history_submittedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "leave_logs" DROP CONSTRAINT "leave_logs_markedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "mis_weekly_targets" DROP CONSTRAINT "mis_weekly_targets_setByUserId_fkey";

-- DropForeignKey
ALTER TABLE "task_transfer_logs" DROP CONSTRAINT "task_transfer_logs_fromUserId_fkey";

-- DropForeignKey
ALTER TABLE "task_transfer_logs" DROP CONSTRAINT "task_transfer_logs_toUserId_fkey";

-- DropForeignKey
ALTER TABLE "task_transfer_logs" DROP CONSTRAINT "task_transfer_logs_transferredByUserId_fkey";

-- DropForeignKey
ALTER TABLE "transfer_requests" DROP CONSTRAINT "transfer_requests_requestedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "transfer_requests" DROP CONSTRAINT "transfer_requests_toUserId_fkey";

-- AlterTable
ALTER TABLE "delegation_history" ALTER COLUMN "submittedByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "leave_logs" ALTER COLUMN "markedByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "mis_weekly_targets" ALTER COLUMN "setByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "task_transfer_logs" ALTER COLUMN "fromUserId" DROP NOT NULL,
ALTER COLUMN "toUserId" DROP NOT NULL,
ALTER COLUMN "transferredByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "transfer_requests" ALTER COLUMN "toUserId" DROP NOT NULL,
ALTER COLUMN "requestedByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "delegation_history" ADD CONSTRAINT "delegation_history_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_logs" ADD CONSTRAINT "task_transfer_logs_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_logs" ADD CONSTRAINT "task_transfer_logs_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_logs" ADD CONSTRAINT "task_transfer_logs_transferredByUserId_fkey" FOREIGN KEY ("transferredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_logs" ADD CONSTRAINT "leave_logs_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mis_weekly_targets" ADD CONSTRAINT "mis_weekly_targets_setByUserId_fkey" FOREIGN KEY ("setByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
