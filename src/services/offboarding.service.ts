import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { userService } from "./user.service";

const OFFBOARD_REASON = "Employee deleted";

// "Open" = still on someone's to-do list — the same definition as the
// Checklist page's Pending tab. Leave rows get actualDate set by markLeave(),
// so they fall outside this and count as history like completed rows.
const openEntry = { actualDate: null, adminDone: false, leaveStatus: false } as const;
const openDelegation = { isDeleted: false, status: { not: "DONE" as const } };

/**
 * Deletes the given users and everything that belongs only to them —
 * recurring templates, every checklist/delegation task (open and completed),
 * attendance, leave and MIS targets — then the user rows. Rows where they
 * only acted on someone else's work (transfers, leave marked, targets set,
 * submissions on tasks now owned by others) are kept: the DB nulls those
 * references (ON DELETE SET NULL) and the UI shows them as "Deleted user".
 * Callers deactivate the users first (separate commit) so materializeTasks()/
 * ensureGenerated(), which skip INACTIVE users, can't add rows mid-purge.
 */
async function purgeUsers(tx: Prisma.TransactionClient, userIds: number[], adminId: number) {
  const ids = { in: userIds };

  // Loans TO these users go back to their owners — the borrower is gone.
  await tx.checklistEntry.updateMany({
    where: { transferredToId: ids, ...openEntry },
    data: { transferredToId: null, transferValidUntil: null },
  });

  // Approving one of these later would act on tasks that no longer exist,
  // or lend them to someone who no longer exists.
  await tx.transferRequest.updateMany({
    where: { status: "PENDING", OR: [{ fromUserId: ids }, { toUserId: ids }] },
    data: {
      status: "REJECTED",
      reviewedByUserId: adminId,
      reviewedAt: new Date(),
      reviewNote: OFFBOARD_REASON,
    },
  });

  // Reported in the success toast — counted before anything is deleted.
  const [templates, checklistTasks, delegationTasks] = await Promise.all([
    tx.taskTemplate.count({ where: { assignedUserId: ids } }),
    tx.checklistEntry.count({ where: { assignedUserId: ids, ...openEntry } }),
    tx.delegationTask.count({ where: { assignedUserId: ids, ...openDelegation } }),
  ]);

  // Their transfer logs first, while the task they point at is still
  // assigned to them.
  await tx.taskTransferLog.deleteMany({
    where: {
      OR: [
        { checklistEntry: { assignedUserId: ids } },
        { delegationTask: { assignedUserId: ids } },
      ],
    },
  });
  await tx.checklistEntry.deleteMany({ where: { assignedUserId: ids } });
  // Hard delete is what stops these from ever coming back — an active
  // template regenerates deleted rows on the next checklist load.
  await tx.taskTemplate.deleteMany({ where: { assignedUserId: ids } });
  // DONE and soft-deleted tasks too; their DelegationHistory cascades.
  await tx.delegationTask.deleteMany({ where: { assignedUserId: ids } });
  await tx.transferRequest.deleteMany({ where: { fromUserId: ids } });
  await tx.leaveLog.deleteMany({ where: { userId: ids } });
  await tx.attendanceLog.deleteMany({ where: { userId: ids } });
  await tx.misWeeklyTarget.deleteMany({ where: { userId: ids } });

  // Refresh tokens, section permissions and department links cascade;
  // every remaining reference to them elsewhere is nulled by the DB.
  const deleted = await tx.user.deleteMany({ where: { id: ids } });

  return { deleted: deleted.count, templates, checklistTasks, delegationTasks };
}

/**
 * Permanent user deletion. A deleted user's live session dies on its next
 * request: authMiddleware looks the user up on every call.
 */
export const offboardingService = {
  // What deleteUser() would remove — shown in the confirm dialog's warning.
  async getDeletePreview(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    const [templates, checklistTasks, pendingChecklist, delegationTasks, pendingDelegation] = await Promise.all([
      prisma.taskTemplate.count({ where: { assignedUserId: userId } }),
      prisma.checklistEntry.count({ where: { assignedUserId: userId } }),
      prisma.checklistEntry.count({ where: { assignedUserId: userId, ...openEntry } }),
      prisma.delegationTask.count({ where: { assignedUserId: userId } }),
      prisma.delegationTask.count({ where: { assignedUserId: userId, ...openDelegation } }),
    ]);
    return { templates, checklistTasks, pendingChecklist, delegationTasks, pendingDelegation };
  },

  async deleteUser(userId: number, adminId: number) {
    if (userId === adminId) {
      throw Object.assign(new Error("You cannot delete your own account"), { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    // If the transaction below fails, the user is simply left inactive with
    // everything intact, and the admin can run this again.
    await userService.updateStatus(userId, "INACTIVE");

    const { templates, checklistTasks, delegationTasks } = await prisma.$transaction(
      (tx) => purgeUsers(tx, [userId], adminId),
      { timeout: 30_000 }
    );
    return { templates, checklistTasks, delegationTasks };
  },

  // Every USER-role account at once; all ADMIN accounts (the caller included)
  // are kept. Re-asks the admin's password because one click wipes everyone.
  async deleteAllNonAdmins(adminId: number, password: string) {
    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { passwordHash: true } });
    // 400, not 401 — the frontend treats a 401 as an expired session and
    // would log the admin out over a typo.
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw Object.assign(new Error("Incorrect password"), { status: 400 });
    }

    const targets = await prisma.user.findMany({ where: { role: "USER" }, select: { id: true } });
    const targetIds = targets.map((t) => t.id);
    if (targetIds.length === 0) {
      return { deleted: 0, templates: 0, checklistTasks: 0, delegationTasks: 0 };
    }

    await prisma.user.updateMany({ where: { id: { in: targetIds } }, data: { status: "INACTIVE" } });

    // One transaction, so a failure part-way deletes no one.
    return prisma.$transaction((tx) => purgeUsers(tx, targetIds, adminId), { timeout: 120_000 });
  },
};
