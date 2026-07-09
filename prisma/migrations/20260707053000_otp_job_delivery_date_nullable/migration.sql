-- The vsnapu source frequently has no delivery date set yet at job-creation
-- time (~62% null in a sampled range) — not an edge case.
ALTER TABLE "otp_jobs" ALTER COLUMN "deliveryDate" DROP NOT NULL;
