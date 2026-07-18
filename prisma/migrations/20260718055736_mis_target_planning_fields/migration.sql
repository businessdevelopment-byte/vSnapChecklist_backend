-- AlterTable
ALTER TABLE "mis_weekly_targets" ADD COLUMN     "commitment" TEXT,
ADD COLUMN     "plannedNotDoneOnTimePct" INTEGER,
ADD COLUMN     "plannedNotDonePct" INTEGER,
ALTER COLUMN "target" DROP NOT NULL;
