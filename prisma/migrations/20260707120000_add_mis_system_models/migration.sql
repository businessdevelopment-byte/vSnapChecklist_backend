-- CreateTable
CREATE TABLE "mis_records" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "phone" TEXT,
    "dateStart" DATE NOT NULL,
    "dateEnd" DATE NOT NULL,
    "target" INTEGER NOT NULL,
    "actualWorkDone" INTEGER NOT NULL,
    "weeklyWorkDone" INTEGER NOT NULL,
    "weeklyWorkDoneOnTime" INTEGER NOT NULL,
    "totalWorkDone" INTEGER NOT NULL,
    "weekPending" INTEGER NOT NULL,
    "allPendingTillDate" INTEGER NOT NULL,
    "plannedWorkNotDone" INTEGER NOT NULL DEFAULT 0,
    "plannedWorkNotDoneOnTime" INTEGER NOT NULL DEFAULT 0,
    "commitment" TEXT,
    "nextWeekPlannedNotDone" INTEGER,
    "nextWeekPlannedNotDoneOnTime" INTEGER,
    "nextWeekCommitment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mis_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mis_archived_commitments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "dateStart" DATE NOT NULL,
    "dateEnd" DATE NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 0,
    "actualWorkDone" INTEGER NOT NULL DEFAULT 0,
    "workNotDone" INTEGER NOT NULL DEFAULT 0,
    "workNotDoneOnTime" INTEGER NOT NULL DEFAULT 0,
    "totalWorkDone" INTEGER NOT NULL DEFAULT 0,
    "weekPending" INTEGER NOT NULL DEFAULT 0,
    "allPendingTillDate" INTEGER NOT NULL DEFAULT 0,
    "lastWeekPlannedNotDone" INTEGER,
    "lastWeekPlannedNotDoneOnTime" INTEGER,
    "lastWeekCommitment" TEXT,
    "nextWeekPlannedNotDone" INTEGER,
    "nextWeekPlannedNotDoneOnTime" INTEGER,
    "nextWeekCommitment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mis_archived_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mis_kpi_kra_entries" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "kpi" TEXT NOT NULL,
    "kra" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "achieved" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "period" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mis_kpi_kra_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mis_tasks" (
    "id" SERIAL NOT NULL,
    "fmsName" TEXT,
    "taskName" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "todayTask" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mis_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mis_records_name_idx" ON "mis_records"("name");

-- CreateIndex
CREATE INDEX "mis_records_dateStart_idx" ON "mis_records"("dateStart");

-- CreateIndex
CREATE INDEX "mis_archived_commitments_dateStart_idx" ON "mis_archived_commitments"("dateStart");

-- CreateIndex
CREATE UNIQUE INDEX "mis_archived_commitments_name_dateStart_key" ON "mis_archived_commitments"("name", "dateStart");

-- CreateIndex
CREATE INDEX "mis_kpi_kra_entries_department_idx" ON "mis_kpi_kra_entries"("department");

-- CreateIndex
CREATE INDEX "mis_tasks_status_idx" ON "mis_tasks"("status");

-- CreateIndex
CREATE INDEX "mis_tasks_dueDate_idx" ON "mis_tasks"("dueDate");

