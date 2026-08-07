import { prisma } from "../config/database";
import { checklistService } from "./checklist.service";
import type { TransferTasksInput } from "../schemas/transfer.schemas";

/**
 * Actually reassigns tasks — called only once a TransferRequest has been
 * approved (see approveRequest below). Never called directly from a request
 * a non-admin submitted; createRequest only ever creates a PENDING row.
 */
async function executeTransfer(input: TransferTasksInput, transferredByUserId: number) {
  // UTC, not local time — the server's local timezone (e.g. IST, UTC+5:30)
  // would otherwise shift these date-only strings onto the wrong calendar
  // day (local midnight for a UTC date can land on the previous UTC day).
  const start = new Date(input.startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(input.endDate);
  end.setUTCHours(23, 59, 59, 999);

  // The range may extend into the future, where no real entry exists yet —
  // materialize exactly this window first so the findMany below can find it.
  await checklistService.ensureGenerated(input.fromUserId, start, end);

  // 1. Find pending entries to transfer.
  // A provided `taskCodes` array — even empty — is an explicit filter
  // ("transfer exactly these, or none if empty"); only an omitted key
  // means "no filter, transfer everything in range." This distinction
  // matters once a caller can select tasks from two systems independently
  // (e.g. deselecting every checklist row while keeping delegation rows
  // selected must send `taskCodes: []`, not be treated as "select all").
  const entryWhere = {
    assignedUserId: input.fromUserId,
    taskStartDate: { gte: start, lte: end },
    actualDate: null,
    adminDone: false,
    // Don't let an entry already on loan to someone else (a still-active
    // temporary transfer) get pulled into a second transfer mid-loan.
    // transferValidUntil: null covers both "never transferred" and stale
    // rows from before the temporary-transfer overlay existed, where
    // transferredToId can be non-null with no expiry ever set — a bare
    // `lt: start` comparison against a null column is never true in SQL,
    // so omitting this branch silently excluded those rows from every
    // transfer, including a brand new one (see checklist.service.ts's
    // assignedExcludingOnLoan for the same fix applied there first).
    OR: [
      { transferredToId: null },
      { transferValidUntil: null },
      { transferValidUntil: { lt: start } },
    ],
    ...(input.taskCodes !== undefined ? { taskCode: { in: input.taskCodes } } : {}),
  };

  const entries = await prisma.checklistEntry.findMany({
    where: entryWhere,
    select: { id: true, templateId: true, taskCode: true },
  });

  // 1b. Find pending delegation tasks to transfer (delegation tasks are
  // never lazily generated, so no materialization step is needed here)
  const delegationWhere = {
    assignedUserId: input.fromUserId,
    taskStartDate: { gte: start, lte: end },
    isDeleted: false,
    status: { not: "DONE" as const },
    ...(input.delegationTaskCodes !== undefined ? { taskCode: { in: input.delegationTaskCodes } } : {}),
  };

  const delegationTasks = await prisma.delegationTask.findMany({
    where: delegationWhere,
    select: { id: true, taskCode: true },
  });

  if (entries.length === 0 && delegationTasks.length === 0) {
    throw Object.assign(
      new Error("No pending tasks found in the selected date range for this user"),
      { status: 404 }
    );
  }

  // 2. Verify target user exists
  const toUser = await prisma.user.findUnique({ where: { id: input.toUserId } });
  if (!toUser) throw Object.assign(new Error("Target user not found"), { status: 404 });

  // 3. Execute in a transaction
  await prisma.$transaction(async (tx) => {
    if (entries.length > 0) {
      // Checklist transfers are temporary and self-reverting: assignedUserId
      // is never touched, so once transferValidUntil passes the entry is a
      // normal entry for its original owner again with no extra step (see
      // checklistService.getEntries/reconcileExpiredTransfers).
      await tx.checklistEntry.updateMany({
        where: { id: { in: entries.map((e) => e.id) } },
        data: { transferredToId: input.toUserId, transferValidUntil: end },
      });

      // Log each transfer — validFrom/validUntil record "kab tak" (until
      // when) for the audit trail, distinct from the live overlay above.
      await tx.taskTransferLog.createMany({
        data: entries.map((e) => ({
          checklistEntryId: e.id,
          templateId: e.templateId,
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          transferredByUserId,
          reason: input.reason,
          validFrom: start,
          validUntil: end,
        })),
      });

      // Optionally update template so future instances go to new user
      if (input.transferTemplate) {
        const templateIds = [...new Set(entries.map((e) => e.templateId).filter(Boolean))];
        if (templateIds.length > 0) {
          await tx.taskTemplate.updateMany({
            where: { id: { in: templateIds as number[] } },
            data: { assignedUserId: input.toUserId },
          });
        }
      }
    }

    if (delegationTasks.length > 0) {
      // Delegation tasks aren't recurring/template-backed — reassigning
      // the row is the whole operation, no template-equivalent step.
      await tx.delegationTask.updateMany({
        where: { id: { in: delegationTasks.map((d) => d.id) } },
        data: { assignedUserId: input.toUserId },
      });

      await tx.taskTransferLog.createMany({
        data: delegationTasks.map((d) => ({
          delegationTaskId: d.id,
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          transferredByUserId,
          reason: input.reason,
        })),
      });
    }
  });

  return {
    transferred: entries.length + delegationTasks.length,
    checklistTransferred: entries.length,
    delegationTransferred: delegationTasks.length,
  };
}

const requestInclude = {
  fromUser: { select: { id: true, username: true } },
  toUser: { select: { id: true, username: true } },
  requestedBy: { select: { id: true, username: true } },
  reviewedBy: { select: { id: true, username: true } },
} as const;

export const transferService = {
  /** Anyone may call this — non-admins are pinned to their own tasks (fromUserId forced to self). */
  async createRequest(input: TransferTasksInput, requestedByUserId: number, requesterRole: string) {
    const fromUserId = requesterRole === "ADMIN" ? input.fromUserId : requestedByUserId;

    const toUser = await prisma.user.findUnique({ where: { id: input.toUserId } });
    if (!toUser) throw Object.assign(new Error("Target user not found"), { status: 404 });

    return prisma.transferRequest.create({
      data: {
        fromUserId,
        toUserId: input.toUserId,
        requestedByUserId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        reason: input.reason,
        taskCodes: input.taskCodes ?? [],
        delegationTaskCodes: input.delegationTaskCodes ?? [],
        transferTemplate: input.transferTemplate,
      },
      include: requestInclude,
    });
  },

  async listRequests(status?: "PENDING" | "APPROVED" | "REJECTED") {
    return prisma.transferRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: requestInclude,
    });
  },

  async approveRequest(requestId: number, reviewedByUserId: number) {
    const request = await prisma.transferRequest.findUnique({ where: { id: requestId } });
    if (!request) throw Object.assign(new Error("Transfer request not found"), { status: 404 });
    if (request.status !== "PENDING") {
      throw Object.assign(new Error("This request has already been reviewed"), { status: 400 });
    }

    // Let executeTransfer's own errors (e.g. nothing left to transfer because
    // the requester already handled it another way) surface as the approval's
    // error, rather than marking APPROVED on a no-op.
    const result = await executeTransfer(
      {
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        startDate: request.startDate.toISOString().slice(0, 10),
        endDate: request.endDate.toISOString().slice(0, 10),
        reason: request.reason ?? undefined,
        taskCodes: request.taskCodes,
        delegationTaskCodes: request.delegationTaskCodes,
        transferTemplate: request.transferTemplate,
      },
      reviewedByUserId
    );

    const updated = await prisma.transferRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", reviewedByUserId, reviewedAt: new Date() },
      include: requestInclude,
    });

    return { request: updated, ...result };
  },

  async rejectRequest(requestId: number, reviewedByUserId: number, reviewNote?: string) {
    const request = await prisma.transferRequest.findUnique({ where: { id: requestId } });
    if (!request) throw Object.assign(new Error("Transfer request not found"), { status: 404 });
    if (request.status !== "PENDING") {
      throw Object.assign(new Error("This request has already been reviewed"), { status: 400 });
    }

    return prisma.transferRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", reviewedByUserId, reviewedAt: new Date(), reviewNote },
      include: requestInclude,
    });
  },

  // userId omitted + admin = everyone's logs; non-admins are always pinned to
  // their own regardless of what's passed.
  async getTransferLogs(userId: number | undefined, requesterRole: string, requesterId: number) {
    const effectiveUserId = requesterRole === "ADMIN" ? userId : requesterId;

    return prisma.taskTransferLog.findMany({
      where: effectiveUserId
        ? { OR: [{ fromUserId: effectiveUserId }, { toUserId: effectiveUserId }] }
        : undefined,
      orderBy: { transferredAt: "desc" },
      take: 100,
      include: {
        fromUser: { select: { id: true, username: true } },
        toUser: { select: { id: true, username: true } },
        transferredBy: { select: { id: true, username: true } },
        checklistEntry: { select: { taskCode: true, description: true, taskStartDate: true } },
        delegationTask: { select: { taskCode: true, description: true, taskStartDate: true } },
      },
    });
  },
};
