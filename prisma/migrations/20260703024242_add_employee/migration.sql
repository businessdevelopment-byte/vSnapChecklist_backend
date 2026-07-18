-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "joiningNo" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "fatherName" TEXT,
    "dateOfJoining" DATE NOT NULL,
    "joiningPlace" TEXT,
    "designation" TEXT NOT NULL,
    "salary" DECIMAL(12,2) NOT NULL,
    "mobileNo" TEXT NOT NULL,
    "familyMobileNo" TEXT,
    "relationWithFamily" TEXT,
    "email" TEXT,
    "companyName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "gender" TEXT,
    "aadharNo" TEXT,
    "currentAddress" TEXT,
    "addressAsPerAadhar" TEXT,
    "bodAsPerAadhar" DATE,
    "pfEligible" TEXT,
    "esicEligible" TEXT,
    "accountNo" TEXT,
    "ifscCode" TEXT,
    "branchName" TEXT,
    "paymentMode" TEXT,
    "modeOfAttendance" TEXT,
    "qualification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_joiningNo_key" ON "employees"("joiningNo");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");
