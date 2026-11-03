import { prisma } from "../config/database";
import type { ImportDepartmentsInput } from "../schemas/department.schemas";

// Everything that points at a department. Templates, checklist rows and
// delegation tasks are ON DELETE RESTRICT, so a department any of them uses
// can't be deleted at all; members (primary or extra department) would be
// silently detached, so they block it too.
const USAGE_COUNT = {
  users: true,
  userLinks: true,
  taskTemplates: true,
  checklistEntries: true,
  delegationTasks: true,
} as const;

type DepartmentUsage = { [K in keyof typeof USAGE_COUNT]: number };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function inUseReason(c: DepartmentUsage): string | null {
  const parts = [
    Math.max(c.users, c.userLinks) > 0 ? plural(Math.max(c.users, c.userLinks), "user") : "",
    c.taskTemplates > 0 ? plural(c.taskTemplates, "recurring task") : "",
    c.checklistEntries > 0 ? plural(c.checklistEntries, "checklist record") : "",
    c.delegationTasks > 0 ? plural(c.delegationTasks, "delegation task") : "",
  ].filter(Boolean);
  return parts.length ? `used by ${parts.join(", ")}` : null;
}

// A user or task can land in the department between the usage check and the
// delete; the foreign key then refuses it — report that instead of the raw error.
function rethrowIfNowInUse(err: unknown): never {
  if ((err as { code?: string }).code === "P2003") {
    throw Object.assign(
      new Error("A department was just given users or tasks — refresh and try again"),
      { status: 409 }
    );
  }
  throw err;
}

const cleanName = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim();

export const departmentService = {
  async getAll(withUsage = false) {
    return prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: withUsage ? USAGE_COUNT : { users: true } } },
    });
  },

  async create(name: string, givenBy?: string) {
    return prisma.department.create({ data: { name, givenBy } });
  },

  async update(id: number, data: { name?: string; givenBy?: string }) {
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) throw Object.assign(new Error("Department not found"), { status: 404 });
    return prisma.department.update({ where: { id }, data });
  },

  async remove(id: number) {
    const dept = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: USAGE_COUNT } },
    });
    if (!dept) throw Object.assign(new Error("Department not found"), { status: 404 });
    const reason = inUseReason(dept._count);
    if (reason)
      throw Object.assign(
        new Error(`Cannot delete "${dept.name}" — ${reason}. Move them to another department first.`),
        { status: 409 }
      );
    await prisma.department.delete({ where: { id } }).catch(rethrowIfNowInUse);
    return { id };
  },

  /**
   * Creates every department in the list that doesn't exist yet. Names match
   * ignoring case and extra spaces (the same way imports match them), so
   * "editing " in a sheet never creates a second "Editing". Existing ones are
   * left untouched.
   */
  async importMany(rows: ImportDepartmentsInput["rows"]) {
    const existing = await prisma.department.findMany({ select: { name: true } });
    const known = new Set(existing.map(d => cleanName(d.name).toLowerCase()));

    const toCreate: { name: string; givenBy?: string }[] = [];
    const skipped: string[] = [];
    for (const row of rows) {
      const name = cleanName(row.name);
      if (!name) continue;
      const key = name.toLowerCase();
      if (known.has(key)) { skipped.push(name); continue; }
      known.add(key);
      toCreate.push({ name, givenBy: row.givenBy || undefined });
    }

    if (toCreate.length) await prisma.department.createMany({ data: toCreate, skipDuplicates: true });
    return { created: toCreate.map(d => d.name), skipped };
  },

  /**
   * Deletes the selected departments nothing uses any more; the rest are
   * skipped with the reason, never force-deleted.
   */
  async removeMany(ids: number[]) {
    const depts = await prisma.department.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, _count: { select: USAGE_COUNT } },
      orderBy: { name: "asc" },
    });

    const deletable: { id: number; name: string }[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const d of depts) {
      const reason = inUseReason(d._count);
      if (reason) skipped.push({ name: d.name, reason });
      else deletable.push({ id: d.id, name: d.name });
    }

    if (deletable.length) {
      await prisma.department
        .deleteMany({ where: { id: { in: deletable.map(d => d.id) } } })
        .catch(rethrowIfNowInUse);
    }
    return { deleted: deletable.map(d => d.name), skipped };
  },
};
