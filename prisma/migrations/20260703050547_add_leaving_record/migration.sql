-- CreateTable
CREATE TABLE "leaving_records" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "dateOfLeaving" DATE NOT NULL,
    "mobileNumber" TEXT,
    "reasonOfLeaving" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaving_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leaving_records_employeeId_key" ON "leaving_records"("employeeId");

-- AddForeignKey
ALTER TABLE "leaving_records" ADD CONSTRAINT "leaving_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
