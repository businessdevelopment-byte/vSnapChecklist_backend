-- CreateTable
CREATE TABLE "otp_stage_events" (
    "id" SERIAL NOT NULL,
    "otpJobId" INTEGER NOT NULL,
    "stage" "OtpJobStage" NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_stage_events_otpJobId_idx" ON "otp_stage_events"("otpJobId");

-- CreateIndex
CREATE INDEX "otp_stage_events_stage_idx" ON "otp_stage_events"("stage");

-- AddForeignKey
ALTER TABLE "otp_stage_events" ADD CONSTRAINT "otp_stage_events_otpJobId_fkey" FOREIGN KEY ("otpJobId") REFERENCES "otp_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
