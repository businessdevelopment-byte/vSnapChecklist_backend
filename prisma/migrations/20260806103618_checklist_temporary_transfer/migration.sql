-- AlterTable
ALTER TABLE "checklist_entries" ADD COLUMN     "transferValidUntil" DATE;

-- AlterTable
ALTER TABLE "task_transfer_logs" ADD COLUMN     "validFrom" DATE,
ADD COLUMN     "validUntil" DATE;
