-- CreateTable
CREATE TABLE "department_section_permissions" (
    "departmentId" INTEGER NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_section_permissions_pkey" PRIMARY KEY ("departmentId","sectionKey")
);

-- CreateTable
CREATE TABLE "default_section_permissions" (
    "sectionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "default_section_permissions_pkey" PRIMARY KEY ("sectionKey")
);

-- AddForeignKey
ALTER TABLE "department_section_permissions" ADD CONSTRAINT "department_section_permissions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every staff user's starting access to the Checklist & Delegation system.
-- Editable afterwards in Settings → Permissions → Default Access.
INSERT INTO "default_section_permissions" ("sectionKey") VALUES
    ('checklist-delegation:dashboard'),
    ('checklist-delegation:checklist'),
    ('checklist-delegation:delegation'),
    ('checklist-delegation:calendar')
ON CONFLICT ("sectionKey") DO NOTHING;
