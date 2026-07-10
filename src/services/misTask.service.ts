import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import { resolveOwnMisName } from "./misRecord.service";
import type {
  MisTaskQueryInput,
  CreateMisTaskInput,
  UpdateMisTaskInput,
} from "../schemas/misTask.schemas";

export const misTaskService = {
  async list(query: MisTaskQueryInput, requester: { userId: number; role: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const conditions: Prisma.MisTaskWhereInput[] = [];
    if (query.search) {
      // Matches both source pages' search fields: person, task, FMS/project
      // (TodayTasks.jsx:50-54, PendingTasks.jsx:48-52)
      conditions.push({
        OR: [
          { personName: { contains: query.search, mode: "insensitive" } },
          { taskName: { contains: query.search, mode: "insensitive" } },
          { fmsName: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (query.status) {
      conditions.push({ status: query.status });
    }
    if (query.personName) {
      conditions.push({ personName: { equals: query.personName, mode: "insensitive" } });
    }
    // Mirrors misRecord.service.ts's own-name scoping — a non-admin should
    // only see their own tasks, not the whole team's.
    if (requester.role !== "ADMIN") {
      const ownName = await resolveOwnMisName(requester.userId);
      conditions.push({ personName: { equals: ownName, mode: "insensitive" } });
    }
    const where: Prisma.MisTaskWhereInput = conditions.length ? { AND: conditions } : {};

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
