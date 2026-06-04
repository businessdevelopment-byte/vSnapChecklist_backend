import { prisma } from "../config/database";
import type { TransferTasksInput } from "../schemas/transfer.schemas";

export const transferService = {
  async transferTasks(input: TransferTasksInput, transferredByUserId: number) {
    const start = new Date(input.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);

    // 1. Find pending entries to transfer
    const entryWhere = {
      assignedUserId: input.fromUserId,
      taskStartDate: { gte: start, lte: end },
      actualDate: null,
      adminDone: false,
      ...(input.taskCodes && input.taskCodes.length > 0
        ? { taskCode: { in: input.taskCodes } }
        : {}),
    };

    const entries = await prisma.checklistEntry.findMany({
      where: entryWhere,
      select: { id: true, templateId: true, taskCode: true },
    });

    if (entries.length === 0) {
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
      // Update entries
      await tx.checklistEntry.updateMany({
        where: { id: { in: entries.map((e) => e.id) } },
        data: { assignedUserId: input.toUserId, transferredToId: input.toUserId },
      });

      // Log each transfer
      await tx.taskTransferLog.createMany({
        data: entries.map((e) => ({
          checklistEntryId: e.id,
          templateId: e.templateId,
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          transferredByUserId,
          reason: input.reason,
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
    });

    return { transferred: entries.length };
  },

  async getTransferLogs(userId: number, requesterRole: string, requesterId: number) {
    const effectiveUserId = requesterRole === "ADMIN" ? userId : requesterId;

    return prisma.taskTransferLog.findMany({
      where: {
        OR: [{ fromUserId: effectiveUserId }, { toUserId: effectiveUserId }],
      },
      orderBy: { transferredAt: "desc" },
      take: 100,
      include: {
        fromUser: { select: { id: true, username: true } },
        toUser: { select: { id: true, username: true } },
        transferredBy: { select: { id: true, username: true } },
        checklistEntry: { select: { taskCode: true, description: true, taskStartDate: true } },
      },
    });
  },
};
