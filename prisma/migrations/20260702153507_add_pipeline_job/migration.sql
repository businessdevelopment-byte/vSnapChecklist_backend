-- CreateEnum
CREATE TYPE "PipelineType" AS ENUM ('PMS', 'POLITICAL');

-- CreateTable
CREATE TABLE "pipeline_jobs" (
    "id" SERIAL NOT NULL,
    "pipelineType" "PipelineType" NOT NULL,
    "jobId" TEXT NOT NULL,
    "projectId" TEXT,
    "client" TEXT NOT NULL,
    "jobGenre" TEXT,
    "customIdName" TEXT,
    "customId" TEXT,
    "salesExecutive" TEXT,
    "jobDate" DATE,
    "deliveryDate" DATE,
    "jobTime" TEXT,
    "pocName" TEXT,
    "pocContact" TEXT,
    "pocWhatsapp" TEXT,
    "pocEmail" TEXT,
    "poc2ndEmail" TEXT,
    "jobCity" TEXT,
    "jobShootAddress" TEXT,
    "jobSpecification" TEXT,
    "deliverables" TEXT,
    "currentStage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stage_events" (
    "id" SERIAL NOT NULL,
    "pipelineJobId" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_jobs_jobId_key" ON "pipeline_jobs"("jobId");

-- CreateIndex
CREATE INDEX "pipeline_jobs_pipelineType_currentStage_idx" ON "pipeline_jobs"("pipelineType", "currentStage");

-- CreateIndex
CREATE INDEX "pipeline_stage_events_pipelineJobId_idx" ON "pipeline_stage_events"("pipelineJobId");

-- CreateIndex
CREATE INDEX "pipeline_stage_events_stage_idx" ON "pipeline_stage_events"("stage");

-- AddForeignKey
ALTER TABLE "pipeline_stage_events" ADD CONSTRAINT "pipeline_stage_events_pipelineJobId_fkey" FOREIGN KEY ("pipelineJobId") REFERENCES "pipeline_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
