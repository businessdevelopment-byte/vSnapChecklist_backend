import { prisma } from "../config/database";

export const departmentService = {
  async getAll() {
    return prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
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
      include: { _count: { select: { users: true } } },
    });
    if (!dept) throw Object.assign(new Error("Department not found"), { status: 404 });
    if (dept._count.users > 0)
      throw Object.assign(
        new Error(`Cannot delete — ${dept._count.users} user(s) are assigned to this department`),
        { status: 409 }
      );
    await prisma.department.delete({ where: { id } });
    return { id };
  },
};
