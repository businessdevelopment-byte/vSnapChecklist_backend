-- AlterTable
ALTER TABLE "checklist_entries" ADD COLUMN     "completionVideoId" TEXT;

-- AlterTable
ALTER TABLE "delegation_history" ADD COLUMN     "videoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "checklist_entries_completionVideoId_key" ON "checklist_entries"("completionVideoId");

-- CreateIndex
CREATE UNIQUE INDEX "delegation_history_videoId_key" ON "delegation_history"("videoId");

-- AddForeignKey
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_completionVideoId_fkey" FOREIGN KEY ("completionVideoId") REFERENCES "video_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_history" ADD CONSTRAINT "delegation_history_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "video_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

