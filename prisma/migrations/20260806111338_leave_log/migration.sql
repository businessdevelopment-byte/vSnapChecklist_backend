-- CreateTable
CREATE TABLE "leave_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "markedByUserId" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_logs_userId_markedAt_idx" ON "leave_logs"("userId", "markedAt");

-- AddForeignKey
ALTER TABLE "leave_logs" ADD CONSTRAINT "leave_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_logs" ADD CONSTRAINT "leave_logs_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
