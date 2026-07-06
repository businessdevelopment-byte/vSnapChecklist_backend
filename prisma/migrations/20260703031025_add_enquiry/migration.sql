-- CreateTable
CREATE TABLE "enquiries" (
    "id" SERIAL NOT NULL,
    "candidateEnquiryNo" TEXT NOT NULL,
    "indentId" INTEGER NOT NULL,
    "indentNo" TEXT NOT NULL,
    "applyingForPost" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateDOB" DATE,
    "candidatePhone" TEXT NOT NULL,
    "candidateEmail" TEXT,
    "previousCompany" TEXT,
    "jobExperience" TEXT,
    "previousPosition" TEXT,
    "maritalStatus" TEXT NOT NULL DEFAULT 'Single',
    "presentAddress" TEXT,
    "aadharNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enquiries_candidateEnquiryNo_key" ON "enquiries"("candidateEnquiryNo");

-- CreateIndex
CREATE INDEX "enquiries_status_idx" ON "enquiries"("status");

-- CreateIndex
CREATE INDEX "enquiries_indentId_idx" ON "enquiries"("indentId");

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "indents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
