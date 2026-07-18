import { prisma } from "../config/database";
import type { CreateDesignationInput, UpdateDesignationInput } from "../schemas/designation.schemas";

export const designationService = {
  async list() {
    return prisma.designation.findMany({
      include: { department: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(id: number) {
    return prisma.designation.findUnique({
      where: { id },
      include: { department: true },
    });
  },

  async create(input: CreateDesignationInput) {
    return prisma.designation.create({
      data: input,
      include: { department: true },
    });
  },

  async update(id: number, input: UpdateDesignationInput) {
    return prisma.designation.update({
      where: { id },
      data: input,
      include: { department: true },
    });
  },

  async delete(id: number) {
    return prisma.designation.delete({
      where: { id },
    });
  },
};
