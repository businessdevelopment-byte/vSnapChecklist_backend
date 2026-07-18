-- CreateTable
CREATE TABLE "monthly_attendance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "punchDays" INTEGER NOT NULL,
    "totalOnTime" INTEGER NOT NULL,
    "lateDays" INTEGER NOT NULL,
    "lateNotAllowed" INTEGER NOT NULL,
    "lateAllowed" INTEGER NOT NULL,
    "punchMiss" INTEGER NOT NULL,
    "holidays" INTEGER NOT NULL,
    "absents" INTEGER NOT NULL,
    "totalWorking" INTEGER NOT NULL,
    "mgmtAdjustment" INTEGER NOT NULL DEFAULT 0,
    "grandTotalDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_attendance_employeeId_year_month_key" ON "monthly_attendance"("employeeId", "year", "month");

-- AddForeignKey
ALTER TABLE "monthly_attendance" ADD CONSTRAINT "monthly_attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
