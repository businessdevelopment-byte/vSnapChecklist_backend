-- CreateTable
CREATE TABLE "onboarding_checklists" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "checkSalarySlipResume" BOOLEAN NOT NULL DEFAULT false,
    "offerLetterReceived" BOOLEAN NOT NULL DEFAULT false,
    "welcomeMeeting" BOOLEAN NOT NULL DEFAULT false,
    "biometricAccess" BOOLEAN NOT NULL DEFAULT false,
    "officialEmailId" BOOLEAN NOT NULL DEFAULT false,
    "assignAssets" BOOLEAN NOT NULL DEFAULT false,
    "pfEsic" BOOLEAN NOT NULL DEFAULT false,
    "companyDirectory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_checklists_employeeId_key" ON "onboarding_checklists"("employeeId");

-- AddForeignKey
ALTER TABLE "onboarding_checklists" ADD CONSTRAINT "onboarding_checklists_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
