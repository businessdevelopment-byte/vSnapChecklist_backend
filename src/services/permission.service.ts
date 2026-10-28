import { prisma } from "../config/database";
import type { AssignSectionPermissionInput, RemoveSectionPermissionInput } from "../schemas/permission.schemas";

/** Checklist's Admin Approve page — grantable to staff, with the same reach as an admin. */
export const ADMIN_APPROVE_SECTION = "checklist-delegation:admin-approve";

// A user's departments: their primary one plus every UserDepartment link
// (Manage Users edits the links, My Profile edits the primary — count both).
async function departmentIdsOf(userId: number): Promise<number[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true, departments: { select: { departmentId: true } } },
  });
  if (!user) return [];
  const ids = new Set(user.departments.map((d) => d.departmentId));
  if (user.departmentId) ids.add(user.departmentId);
  return [...ids];
}

export const permissionService = {
  /** Sections granted to this user personally (what the Users tab edits). */
  async getUserPermissions(userId: number): Promise<string[]> {
    const permissions = await prisma.sectionPermission.findMany({
      where: { userId },
      select: { sectionKey: true },
    });
    return permissions.map((p: { sectionKey: string }) => p.sectionKey);
  },

  /**
   * Everything the user can open: their own grants + every grant of their
   * departments + the defaults every staff user gets. What the sidebar and
   * section-gated APIs go by.
   */
  async getEffectivePermissions(userId: number): Promise<string[]> {
    const departmentIds = await departmentIdsOf(userId);
    const [own, fromDepartments, defaults] = await Promise.all([
      prisma.sectionPermission.findMany({ where: { userId }, select: { sectionKey: true } }),
      departmentIds.length > 0
        ? prisma.departmentSectionPermission.findMany({
            where: { departmentId: { in: departmentIds } },
            select: { sectionKey: true },
          })
        : Promise.resolve([]),
      prisma.defaultSectionPermission.findMany({ select: { sectionKey: true } }),
    ]);
    return [...new Set([...own, ...fromDepartments, ...defaults].map((p) => p.sectionKey))].sort();
  },

  /** Admins can open every section; anyone else needs it in their effective access. */
  async canAccessSection(user: { userId: number; role: string }, sectionKey: string): Promise<boolean> {
    if (user.role === "ADMIN") return true;
    return (await this.getEffectivePermissions(user.userId)).includes(sectionKey);
  },

  async assignSectionPermissions(input: AssignSectionPermissionInput) {
    const { userId, sectionKeys } = input;

    await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const existingPermissions = await prisma.sectionPermission.findMany({
      where: { userId },
      select: { sectionKey: true },
    });
    const existingKeys = new Set(existingPermissions.map((p: { sectionKey: string }) => p.sectionKey));

    const newKeys = sectionKeys.filter((key: string) => !existingKeys.has(key));

    if (newKeys.length > 0) {
      await prisma.sectionPermission.createMany({
        data: newKeys.map((sectionKey: string) => ({
          userId,
          sectionKey,
        })),
        skipDuplicates: true,
      });
    }

    return this.getUserPermissions(userId);
  },

  async removeSectionPermissions(input: RemoveSectionPermissionInput) {
    const { userId, sectionKeys } = input;

    await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    await prisma.sectionPermission.deleteMany({
      where: {
        userId,
        sectionKey: {
          in: sectionKeys,
        },
      },
    });

    return this.getUserPermissions(userId);
  },

  async setUserPermissions(userId: number, sectionKeys: string[]) {
    await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    await prisma.sectionPermission.deleteMany({
      where: { userId },
    });

    if (sectionKeys.length > 0) {
      await prisma.sectionPermission.createMany({
        data: sectionKeys.map((sectionKey) => ({
          userId,
          sectionKey,
        })),
      });
    }

    return this.getUserPermissions(userId);
  },

  async getAllUserPermissions() {
    const permissions = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        departmentId: true,
        departments: { select: { departmentId: true } },
        sectionPermissions: {
          select: { sectionKey: true },
        },
      },
      where: { status: "ACTIVE" },
    });

    return permissions.map((user) => ({
      userId: user.id,
      username: user.username,
      role: user.role,
      // Lets the Users tab show which department a section is inherited from.
      departmentIds: [
        ...new Set([
          ...user.departments.map((d) => d.departmentId),
          ...(user.departmentId ? [user.departmentId] : []),
        ]),
      ],
      sections: user.sectionPermissions.map((p: { sectionKey: string }) => p.sectionKey),
    }));
  },

  /** Every department with its granted sections and how many people it holds. */
  async getDepartmentPermissions() {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sectionPermissions: { select: { sectionKey: true } },
        users: { where: { status: "ACTIVE" }, select: { id: true } },
        userLinks: { where: { user: { status: "ACTIVE" } }, select: { userId: true } },
      },
    });
    return departments.map((d) => ({
      departmentId: d.id,
      name: d.name,
      userCount: new Set([...d.users.map((u) => u.id), ...d.userLinks.map((l) => l.userId)]).size,
      sections: d.sectionPermissions.map((p) => p.sectionKey),
    }));
  },

  async setDepartmentPermissions(departmentId: number, sectionKeys: string[]) {
    await prisma.department.findUniqueOrThrow({ where: { id: departmentId } });
    await prisma.$transaction([
      prisma.departmentSectionPermission.deleteMany({ where: { departmentId } }),
      prisma.departmentSectionPermission.createMany({
        data: [...new Set(sectionKeys)].map((sectionKey) => ({ departmentId, sectionKey })),
      }),
    ]);
    const rows = await prisma.departmentSectionPermission.findMany({ where: { departmentId }, select: { sectionKey: true } });
    return rows.map((r) => r.sectionKey);
  },

  async getDefaultPermissions(): Promise<string[]> {
    const rows = await prisma.defaultSectionPermission.findMany({ orderBy: { sectionKey: "asc" } });
    return rows.map((r) => r.sectionKey);
  },

  async setDefaultPermissions(sectionKeys: string[]) {
    await prisma.$transaction([
      prisma.defaultSectionPermission.deleteMany({}),
      prisma.defaultSectionPermission.createMany({
        data: [...new Set(sectionKeys)].map((sectionKey) => ({ sectionKey })),
      }),
    ]);
    return this.getDefaultPermissions();
  },
};
