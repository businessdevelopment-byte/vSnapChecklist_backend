-- One project can have multiple jobs (repeat bookings under the same
-- vsnapu project id); only jobId is guaranteed unique.
DROP INDEX "otp_jobs_projectId_key";

CREATE INDEX "otp_jobs_projectId_idx" ON "otp_jobs"("projectId");
