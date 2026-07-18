import { prisma } from "../config/database";
import type { AssignSectionPermissionInput, RemoveSectionPermissionInput } from "../schemas/permission.schemas";

export const permissionService = {
  async getUserPermissions(userId: number): Promise<string[]> {
    const permissions = await prisma.sectionPermission.findMany({
      where: { userId },
      select: { sectionKey: true },
    });
    return permissions.map((p: { sectionKey: string }) => p.sectionKey);
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
        sectionPermissions: {
          select: { sectionKey: true },
        },
      },
      where: { status: "ACTIVE" },
    });

    return permissions.map((user: any) => ({
      userId: user.id,
      username: user.username,
      role: user.role,
      sections: user.sectionPermissions.map((p: { sectionKey: string }) => p.sectionKey),
    }));
  },
};
