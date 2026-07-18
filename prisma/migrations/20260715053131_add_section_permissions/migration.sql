-- CreateTable
CREATE TABLE "section_permissions" (
    "userId" INTEGER NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_permissions_pkey" PRIMARY KEY ("userId","sectionKey")
);

-- CreateIndex
CREATE INDEX "section_permissions_userId_idx" ON "section_permissions"("userId");

-- AddForeignKey
ALTER TABLE "section_permissions" ADD CONSTRAINT "section_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
