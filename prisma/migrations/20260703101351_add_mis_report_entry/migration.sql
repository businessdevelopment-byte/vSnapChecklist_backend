-- CreateTable
CREATE TABLE "mis_report_entries" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "dateStart" DATE NOT NULL,
    "dateEnd" DATE NOT NULL,
    "target" INTEGER NOT NULL,
    "actualWorkDone" INTEGER NOT NULL,
    "workDone" INTEGER NOT NULL,
    "workDoneOnTime" INTEGER NOT NULL,
    "totalWorkDone" INTEGER NOT NULL,
    "weekPending" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mis_report_entries_pkey" PRIMARY KEY ("id")
);
