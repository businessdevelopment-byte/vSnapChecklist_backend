import { prisma } from "../config/database";
import { userService } from "./user.service";
import type { OffboardUserInput } from "../schemas/user.schemas";

const OFFBOARD_REASON = "Employee offboarded";

// "Open" = still on someone's to-do list — the same definition as the
// Checklist page's Pending tab. Leave rows get actualDate set by markLeave(),
// so they fall outside this and are kept as history like completed rows.
const openEntry = { actualDate: null, adminDone: false, leaveStatus: false } as const;
const openDelegation = { isDeleted: false, status: { not: "DONE" as const } };

/**
 * Removes a departed employee from the task system in one step: their
 * recurring templates and every still-open checklist/delegation task are
 * either handed over to another employee or permanently deleted, their login
 * is deactivated, and their completed history is left untouched so reports
 * and MIS numbers don't change.
 */
export const offboardingService = {
  async getPreview(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    const [
      templates,
      openChecklist,
      totalChecklist,
      openDelegationCount,
      completedDelegationKept,
      loansToUser,
      pendingTransferRequests,
    ] = await Promise.all([
      prisma.taskTemplate.count({ where: { assignedUserId: userId } }),
      prisma.checklistEntry.count({ where: { assignedUserId: userId, ...openEntry } }),
      prisma.checklistEntry.count({ where: { assignedUserId: userId } }),
      prisma.delegationTask.count({ where: { assignedUserId: userId, ...openDelegation } }),
      prisma.delegationTask.count({ where: { assignedUserId: userId, isDeleted: false, status: "DONE" } }),
      prisma.checklistEntry.count({ where: { transferredToId: userId, ...openEntry } }),
      prisma.transferRequest.count({
        where: { status: "PENDING", OR: [{ fromUserId: userId }, { toUserId: userId }] },
      }),
    ]);

    return {
      templates,
      openChecklist,
      completedChecklistKept: totalChecklist - openChecklist,
      openDelegation: openDelegationCount,
      completedDelegationKept,
      loansToUser,
      pendingTransferRequests,
    };
  },

  async offboard(userId: number, input: OffboardUserInput, adminId: number) {
    if (userId === adminId) {
      throw Object.assign(new Error("You cannot remove your own account"), { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    if (input.mode === "REASSIGN") {
      if (input.toUserId === userId) {
        throw Object.assign(new Error("Choose a different employee to hand the tasks over to"), { status: 400 });
      }
      const toUser = await prisma.user.findUnique({ where: { id: input.toUserId }, select: { status: true } });
      if (!toUser) throw Object.assign(new Error("Target employee not found"), { status: 404 });
      if (toUser.status !== "ACTIVE") {
        throw Object.assign(new Error("Target employee is inactive"), { status: 400 });
      }
    } else if (input.confirmUsername !== user.username) {
      throw Object.assign(new Error("Confirmation username does not match"), { status: 400 });
    }

    // Committed before the transaction on purpose: materializeTasks()/
    // ensureGenerated() skip INACTIVE users, so this stops a concurrent
    // checklist load from generating fresh rows for this user while we move
    // or delete theirs. If the transaction below fails, the user is simply
    // left inactive with tasks intact, and the admin can run this again.
    await userService.updateStatus(userId, "INACTIVE");

    return prisma.$transaction(
      async (tx) => {
        // Loans TO this user go back to their owners — the borrower is gone.
        const loansReturned = await tx.checklistEntry.updateMany({
          where: { transferredToId: userId, ...openEntry },
          data: { transferredToId: null, transferValidUntil: null },
        });

        // Approving one of these later would act on tasks that no longer
        // belong to (or no longer exist for) this user.
        const transferRequestsClosed = await tx.transferRequest.updateMany({
          where: { status: "PENDING", OR: [{ fromUserId: userId }, { toUserId: userId }] },
          data: {
            status: "REJECTED",
            reviewedByUserId: adminId,
            reviewedAt: new Date(),
            reviewNote: OFFBOARD_REASON,
          },
        });

        if (input.mode === "REASSIGN") {
          const toUserId = input.toUserId;

          const entries = await tx.checklistEntry.findMany({
            where: { assignedUserId: userId, ...openEntry },
            select: { id: true, templateId: true },
          });
          const delegationTasks = await tx.delegationTask.findMany({
            where: { assignedUserId: userId, ...openDelegation },
            select: { id: true },
          });

          const templates = await tx.taskTemplate.updateMany({
            where: { assignedUserId: userId },
            data: { assignedUserId: toUserId },
          });

          // The new owner holds these outright, so any temporary loan the
          // departed employee had out on them ends here too.
          await tx.checklistEntry.updateMany({
            where: { id: { in: entries.map((e) => e.id) } },
            data: { assignedUserId: toUserId, transferredToId: null, transferValidUntil: null },
          });

          await tx.delegationTask.updateMany({
            where: { id: { in: delegationTasks.map((d) => d.id) } },
            data: { assignedUserId: toUserId },
          });

          // validFrom/validUntil left null — a permanent handover, unlike a
          // regular checklist transfer (see transfer.service.ts executeTransfer).
          await tx.taskTransferLog.createMany({
            data: [
              ...entries.map((e) => ({
                checklistEntryId: e.id,
                templateId: e.templateId,
                fromUserId: userId,
                toUserId,
                transferredByUserId: adminId,
                reason: OFFBOARD_REASON,
              })),
              ...delegationTasks.map((d) => ({
                delegationTaskId: d.id,
                fromUserId: userId,
                toUserId,
                transferredByUserId: adminId,
                reason: OFFBOARD_REASON,
              })),
            ],
          });

          return {
            mode: "REASSIGN" as const,
            templates: templates.count,
            checklistTasks: entries.length,
            delegationTasks: delegationTasks.length,
            loansReturned: loansReturned.count,
            transferRequestsClosed: transferRequestsClosed.count,
          };
        }

        const entries = await tx.checklistEntry.deleteMany({
          where: { assignedUserId: userId, ...openEntry },
        });

        // Hard delete is what stops these from ever coming back — a
        // deactivated template can be switched on again, and an active one
        // regenerates deleted rows on the next checklist load. Kept history
        // rows survive: their templateId is nulled by the FK (ON DELETE SET
        // NULL), and they carry their own copy of taskCode/description.
        const templates = await tx.taskTemplate.deleteMany({
          where: { assignedUserId: userId },
        });

        // Their DelegationHistory rows cascade with them — those tasks were
        // never finished, so there is no completed history to lose.
        const delegationTasks = await tx.delegationTask.deleteMany({
          where: { assignedUserId: userId, ...openDelegation },
        });

        return {
          mode: "DELETE" as const,
          templates: templates.count,
          checklistTasks: entries.count,
          delegationTasks: delegationTasks.count,
          loansReturned: loansReturned.count,
          transferRequestsClosed: transferRequestsClosed.count,
        };
      },
      { timeout: 30_000 }
    );
  },
};
