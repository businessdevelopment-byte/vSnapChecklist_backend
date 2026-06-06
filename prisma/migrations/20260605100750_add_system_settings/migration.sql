-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "skipSundays" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
