import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  CreateDelegationInput,
  SubmitDelegationInput,
  DelegationQueryInput,
  DelegationHistoryQueryInput,
  DelegationMisQueryInput,
} from "../schemas/delegation.schemas";

export const delegationService = {
  async getAll(query: DelegationQueryInput, requesterId: number, requesterRole: string) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;

    const where: Prisma.DelegationTaskWhereInput = { isDeleted: false };
    if (userId) where.assignedUserId = userId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.status) where.status = query.status;
    if (query.nameFilter) {
      where.assignedUser = { username: { equals: query.nameFilter, mode: "insensitive" } };
    }
    if (query.startDate || query.endDate) {
      where.taskStartDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: "insensitive" } },
        { taskCode: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.delegationTask.findMany({
        where,
        skip,
        take,
        orderBy: [{ status: "asc" }, { taskStartDate: "asc" }],
        include: {
          assignedUser: { select: { id: true, username: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.delegationTask.count({ where }),
    ]);

    return { data: tasks, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: number) {
    const task = await prisma.delegationTask.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, username: true } },
        department: { select: { id: true, name: true } },
        history: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!task) throw Object.assign(new Error("Delegation task not found"), { status: 404 });
    return task;
  },

  async create(input: CreateDelegationInput) {
    const existing = await prisma.delegationTask.findUnique({ where: { taskCode: input.taskCode } });
    if (existing) throw Object.assign(new Error(`Task code "${input.taskCode}" already exists`), { status: 409 });

    return prisma.delegationTask.create({
      data: {
        taskCode: input.taskCode,
        departmentId: input.departmentId,
        givenBy: input.givenBy,
        assignedUserId: input.assignedUserId,
        description: input.description,
        taskStartDate: new Date(input.taskStartDate),
        taskEndDate: input.taskEndDate ? new Date(input.taskEndDate) : null,
        frequency: input.frequency,
        enableReminders: input.enableReminders ?? true,
        requireAttachment: input.requireAttachment ?? false,
        sampleImageUrl: input.sampleImageUrl ?? null,
      },
      include: {
        assignedUser: { select: { id: true, username: true } },
        department: { select: { id: true, name: true } },
      },
    });
  },

  async updateStatus(id: number, status: "PENDING" | "PLANNED" | "VERIFY_PENDING" | "DONE") {
    await this.getById(id);
    return prisma.delegationTask.update({ where: { id }, data: { status } });
  },

  async softDelete(id: number, requesterRole: string) {
    if (requesterRole !== "ADMIN") {
      throw Object.assign(new Error("Only admin can delete delegation tasks"), { status: 403 });
    }
    await this.getById(id);
    return prisma.delegationTask.update({ where: { id }, data: { isDeleted: true } });
  },

  async submit(id: number, input: SubmitDelegationInput, submittedByUserId: number) {
    const task = await this.getById(id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(task.taskStartDate);
    deadline.setHours(0, 0, 0, 0);
    const isLate = today > deadline;

    const history = await prisma.delegationHistory.create({
      data: {
        delegationTaskId: id,
        submittedByUserId,
        submissionDate: today,
        status: input.status,
        nextTargetDate: input.nextTargetDate ? new Date(input.nextTargetDate) : undefined,
        remarks: input.remarks,
        imageUrl: input.imageUrl,
        taskDescription: task.description,
        givenBy: task.givenBy,
        isLate,
      },
    });

    // After user submits "Done" → mark DONE immediately (no admin approval step)
    // After user submits "Extend date" → move to PLANNED
    const newStatus = input.status === "DONE" ? "DONE" : "PLANNED";
    await prisma.delegationTask.update({ where: { id }, data: { status: newStatus } });

    return history;
  },

  async getHistory(query: DelegationHistoryQueryInput, requesterId: number, requesterRole: string) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;

    const where: Prisma.DelegationHistoryWhereInput = {};
    if (userId) where.submittedByUserId = userId;
    if (query.startDate || query.endDate) {
      where.submissionDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { taskDescription: { contains: query.search, mode: "insensitive" } },
        { delegationTask: { taskCode: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [history, total] = await Promise.all([
      prisma.delegationHistory.findMany({
        where,
        skip,
        take,
        orderBy: { submissionDate: "desc" },
        include: {
          submittedBy: { select: { id: true, username: true } },
          delegationTask: { select: { taskCode: true, frequency: true } },
        },
      }),
      prisma.delegationHistory.count({ where }),
    ]);

    return { data: history, pagination: buildPaginationMeta(total, page, limit) };
  },

  async markHistoryAdminDone(historyIds: number[]) {
    return prisma.delegationHistory.updateMany({
      where: { id: { in: historyIds } },
      data: { adminDoneStatus: "Done" },
    });
  },

  async getMisStats(query: DelegationMisQueryInput, requesterRole: string, requesterId: number) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const effectiveUserId = requesterRole === "ADMIN" ? query.userId : requesterId;
    const base: Prisma.DelegationTaskWhereInput = { isDeleted: false };
    if (effectiveUserId) base.assignedUserId = effectiveUserId;
    if (query.startDate || query.endDate) {
      base.taskStartDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const [total, done, overdue] = await Promise.all([
      prisma.delegationTask.count({ where: base }),
      prisma.delegationTask.count({ where: { ...base, status: "DONE" } }),
      prisma.delegationTask.count({
        where: { ...base, status: { not: "DONE" }, taskStartDate: { lt: today } },
      }),
    ]);

    const pending = total - done;
    const completionRate = total > 0 ? parseFloat(((done / total) * 100).toFixed(1)) : 0;
    return { total, done, pending, overdue, completionRate };
  },

  async getMisStaffStats(query: Pick<DelegationMisQueryInput, "startDate" | "endDate">) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const where: Prisma.DelegationTaskWhereInput = { isDeleted: false };
    if (query.startDate || query.endDate) {
      where.taskStartDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const tasks = await prisma.delegationTask.findMany({
      where: {
        ...where,
        // Only include delegation tasks belonging to ACTIVE users
        assignedUser: { status: "ACTIVE" },
      },
      select: {
        assignedUserId: true,
        status: true,
        assignedUser: { select: { username: true, email: true } },
      },
    });

    const map = new Map<number, { username: string; email: string; total: number; done: number }>();
    for (const t of tasks) {
      if (!map.has(t.assignedUserId)) {
        map.set(t.assignedUserId, {
          username: t.assignedUser.username,
          email: t.assignedUser.email ?? "",
          total: 0,
          done: 0,
        });
      }
      const s = map.get(t.assignedUserId)!;
      s.total++;
      if (t.status === "DONE") s.done++;
    }

    return Array.from(map.entries())
      .map(([userId, s]) => ({
        userId,
        username: s.username,
        email: s.email,
        total: s.total,
        done: s.done,
        pending: s.total - s.done,
        progress: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.progress - a.progress);
  },

  async getStatusCounts(userId: number | undefined, requesterRole: string, requesterId: number) {
    const effectiveUserId = requesterRole === "ADMIN" ? userId : requesterId;
    const where: Prisma.DelegationTaskWhereInput = { isDeleted: false };
    if (effectiveUserId) where.assignedUserId = effectiveUserId;

    const counts = await prisma.delegationTask.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    });

    return counts.reduce(
      (acc, c) => ({ ...acc, [c.status]: c._count.status }),
      { PENDING: 0, PLANNED: 0, VERIFY_PENDING: 0, DONE: 0 } as Record<string, number>
    );
  },
};
