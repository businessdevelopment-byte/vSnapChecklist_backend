-- Documents, after the fact, the removal of the old MIS system's tables.
-- Migration history recorded 20260703101351_add_mis_report_entry and
-- 20260707120000_add_mis_system_models as applied, but those tables were
-- actually dropped via raw `prisma db execute` on 2026-07-17 when the old
-- MIS backend was deleted (see docs/migration/DECISIONS.md). This migration
-- is applied via `prisma migrate resolve --applied` — not executed — since
-- the tables are already gone; it exists only to make migration history
-- match the live database.

DROP TABLE IF EXISTS "mis_task_history" CASCADE;
DROP TABLE IF EXISTS "mis_tasks" CASCADE;
DROP TABLE IF EXISTS "mis_kpi_kra_entries" CASCADE;
DROP TABLE IF EXISTS "mis_archived_commitments" CASCADE;
DROP TABLE IF EXISTS "mis_records" CASCADE;
DROP TABLE IF EXISTS "mis_report_entries" CASCADE;
