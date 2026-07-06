-- CreateTable
CREATE TABLE "company_calendar_events" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_calendar_events_pkey" PRIMARY KEY ("id")
);
