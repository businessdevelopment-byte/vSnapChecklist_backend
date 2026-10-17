-- AlterTable
ALTER TABLE "delegation_history" ADD COLUMN     "importedAt" TIMESTAMP(3);

-- Backfill: the previous CSV importer auto-approved every "Done" row without
-- a reviewer, while an in-app approval always records reviewedByUserId. Mark
-- those import-made rows so a re-import can correct them (e.g. to honour the
-- sheet's Admin Done column).
UPDATE "delegation_history"
SET "importedAt" = "createdAt"
WHERE "reviewStatus" = 'APPROVED'
  AND "reviewedByUserId" IS NULL
  AND "reviewedAt" IS NOT NULL;
