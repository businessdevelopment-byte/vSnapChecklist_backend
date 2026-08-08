import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  CreateDelegationInput,
  SubmitDelegationInput,
  DelegationQueryInput,
  DelegationHistoryQueryInput,
  DelegationMisQueryInput,
  ImportDelegationsInput,
} from "../schemas/delegation.schemas";

// delegation_tasks.taskStartDate is a real datetime (unlike checklist_entries,
// which is date-only) — a bare "endDate" string parses to midnight UTC, which
// would exclude every task whose time-of-day falls later on its own end date.
function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export const delegationService = {
  async getAll(query: DelegationQueryInput, requesterId: number, requesterRole: string) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;

    const where: Prisma.DelegationTaskWhereInput = { isDeleted: false };
    if (userId) where.assignedUserId = userId;
    if (query.departmentId) where.departmentId = query.departmentId;
    // "Planned" only ever means "extended" (see submit()'s EXTEND_DATE path)
    // — the Delegation page shows it merged into "Pending", tagged, so the
    // list query needs to widen to match.
    if (query.status === "PENDING") {
      where.status = { in: ["PENDING", "PLANNED"] };
    } else if (query.status) {
      where.status = query.status;
    }
    if (query.frequency) where.frequency = query.frequency;
    if (query.nameFilter) {
      where.assignedUser = { username: { equals: query.nameFilter, mode: "insensitive" } };
    }
    if (query.startDate || query.endDate) {
      where.taskStartDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: endOfDay(query.endDate) } : {}),
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
          // Latest submission only — lets the frontend show a rejection
          // reason on the task row without a second round-trip.
          history: { orderBy: { createdAt: "desc" }, take: 1 },
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

  async importMany(input: ImportDelegationsInput) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const t of input) {
      try {
        const dept = await prisma.department.findFirst({
          where: { name: { equals: t.departmentName, mode: "insensitive" } },
        });
        if (!dept) {
          results.errors.push(`${t.taskCode}: department "${t.departmentName}" not found`);
          continue;
        }

        const user = await prisma.user.findUnique({ where: { username: t.assignedUsername } });
        if (!user) {
          results.errors.push(`${t.taskCode}: user "${t.assignedUsername}" not found`);
          continue;
        }

        const exists = await prisma.delegationTask.findUnique({ where: { taskCode: t.taskCode } });
        if (exists) { results.skipped++; continue; }

        const task = await prisma.delegationTask.create({
          data: {
            taskCode: t.taskCode,
            departmentId: dept.id,
            givenBy: t.givenBy,
            assignedUserId: user.id,
            description: t.description,
            taskStartDate: new Date(t.taskStartDate),
            frequency: t.frequency,
            enableReminders: t.enableReminders ?? true,
            requireAttachment: t.requireAttachment ?? false,
            status: t.status ?? "PENDING",
            isDeleted: t.isDeleted ?? false,
          },
        });

        // A row carrying a completed historical submission (Status=Done + an Actual
        // date) gets its DelegationHistory recreated too, pre-approved — it's already
        // finished work being backfilled, not a new completion awaiting admin review.
        if (t.status === "DONE" && t.submissionDate) {
          const isLate = new Date(t.submissionDate) > task.taskStartDate;
          await prisma.delegationHistory.create({
            data: {
              delegationTaskId: task.id,
              submittedByUserId: user.id,
              submissionDate: new Date(t.submissionDate),
              status: "DONE",
              remarks: t.remarks,
              imageUrl: t.imageUrl,
              taskDescription: t.description,
              givenBy: t.givenBy,
              adminDoneStatus: t.adminDoneStatus,
              isLate,
              reviewStatus: "APPROVED",
              reviewedAt: new Date(),
            },
          });
        }

        results.created++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.errors.push(`${t.taskCode}: ${msg}`);
      }
    }

    return results;
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

    if (task.requireAttachment && !input.imageUrl) {
      throw Object.assign(new Error("This task requires an attached image"), { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // taskEndDate is the effective deadline once the task has been extended
    // at least once; taskStartDate (the fixed assignment date) is the
    // deadline only until the first extension sets a real one.
    const deadline = new Date(task.taskEndDate ?? task.taskStartDate);
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
        // "Done" submissions wait for admin verification (see approveSubmission/
        // rejectSubmission below) before they actually count as complete.
        // "Extend date" isn't a completion claim, so it needs no review.
        reviewStatus: input.status === "DONE" ? "PENDING" : undefined,
      },
    });

    // After user submits "Done" → VERIFY_PENDING until admin approves it
    // After user submits "Extend date" → move to PLANNED
    const newStatus = input.status === "DONE" ? "VERIFY_PENDING" : "PLANNED";
    const isExtending = input.status === "EXTEND_DATE" && !!input.nextTargetDate;

    await prisma.delegationTask.update({
      where: { id },
      data: {
        status: newStatus,
        // taskStartDate is the fixed assignment date and is never touched by
        // an extension — only taskEndDate (the effective deadline) moves,
        // and moves again on every subsequent extension.
        ...(isExtending && { taskEndDate: new Date(input.nextTargetDate!) }),
      },
    });

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

  // "Done" submissions awaiting or already given a verdict — reviewStatus is
  // null for EXTEND_DATE rows, which never enter this list at all.
  async listSubmissionsForReview() {
    return prisma.delegationHistory.findMany({
      where: { reviewStatus: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        submittedBy: { select: { id: true, username: true } },
        reviewedBy: { select: { id: true, username: true } },
        delegationTask: {
          select: {
            taskCode: true,
            description: true,
            assignedUser: { select: { id: true, username: true } },
          },
        },
      },
    });
  },

  async approveSubmission(historyId: number, reviewedByUserId: number) {
    const history = await prisma.delegationHistory.findUnique({ where: { id: historyId } });
    if (!history) throw Object.assign(new Error("Submission not found"), { status: 404 });
    if (history.reviewStatus !== "PENDING") {
      throw Object.assign(new Error("This submission has already been reviewed"), { status: 400 });
    }

    const [updatedHistory] = await prisma.$transaction([
      prisma.delegationHistory.update({
        where: { id: historyId },
        data: { reviewStatus: "APPROVED", reviewedByUserId, reviewedAt: new Date() },
      }),
      prisma.delegationTask.update({
        where: { id: history.delegationTaskId },
        data: { status: "DONE" },
      }),
    ]);

    return updatedHistory;
  },

  async rejectSubmission(historyId: number, reviewedByUserId: number, reviewNote?: string) {
    const history = await prisma.delegationHistory.findUnique({ where: { id: historyId } });
    if (!history) throw Object.assign(new Error("Submission not found"), { status: 404 });
    if (history.reviewStatus !== "PENDING") {
      throw Object.assign(new Error("This submission has already been reviewed"), { status: 400 });
    }

    const [updatedHistory] = await prisma.$transaction([
      prisma.delegationHistory.update({
        where: { id: historyId },
        data: { reviewStatus: "REJECTED", reviewedByUserId, reviewedAt: new Date(), reviewNote },
      }),
      prisma.delegationTask.update({
        where: { id: history.delegationTaskId },
        data: { status: "PENDING" },
      }),
    ]);

    return updatedHistory;
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
        ...(query.endDate ? { lte: endOfDay(query.endDate) } : {}),
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

  async getMisStaffStats(query: Pick<DelegationMisQueryInput, "startDate" | "endDate"> & { userId?: number }) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const where: Prisma.DelegationTaskWhereInput = { isDeleted: false };
    if (query.startDate || query.endDate) {
      where.taskStartDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: endOfDay(query.endDate) } : {}),
      };
    }
    if (query.userId != null) where.assignedUserId = query.userId;

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
        // The latest approved "Done" submission's on-time flag — the same
        // submission that actually flipped this task's status to DONE (see
        // approveSubmission()). A task can also carry an earlier REJECTED
        // "Done" attempt; only the approved one represents real completion.
        // Bucketing this by the task's own taskStartDate (the same filter
        // `where` above already applies) instead of a separate query keyed
        // to DelegationHistory.submissionDate avoids a numerator/denominator
        // mismatch — see docs/migration/DECISIONS.md, "on-time % could read
        // over 100%".
        history: {
          where: { status: "DONE", reviewStatus: "APPROVED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { isLate: true },
        },
      },
    });

    const map = new Map<number, { username: string; email: string; total: number; done: number; onTime: number }>();
    for (const t of tasks) {
      if (!map.has(t.assignedUserId)) {
        map.set(t.assignedUserId, {
          username: t.assignedUser.username,
          email: t.assignedUser.email ?? "",
          total: 0,
          done: 0,
          onTime: 0,
        });
      }
      const s = map.get(t.assignedUserId)!;
      s.total++;
      if (t.status === "DONE") {
        s.done++;
        if (t.history[0]?.isLate === false) s.onTime++;
      }
    }

    return Array.from(map.entries())
      .map(([userId, s]) => ({
        userId,
        username: s.username,
        email: s.email,
        total: s.total,
        done: s.done,
        onTime: s.onTime,
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
