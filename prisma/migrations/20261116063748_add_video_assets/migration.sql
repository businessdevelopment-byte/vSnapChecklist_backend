-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "checklist_entries" ADD COLUMN     "sampleVideoId" TEXT;

-- AlterTable
ALTER TABLE "delegation_tasks" ADD COLUMN     "sampleVideoId" TEXT;

-- AlterTable
ALTER TABLE "task_templates" ADD COLUMN     "sampleVideoId" TEXT;

-- CreateTable
CREATE TABLE "video_assets" (
    "id" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'UPLOADING',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "ext" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "receivedBytes" BIGINT NOT NULL DEFAULT 0,
    "durationSec" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "renditions" JSONB,
    "processingProgress" INTEGER NOT NULL DEFAULT 0,
    "hasOriginal" BOOLEAN NOT NULL DEFAULT false,
    "hasPoster" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "uploadedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_assets_status_updatedAt_idx" ON "video_assets"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "video_assets_uploadedById_status_idx" ON "video_assets"("uploadedById", "status");

-- CreateIndex
CREATE INDEX "checklist_entries_sampleVideoId_idx" ON "checklist_entries"("sampleVideoId");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_sampleVideoId_fkey" FOREIGN KEY ("sampleVideoId") REFERENCES "video_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_sampleVideoId_fkey" FOREIGN KEY ("sampleVideoId") REFERENCES "video_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_tasks" ADD CONSTRAINT "delegation_tasks_sampleVideoId_fkey" FOREIGN KEY ("sampleVideoId") REFERENCES "video_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
