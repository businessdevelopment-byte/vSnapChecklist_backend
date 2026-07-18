-- CreateTable
CREATE TABLE "follow_ups" (
    "id" SERIAL NOT NULL,
    "enquiryId" INTEGER NOT NULL,
    "enquiryNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Interested',
    "candidateSays" TEXT NOT NULL,
    "nextDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_ups_enquiryId_idx" ON "follow_ups"("enquiryId");

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
