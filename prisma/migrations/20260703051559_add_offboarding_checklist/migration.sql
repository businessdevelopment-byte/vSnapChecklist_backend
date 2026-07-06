-- CreateTable
CREATE TABLE "offboarding_checklists" (
    "id" SERIAL NOT NULL,
    "leavingRecordId" INTEGER NOT NULL,
    "resignationLetterReceived" BOOLEAN NOT NULL DEFAULT false,
    "resignationAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "handoverOfAssets" BOOLEAN NOT NULL DEFAULT false,
    "idCard" BOOLEAN NOT NULL DEFAULT false,
    "visitingCard" BOOLEAN NOT NULL DEFAULT false,
    "cancellationOfEmailId" BOOLEAN NOT NULL DEFAULT false,
    "biometricAccess" BOOLEAN NOT NULL DEFAULT false,
    "removeBenefitEnrollment" BOOLEAN NOT NULL DEFAULT false,
    "finalReleaseDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offboarding_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offboarding_checklists_leavingRecordId_key" ON "offboarding_checklists"("leavingRecordId");

-- AddForeignKey
ALTER TABLE "offboarding_checklists" ADD CONSTRAINT "offboarding_checklists_leavingRecordId_fkey" FOREIGN KEY ("leavingRecordId") REFERENCES "leaving_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
