-- AlterTable
ALTER TABLE "pipeline_jobs" ADD COLUMN     "politicalProjectOrderId" INTEGER;

-- CreateTable
CREATE TABLE "political_project_orders" (
    "id" SERIAL NOT NULL,
    "projectOrderId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "reportingPersonName" TEXT,
    "reportingPersonWhatsapp" TEXT,
    "reportingGroupName" TEXT,
    "instagramPages" TEXT,
    "currentFollowers" TEXT,
    "openingViews" TEXT,
    "monthlyViewsTarget" TEXT,
    "remarks" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "political_project_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "political_project_orders_projectOrderId_key" ON "political_project_orders"("projectOrderId");

-- CreateIndex
CREATE INDEX "political_project_orders_createdAt_idx" ON "political_project_orders"("createdAt");

-- CreateIndex
CREATE INDEX "pipeline_jobs_politicalProjectOrderId_idx" ON "pipeline_jobs"("politicalProjectOrderId");

-- AddForeignKey
ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_politicalProjectOrderId_fkey" FOREIGN KEY ("politicalProjectOrderId") REFERENCES "political_project_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "political_project_orders" ADD CONSTRAINT "political_project_orders_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
