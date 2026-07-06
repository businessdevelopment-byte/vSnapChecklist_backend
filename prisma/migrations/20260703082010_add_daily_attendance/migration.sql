-- CreateTable
CREATE TABLE "daily_attendance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "day" TEXT NOT NULL,
    "holiday" TEXT NOT NULL,
    "workingDay" TEXT NOT NULL,
    "nHoliday" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inTime" TEXT,
    "outTime" TEXT,
    "workingHours" TEXT NOT NULL,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyOut" INTEGER NOT NULL DEFAULT 0,
    "overtimeHours" TEXT NOT NULL,
    "punchMiss" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_attendance_employeeId_date_key" ON "daily_attendance"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "daily_attendance" ADD CONSTRAINT "daily_attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
