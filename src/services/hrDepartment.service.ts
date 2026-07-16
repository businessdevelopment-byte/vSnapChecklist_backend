import { prisma } from "../config/database";
import type { CreateHrDepartmentInput, UpdateHrDepartmentInput } from "../schemas/hrDepartment.schemas";

export const hrDepartmentService = {
  async list() {
    return prisma.hrDepartment.findMany({
      include: { designations: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(id: number) {
    return prisma.hrDepartment.findUnique({
      where: { id },
      include: { designations: true },
    });
  },

  async create(input: CreateHrDepartmentInput) {
    return prisma.hrDepartment.create({
      data: input,
      include: { designations: true },
    });
  },

  async update(id: number, input: UpdateHrDepartmentInput) {
    return prisma.hrDepartment.update({
      where: { id },
      data: input,
      include: { designations: true },
    });
  },

  async delete(id: number) {
    return prisma.hrDepartment.delete({
      where: { id },
    });
  },
};
