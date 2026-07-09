import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  MisTaskQueryInput,
  CreateMisTaskInput,
  UpdateMisTaskInput,
} from "../schemas/misTask.schemas";

export const misTaskService = {
  async list(query: MisTaskQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.MisTaskWhereInput = {};
    if (query.search) {
      // Matches both source pages' search fields: person, task, FMS/project
      // (TodayTasks.jsx:50-54, PendingTasks.jsx:48-52)
      where.OR = [
        { personName: { contains: query.search, mode: "insensitive" } },
        { taskName: { contains: query.search, mode: "insensitive" } },
        { fmsName: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.personName) {
      where.personName = { equals: query.personName, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      prisma.misTask.findMany({
        where,
        skip,
        take,
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      }),
      prisma.misTask.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateMisTaskInput) {
    const { dueDate, ...rest } = input;
    return prisma.misTask.create({
      data: {
        ...rest,
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      } satisfies Prisma.MisTaskUncheckedCreateInput,
    });
  },

  async update(id: number, input: UpdateMisTaskInput) {
    const existing = await prisma.misTask.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error("MIS task not found"), { status: 404 });
    }
    const { dueDate, ...rest } = input;
    return prisma.misTask.update({
      where: { id },
      data: {
        ...rest,
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
    });
  },

  async remove(id: number) {
    const existing = await prisma.misTask.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error("MIS task not found"), { status: 404 });
    }
    await prisma.misTask.delete({ where: { id } });
    return { id };
  },
};
