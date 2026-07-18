-- Baseline migration documenting schema that already exists in the live
-- database but was never captured in migration history (applied via an
-- untracked `prisma db push` at some point before 2026-07-17). This
-- migration is applied via `prisma migrate resolve --applied` — it is NOT
-- executed against the database, only recorded as already-applied, so
-- migration history matches the real DB state going forward. See
-- docs/migration/DECISIONS.md and .claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md
-- item #30 for the incident this resolves.

-- CreateEnum
CREATE TYPE "HrGender" AS ENUM ('MALE', 'FEMALE', 'ANY');
CREATE TYPE "VacancyPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "VacancyStatus" AS ENUM ('NEED_MORE', 'INTERVIEWING', 'ON_HOLD', 'CLOSED');
CREATE TYPE "VacancyApprovalStatus" AS ENUM ('PENDING', 'PENDING_HR', 'APPROVED', 'REJECTED');
CREATE TYPE "JobApplicationSource" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "JobApplicationStage" AS ENUM ('APPLIED', 'FOLLOW_UP', 'INTERVIEW', 'SELECTED', 'OFFER_RELEASED', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'VERIFIED', 'HIRED', 'REJECTED', 'ON_HOLD', 'RESIGNED');

-- CreateTable
CREATE TABLE "hr_departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "hodName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hr_departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hr_departments_name_key" ON "hr_departments"("name");

-- CreateTable
CREATE TABLE "designations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "designations_departmentId_idx" ON "designations"("departmentId");
ALTER TABLE "designations" ADD CONSTRAINT "designations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "vacancies" (
    "id" SERIAL NOT NULL,
    "vacancyNumber" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "vacancyName" TEXT,
    "designationId" INTEGER NOT NULL,
    "gender" "HrGender" NOT NULL,
    "numberOfPosts" INTEGER NOT NULL,
    "completionDate" TIMESTAMP(3) NOT NULL,
    "salaryCriteria" TEXT,
    "jobDescription" TEXT,
    "preferredQualification" TEXT,
    "preferredLocation" TEXT,
    "preferredExperience" TEXT,
    "experienceRequired" BOOLEAN NOT NULL DEFAULT false,
    "socialPlatforms" TEXT,
    "postingLinks" JSONB,
    "priority" "VacancyPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "VacancyStatus" NOT NULL DEFAULT 'NEED_MORE',
    "approvalStatus" "VacancyApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionRemark" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vacancies_vacancyNumber_key" ON "vacancies"("vacancyNumber");
CREATE UNIQUE INDEX "vacancies_shareToken_key" ON "vacancies"("shareToken");
CREATE INDEX "vacancies_status_idx" ON "vacancies"("status");
CREATE INDEX "vacancies_approvalStatus_idx" ON "vacancies"("approvalStatus");
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "job_applications" (
    "id" SERIAL NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "vacancyId" INTEGER NOT NULL,
    "source" "JobApplicationSource" NOT NULL DEFAULT 'EXTERNAL',
    "stage" "JobApplicationStage" NOT NULL DEFAULT 'APPLIED',
    "nextFollowUpDate" TIMESTAMP(3),
    "interviewDate" TIMESTAMP(3),
    "interviewMode" TEXT,
    "interviewRemark" TEXT,
    "selectionRemark" TEXT,
    "offeredDesignation" TEXT,
    "offeredSalary" DECIMAL(12,2),
    "offeredBaseSalary" DECIMAL(12,2),
    "offeredAllowanceSalary" DECIMAL(12,2),
    "offeredJoiningDate" TIMESTAMP(3),
    "offerStatus" TEXT,
    "offerRemark" TEXT,
    "documentChecklist" JSONB,
    "documentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationRemark" TEXT,
    "candidateName" TEXT NOT NULL,
    "candidateDob" TIMESTAMP(3),
    "candidatePhone" TEXT NOT NULL,
    "candidateEmail" TEXT,
    "maritalStatus" TEXT,
    "presentAddress" TEXT,
    "aadharNo" TEXT,
    "previousCompany" TEXT,
    "previousCompanyNoticePeriod" TEXT,
    "jobExperience" TEXT,
    "lastSalary" DECIMAL(12,2),
    "previousPosition" TEXT,
    "reasonForLeaving" TEXT,
    "lastEmployerMobile" TEXT,
    "referenceBy" TEXT,
    "candidatePhoto" TEXT,
    "candidateResume" TEXT,
    "salarySlip" TEXT,
    "experienceLetter" TEXT,
    "relievingLetter" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "job_applications_applicationNumber_key" ON "job_applications"("applicationNumber");
CREATE INDEX "job_applications_vacancyId_idx" ON "job_applications"("vacancyId");
CREATE INDEX "job_applications_stage_idx" ON "job_applications"("stage");
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (employees HR-SS extensions)
ALTER TABLE "employees"
  ADD COLUMN "aadharAddress" TEXT,
  ADD COLUMN "allowanceSalary" DECIMAL(12,2),
  ADD COLUMN "baseSalary" DECIMAL(12,2),
  ADD COLUMN "dateOfBirth" DATE,
  ADD COLUMN "designationId" INTEGER,
  ADD COLUMN "employeeCode" TEXT,
  ADD COLUMN "employmentType" TEXT,
  ADD COLUMN "maritalStatus" TEXT,
  ADD COLUMN "presentAddress" TEXT,
  ADD COLUMN "vacancyId" INTEGER,
  ADD COLUMN "jobApplicationId" INTEGER;

CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");
CREATE INDEX "employees_employeeCode_idx" ON "employees"("employeeCode");
CREATE UNIQUE INDEX "employees_jobApplicationId_key" ON "employees"("jobApplicationId");

ALTER TABLE "employees" ADD CONSTRAINT "employees_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
