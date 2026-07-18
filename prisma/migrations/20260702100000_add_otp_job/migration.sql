-- CreateEnum
CREATE TYPE "OtpJobStage" AS ENUM ('ORDER_RECEIVED', 'ASSIGN_MEMBER', 'RE_CONFIRMATION', 'PHOTOGRAPHER_ALLOTMENT', 'PHOTOGRAPHER_SEARCH', 'FINAL_PHOTOGRAPHER', 'PHOTOGRAPHER_BRIEFING', 'MAKE_TOKEN', 'STORY_BRIEFING', 'MOODBOARD_CREATION', 'CLIENT_BRIEFING_BEFORE_SHOOT', 'PHOTOGRAPHER_BRIEFING_BEFORE_SHOOT', 'MOODBOARD_DELIVERY_TO_CLIENT');

-- CreateTable
CREATE TABLE "otp_jobs" (
    "id" SERIAL NOT NULL,
    "jobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "jobGenre" TEXT NOT NULL,
    "customIdName" TEXT,
    "customId" TEXT,
    "salesExecutive" TEXT NOT NULL,
    "jobDate" DATE NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "jobTime" TEXT NOT NULL,
    "pocName" TEXT NOT NULL,
    "pocContact" TEXT NOT NULL,
    "pocWhatsapp" TEXT,
    "pocEmail" TEXT,
    "poc2ndEmail" TEXT,
    "jobCity" TEXT NOT NULL,
    "jobShootAddress" TEXT NOT NULL,
    "jobSpecification" TEXT,
    "deliverables" TEXT,
    "packageAmount" DECIMAL(12,2) NOT NULL,
    "operationsCost" DECIMAL(12,2) NOT NULL,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "gst" DECIMAL(12,2) NOT NULL,
    "packageAmountWithTax" DECIMAL(12,2) NOT NULL,
    "isTokenReceived" BOOLEAN NOT NULL DEFAULT false,
    "currentStage" "OtpJobStage" NOT NULL DEFAULT 'ORDER_RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "otp_jobs_jobId_key" ON "otp_jobs"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "otp_jobs_projectId_key" ON "otp_jobs"("projectId");

-- CreateIndex
CREATE INDEX "otp_jobs_currentStage_idx" ON "otp_jobs"("currentStage");

-- CreateIndex
CREATE INDEX "otp_jobs_jobDate_idx" ON "otp_jobs"("jobDate");
