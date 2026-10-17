import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import { pruneDeletedCodesFromPendingRequests } from "./transfer.service";
import { normalizeUsername } from "../utils/username";
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

  /**
   * Imports (or re-imports) delegation tasks from the Settings CSV import.
   * The sheet's Status + Admin Done decide where each task lands, mirroring
   * what the same work would look like if it had been done in the app:
   *   Done + Admin Done   → DONE, submission pre-approved
   *   Done, no Admin Done → VERIFY_PENDING, submission waits in Admin Approve
   *   Extend date         → PLANNED, taskEndDate = Planned Date (like submit())
   *   blank               → PENDING
   * A task code that already exists is refreshed from the sheet — unless
   * someone has worked on it in the app, in which case only its details
   * change and its progress (status, dates, assignee, history) is kept.
   * Missing departments are created; nothing is skipped silently.
   */
  async importMany(input: ImportDelegationsInput) {
    const results = {
      created: 0,
      updated: 0,
      keptAppProgress: 0,
      awaitingApproval: 0,
      departmentsCreated: [] as string[],
      errors: [] as string[],
    };
    const now = new Date();
    // submissionDate is date-only; an extension's real date isn't in the sheet.
    const importDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const deptIdByName = new Map(
      (await prisma.department.findMany({ select: { id: true, name: true } }))
        .map((d) => [d.name.trim().toLowerCase(), d.id])
    );
    // Exact name first; a case-insensitive match only when it's unambiguous.
    const users = await prisma.user.findMany({ select: { id: true, username: true } });
    const userIdByExact = new Map(users.map((u) => [normalizeUsername(u.username), u.id]));
    const userIdsByLower = new Map<string, number[]>();
    for (const u of users) {
      const key = normalizeUsername(u.username).toLowerCase();
      userIdsByLower.set(key, [...(userIdsByLower.get(key) ?? []), u.id]);
    }
    const userIdFor = (raw: string) => {
      const name = normalizeUsername(raw);
      const lower = userIdsByLower.get(name.toLowerCase());
      return userIdByExact.get(name) ?? (lower?.length === 1 ? lower[0] : undefined);
    };

    for (const t of input) {
      try {
        const deptKey = t.departmentName.trim().toLowerCase();
        let departmentId = deptIdByName.get(deptKey);
        if (!departmentId) {
          const dept = await prisma.department.create({ data: { name: t.departmentName.trim() } });
          departmentId = dept.id;
          deptIdByName.set(deptKey, dept.id);
          results.departmentsCreated.push(dept.name);
        }

        const userId = userIdFor(t.assignedUsername);
        if (!userId) {
          results.errors.push(`${t.taskCode}: user "${t.assignedUsername}" not found`);
          continue;
        }

        const isDone = t.status === "DONE" || t.status === "VERIFY_PENDING";
        if (isDone && !t.submissionDate) {
          results.errors.push(`${t.taskCode}: Done status needs an Actual date`);
          continue;
        }
        const adminDone = /^(done|yes|true|1)$/i.test(t.adminDoneStatus?.trim() ?? "");
        const extended = t.status === "PLANNED";

        const taskStartDate = new Date(t.taskStartDate);
        const taskEndDate = extended && t.taskEndDate ? new Date(t.taskEndDate) : null;
        const status = isDone ? (adminDone ? "DONE" : "VERIFY_PENDING") : extended ? "PLANNED" : "PENDING";

        const history = (delegationTaskId: number): Prisma.DelegationHistoryUncheckedCreateInput | null => {
          const base = {
            delegationTaskId,
            submittedByUserId: userId,
            taskDescription: t.description,
            givenBy: t.givenBy,
            remarks: t.remarks,
            importedAt: now,
          };
          if (isDone) {
            const submissionDate = new Date(t.submissionDate!);
            return {
              ...base,
              status: "DONE",
              submissionDate,
              imageUrl: t.imageUrl,
              isLate: submissionDate > (taskEndDate ?? taskStartDate),
              adminDoneStatus: adminDone ? "Done" : null,
              // Pre-approved only when the sheet says an admin already checked
              // it; otherwise it's a real pending review (no reviewer is set
              // either way — that's what marks the approval as import-made).
              reviewStatus: adminDone ? "APPROVED" : "PENDING",
              reviewedAt: adminDone ? now : null,
            };
          }
          if (extended && taskEndDate) {
            return { ...base, status: "EXTEND_DATE", submissionDate: importDay, nextTargetDate: taskEndDate };
          }
          return null;
        };

        const details = {
          departmentId,
          givenBy: t.givenBy,
          description: t.description,
          frequency: t.frequency,
          ...(t.enableReminders !== undefined && { enableReminders: t.enableReminders }),
          ...(t.requireAttachment !== undefined && { requireAttachment: t.requireAttachment }),
        };

        const existing = await prisma.delegationTask.findUnique({
          where: { taskCode: t.taskCode },
          select: { id: true, isDeleted: true },
        });

        if (!existing) {
          await prisma.$transaction(async (tx) => {
            const task = await tx.delegationTask.create({
              data: {
                ...details,
                taskCode: t.taskCode,
                assignedUserId: userId,
                taskStartDate,
                taskEndDate,
                status,
                isDeleted: t.isDeleted ?? false,
              },
            });
            const row = history(task.id);
            if (row) await tx.delegationHistory.create({ data: row });
          });
          results.created++;
          if (status === "VERIFY_PENDING") results.awaitingApproval++;
          continue;
        }

        // In-app work leaves rows the importer never makes: a submission or
        // extension (importedAt null), an admin review (reviewer set), or a
        // transfer. The sheet must not undo any of that.
        const [appHistory, transfers] = await Promise.all([
          prisma.delegationHistory.count({
            where: {
              delegationTaskId: existing.id,
              OR: [{ importedAt: null }, { reviewedByUserId: { not: null } }],
            },
          }),
          prisma.taskTransferLog.count({ where: { delegationTaskId: existing.id } }),
        ]);

        // Deleting is one-way: the sheet can delete a task, never restore one.
        const isDeleted = existing.isDeleted || (t.isDeleted ?? false);

        if (appHistory > 0 || transfers > 0) {
          await prisma.delegationTask.update({ where: { id: existing.id }, data: { ...details, isDeleted } });
          results.keptAppProgress++;
          continue;
        }

        await prisma.$transaction(async (tx) => {
          await tx.delegationHistory.deleteMany({
            where: { delegationTaskId: existing.id, importedAt: { not: null } },
          });
          await tx.delegationTask.update({
            where: { id: existing.id },
            data: { ...details, assignedUserId: userId, taskStartDate, taskEndDate, status, isDeleted },
          });
          const row = history(existing.id);
          if (row) await tx.delegationHistory.create({ data: row });
        });
        results.updated++;
        if (status === "VERIFY_PENDING") results.awaitingApproval++;
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

  async previewHardDelete(ids: number[]) {
    const [deletable, completedSkipped] = await Promise.all([
      prisma.delegationTask.count({ where: { id: { in: ids }, isDeleted: false, status: { not: "DONE" } } }),
      prisma.delegationTask.count({ where: { id: { in: ids }, isDeleted: false, status: "DONE" } }),
    ]);
    return { deletable, completedSkipped };
  },

  /**
   * Permanent delete (Quick Task page), unlike softDelete above which the
   * Delegation page uses. DONE tasks are skipped: they are the completed
   * history, and delegation stats only count isDeleted:false rows, so even a
   * soft delete would drop them from reports. Submission history of the
   * deleted (unfinished) tasks cascades with them.
   */
  async hardDeleteMany(ids: number[], adminId: number) {
    const tasks = await prisma.delegationTask.findMany({
      where: { id: { in: ids }, isDeleted: false },
      select: { id: true, taskCode: true, status: true },
    });
    const deletable = tasks.filter((t) => t.status !== "DONE");
    const skippedCompleted = tasks.length - deletable.length;
    if (deletable.length === 0) {
      throw Object.assign(
        new Error(skippedCompleted > 0 ? "Completed tasks can't be deleted — they are kept as history" : "Task not found"),
        { status: skippedCompleted > 0 ? 400 : 404 }
      );
    }

    return prisma.$transaction(async (tx) => {
      const deleted = await tx.delegationTask.deleteMany({
        where: { id: { in: deletable.map((t) => t.id) }, status: { not: "DONE" } },
      });
      const requests = await pruneDeletedCodesFromPendingRequests(
        tx,
        { delegationTaskCodes: deletable.map((t) => t.taskCode) },
        adminId
      );
      return {
        deleted: deleted.count,
        skippedCompleted,
        transferRequestsUpdated: requests.updated,
        transferRequestsRejected: requests.rejected,
      };
    });
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
  // Every PENDING submission plus the latest reviewed ones. One capped list
  // used to hide pending items behind hundreds of reviewed rows — e.g. after
  // a sheet import pre-approves most of them — so the admin couldn't act.
  async listSubmissionsForReview() {
    const include = {
      submittedBy: { select: { id: true, username: true } },
      reviewedBy: { select: { id: true, username: true } },
      delegationTask: {
        select: {
          taskCode: true,
          description: true,
          assignedUser: { select: { id: true, username: true } },
        },
      },
    } as const;
    const [pending, reviewed] = await Promise.all([
      prisma.delegationHistory.findMany({
        where: { reviewStatus: "PENDING" },
        orderBy: { createdAt: "desc" },
        include,
      }),
      prisma.delegationHistory.findMany({
        where: { reviewStatus: { in: ["APPROVED", "REJECTED"] } },
        orderBy: { createdAt: "desc" },
        take: 200,
        include,
      }),
    ]);
    return [...pending, ...reviewed];
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
