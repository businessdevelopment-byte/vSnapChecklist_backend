-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'ALTERNATE_DAY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'END_OF_1ST_WEEK', 'END_OF_2ND_WEEK', 'END_OF_3RD_WEEK', 'END_OF_4TH_WEEK', 'END_OF_LAST_WEEK');

-- CreateEnum
CREATE TYPE "DelegationFrequency" AS ENUM ('ONE_TIME', 'CRITICAL', 'URGENT');

-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('PENDING', 'PLANNED', 'VERIFY_PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('YES', 'NO', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "HistoryStatus" AS ENUM ('DONE', 'EXTEND_DATE');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "departmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "givenBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" SERIAL NOT NULL,
    "taskCode" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "givenBy" TEXT NOT NULL,
    "assignedUserId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "lastDate" DATE,
    "frequency" "Frequency" NOT NULL,
    "enableReminders" BOOLEAN NOT NULL DEFAULT true,
    "requireAttachment" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_entries" (
    "id" BIGSERIAL NOT NULL,
    "templateId" INTEGER,
    "taskCode" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "givenBy" TEXT NOT NULL,
    "assignedUserId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "taskStartDate" DATE NOT NULL,
    "taskStartTime" TEXT,
    "frequency" "Frequency" NOT NULL,
    "enableReminders" BOOLEAN NOT NULL DEFAULT true,
    "requireAttachment" BOOLEAN NOT NULL DEFAULT false,
    "actualDate" DATE,
    "delayDays" INTEGER,
    "completionStatus" "CompletionStatus",
    "remarks" TEXT,
    "uploadedImageUrl" TEXT,
    "adminDone" BOOLEAN NOT NULL DEFAULT false,
    "leaveStatus" BOOLEAN NOT NULL DEFAULT false,
    "transferredToId" INTEGER,
    "remarks1" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_tasks" (
    "id" SERIAL NOT NULL,
    "taskCode" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "givenBy" TEXT NOT NULL,
    "assignedUserId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "taskStartDate" TIMESTAMP(3) NOT NULL,
    "frequency" "DelegationFrequency" NOT NULL,
    "enableReminders" BOOLEAN NOT NULL DEFAULT true,
    "requireAttachment" BOOLEAN NOT NULL DEFAULT false,
    "status" "DelegationStatus" NOT NULL DEFAULT 'PENDING',
    "rating" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_history" (
    "id" SERIAL NOT NULL,
    "delegationTaskId" INTEGER NOT NULL,
    "submittedByUserId" INTEGER NOT NULL,
    "submissionDate" DATE NOT NULL,
    "status" "HistoryStatus" NOT NULL,
    "nextTargetDate" DATE,
    "remarks" TEXT,
    "imageUrl" TEXT,
    "taskDescription" TEXT NOT NULL,
    "givenBy" TEXT,
    "adminDoneStatus" TEXT,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegation_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_transfer_logs" (
    "id" SERIAL NOT NULL,
    "checklistEntryId" BIGINT,
    "templateId" INTEGER,
    "fromUserId" INTEGER NOT NULL,
    "toUserId" INTEGER NOT NULL,
    "transferredByUserId" INTEGER NOT NULL,
    "reason" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_transfer_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_logs" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "task_templates_taskCode_key" ON "task_templates"("taskCode");

-- CreateIndex
CREATE INDEX "task_templates_assignedUserId_isActive_idx" ON "task_templates"("assignedUserId", "isActive");

-- CreateIndex
CREATE INDEX "task_templates_frequency_startDate_idx" ON "task_templates"("frequency", "startDate");

-- CreateIndex
CREATE INDEX "task_templates_departmentId_idx" ON "task_templates"("departmentId");

-- CreateIndex
CREATE INDEX "checklist_entries_assignedUserId_taskStartDate_idx" ON "checklist_entries"("assignedUserId", "taskStartDate");

-- CreateIndex
CREATE INDEX "checklist_entries_assignedUserId_taskStartDate_actualDate_idx" ON "checklist_entries"("assignedUserId", "taskStartDate", "actualDate");

-- CreateIndex
CREATE INDEX "checklist_entries_taskStartDate_assignedUserId_idx" ON "checklist_entries"("taskStartDate", "assignedUserId");

-- CreateIndex
CREATE INDEX "checklist_entries_departmentId_taskStartDate_idx" ON "checklist_entries"("departmentId", "taskStartDate");

-- CreateIndex
CREATE INDEX "checklist_entries_templateId_taskStartDate_idx" ON "checklist_entries"("templateId", "taskStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_entries_templateId_taskStartDate_key" ON "checklist_entries"("templateId", "taskStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "delegation_tasks_taskCode_key" ON "delegation_tasks"("taskCode");

-- CreateIndex
CREATE INDEX "delegation_tasks_assignedUserId_status_idx" ON "delegation_tasks"("assignedUserId", "status");

-- CreateIndex
CREATE INDEX "delegation_tasks_taskStartDate_status_idx" ON "delegation_tasks"("taskStartDate", "status");

-- CreateIndex
CREATE INDEX "delegation_tasks_departmentId_idx" ON "delegation_tasks"("departmentId");

-- CreateIndex
CREATE INDEX "delegation_tasks_assignedUserId_isDeleted_status_idx" ON "delegation_tasks"("assignedUserId", "isDeleted", "status");

-- CreateIndex
CREATE INDEX "delegation_history_delegationTaskId_idx" ON "delegation_history"("delegationTaskId");

-- CreateIndex
CREATE INDEX "delegation_history_submittedByUserId_submissionDate_idx" ON "delegation_history"("submittedByUserId", "submissionDate");

-- CreateIndex
CREATE INDEX "task_transfer_logs_checklistEntryId_idx" ON "task_transfer_logs"("checklistEntryId");

-- CreateIndex
CREATE INDEX "task_transfer_logs_fromUserId_transferredAt_idx" ON "task_transfer_logs"("fromUserId", "transferredAt");

-- CreateIndex
CREATE INDEX "task_transfer_logs_toUserId_transferredAt_idx" ON "task_transfer_logs"("toUserId", "transferredAt");

-- CreateIndex
CREATE INDEX "attendance_logs_userId_loginAt_idx" ON "attendance_logs"("userId", "loginAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_transferredToId_fkey" FOREIGN KEY ("transferredToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_tasks" ADD CONSTRAINT "delegation_tasks_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_tasks" ADD CONSTRAINT "delegation_tasks_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_history" ADD CONSTRAINT "delegation_history_delegationTaskId_fkey" FOREIGN KEY ("delegationTaskId") REFERENCES "delegation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_history" ADD CONSTRAINT "delegation_history_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_logs" ADD CONSTRAINT "task_transfer_logs_checklistEntryId_fkey" FOREIGN KEY ("checklistEntryId") REFERENCES "checklist_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_logs" ADD CONSTRAINT "task_transfer_logs_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_logs" ADD CONSTRAINT "task_transfer_logs_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_logs" ADD CONSTRAINT "task_transfer_logs_transferredByUserId_fkey" FOREIGN KEY ("transferredByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
