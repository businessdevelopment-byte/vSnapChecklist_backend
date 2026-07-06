-- CreateTable
CREATE TABLE "indents" (
    "id" SERIAL NOT NULL,
    "indentNumber" TEXT NOT NULL,
    "post" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'Male',
    "prefer" TEXT NOT NULL DEFAULT 'Fresher',
    "noOfPost" INTEGER NOT NULL,
    "completionDate" DATE NOT NULL,
    "socialSite" TEXT NOT NULL DEFAULT 'LinkedIn',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "indents_indentNumber_key" ON "indents"("indentNumber");

-- CreateIndex
CREATE INDEX "indents_status_idx" ON "indents"("status");
