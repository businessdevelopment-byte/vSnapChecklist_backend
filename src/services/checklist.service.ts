import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  ChecklistQueryInput,
  SubmitChecklistInput,
  LeaveInput,
  ChecklistStatsQueryInput,
} from "../schemas/checklist.schemas";

// ─────────────────────────────────────────
// Working-day helpers
// ─────────────────────────────────────────

/** Returns YYYY-MM-DD key for a Date (UTC midnight) */
function dateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** True if the date is a working day (respects skipSundays setting + holidays) */
function isWorkingDay(date: Date, holidayKeys: Set<string>, skipSundays: boolean): boolean {
  const dow = date.getUTCDay(); // 0=Sun, 6=Sat
  if (skipSundays && dow === 0) return false;
  return !holidayKeys.has(dateKey(date));
}

/** Load holiday keys + skipSundays setting from DB together */
async function loadCalendarConfig(): Promise<{ holidayKeys: Set<string>; skipSundays: boolean }> {
  const [holidayRows, settings] = await Promise.all([
    prisma.holiday.findMany({ select: { date: true } }),
    prisma.systemSettings.findFirst(),
  ]);
  return {
    holidayKeys: new Set(holidayRows.map((r) => dateKey(r.date))),
    skipSundays: settings?.skipSundays ?? true,
  };
}

// ─────────────────────────────────────────
// Frequency helpers
// ─────────────────────────────────────────

function shouldGenerateForDate(
  frequency: string,
  startDate: Date,
  targetDate: Date
): boolean {
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setUTCHours(0, 0, 0, 0);

  if (target < start) return false;

  const diffDays = Math.round((target.getTime() - start.getTime()) / 86_400_000);

  switch (frequency) {
    case "DAILY":
      return true;
    case "ALTERNATE_DAY":
      return diffDays % 2 === 0;
    case "WEEKLY":
      return diffDays % 7 === 0;
    case "FORTNIGHTLY":
      return diffDays % 14 === 0;
    case "MONTHLY":
      return target.getDate() === start.getDate();
    case "QUARTERLY":
      return target.getDate() === start.getDate() && (target.getMonth() - start.getMonth()) % 3 === 0;
    case "YEARLY":
      return target.getDate() === start.getDate() && target.getMonth() === start.getMonth();
    case "END_OF_1ST_WEEK":
      return isEndOfWeekN(target, 1);
    case "END_OF_2ND_WEEK":
      return isEndOfWeekN(target, 2);
    case "END_OF_3RD_WEEK":
      return isEndOfWeekN(target, 3);
    case "END_OF_4TH_WEEK":
      return isEndOfWeekN(target, 4);
    case "END_OF_LAST_WEEK":
      return isEndOfLastWeek(target);
    default:
      return false;
  }
}

function isEndOfWeekN(date: Date, weekN: number): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
    const day = new Date(year, month, d);
    const dow = day.getDay();
    if (dow === 0) continue;
    if (dow === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const week = weeks[weekN - 1];
  if (!week || week.length === 0) return false;
  return week[week.length - 1].toDateString() === date.toDateString();
}

function isEndOfLastWeek(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
    const day = new Date(year, month, d);
    const dow = day.getDay();
    if (dow === 0) continue;
    if (dow === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const lastWeek = weeks[weeks.length - 1];
  if (!lastWeek || lastWeek.length === 0) return false;
  return lastWeek[lastWeek.length - 1].toDateString() === date.toDateString();
}

// ─────────────────────────────────────────
// Core backfill helper
// ─────────────────────────────────────────

/**
 * Generates all missing checklist entries for a user across a date range.
 * Respects working-day calendar (Mon-Sat, no holidays).
 */
async function backfillUser(
  userId: number,
  fromDate: Date,
  toDate: Date,
  holidayKeys: Set<string>,
  skipSundays: boolean
): Promise<number> {
  const from = new Date(fromDate);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(toDate);
  to.setUTCHours(0, 0, 0, 0);

  // Active templates for this user within the range
  const templates = await prisma.taskTemplate.findMany({
    where: {
      assignedUserId: userId,
      isActive: true,
      startDate: { lte: to },
      OR: [{ lastDate: null }, { lastDate: { gte: from } }],
    },
  });

  if (templates.length === 0) return 0;

  // All working days in the range
  const workingDays: Date[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    if (isWorkingDay(cursor, holidayKeys, skipSundays)) {
      workingDays.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (workingDays.length === 0) return 0;

  // Existing entries in range (to avoid duplicates)
  const existing = await prisma.checklistEntry.findMany({
    where: {
      assignedUserId: userId,
      taskStartDate: { gte: from, lte: to },
      templateId: { in: templates.map((t) => t.id) },
    },
    select: { templateId: true, taskStartDate: true },
  });

  const existingKeys = new Set(
    existing.map((e) => `${e.templateId}__${dateKey(e.taskStartDate)}`)
  );

  // Build rows to insert
  const toCreate: Prisma.ChecklistEntryCreateManyInput[] = [];

  for (const template of templates) {
    const tStart = new Date(template.startDate);
    tStart.setUTCHours(0, 0, 0, 0);
    const tEnd = template.lastDate ? new Date(template.lastDate) : null;
    if (tEnd) tEnd.setUTCHours(0, 0, 0, 0);

    for (const day of workingDays) {
      if (day < tStart) continue;
      if (tEnd && day > tEnd) continue;
      const key = `${template.id}__${dateKey(day)}`;
      if (existingKeys.has(key)) continue;
      if (!shouldGenerateForDate(template.frequency, tStart, day)) continue;

      toCreate.push({
        templateId: template.id,
        taskCode: template.taskCode,
        departmentId: template.departmentId,
        givenBy: template.givenBy,
        assignedUserId: template.assignedUserId,
        description: template.description,
        taskStartDate: day,
        frequency: template.frequency,
        enableReminders: template.enableReminders,
        requireAttachment: template.requireAttachment,
      });
    }
  }

  if (toCreate.length === 0) return 0;

  const result = await prisma.checklistEntry.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  return result.count;
}

// ─────────────────────────────────────────
// Main service
// ─────────────────────────────────────────

export const checklistService = {
  /**
   * Called at start of every GET /api/checklist.
   * Ensures today (and up to 7 days back) has entries for the user.
   */
  async materializeTasks(userId: number, targetDate: Date): Promise<void> {
    const today = new Date(targetDate);
    today.setUTCHours(0, 0, 0, 0);

    const { holidayKeys, skipSundays } = await loadCalendarConfig();

    // Only proceed if targetDate is a working day
    if (!isWorkingDay(today, holidayKeys, skipSundays)) return;

    // Check if user has any templates
    const hasTemplates = await prisma.taskTemplate.count({
      where: { assignedUserId: userId, isActive: true },
    });
    if (hasTemplates === 0) return;

    // Check if user has any entries at all → if not, backfill last 90 days
    const hasEntries = await prisma.checklistEntry.count({
      where: { assignedUserId: userId },
    });

    let fromDate: Date;
    if (hasEntries === 0) {
      // First time: backfill 90 days (or from earliest template start)
      const earliest = await prisma.taskTemplate.findFirst({
        where: { assignedUserId: userId, isActive: true },
        orderBy: { startDate: "asc" },
        select: { startDate: true },
      });
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
      fromDate = earliest && earliest.startDate > ninetyDaysAgo
        ? earliest.startDate
        : ninetyDaysAgo;
    } else {
      // Subsequent calls: only today
      fromDate = today;
    }

    await backfillUser(userId, fromDate, today, holidayKeys, skipSundays);
  },

  /** Admin endpoint: bulk backfill all users for a date range */
  async backfillAll(fromDate: Date, toDate: Date): Promise<{ users: number; created: number }> {
    const { holidayKeys, skipSundays } = await loadCalendarConfig();
    const activeUsers = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    let totalCreated = 0;
    for (const u of activeUsers) {
      totalCreated += await backfillUser(u.id, fromDate, toDate, holidayKeys, skipSundays);
    }
    return { users: activeUsers.length, created: totalCreated };
  },

  async getEntries(query: ChecklistQueryInput, requesterId: number, requesterRole: string) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const targetDate = query.date ? new Date(query.date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;

    if (userId) {
      await this.materializeTasks(userId, targetDate);
    } else if (requesterRole === "ADMIN" && !query.userId) {
      const activeUsers = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      await Promise.all(activeUsers.map((u) => this.materializeTasks(u.id, targetDate)));
    }

    const where: Prisma.ChecklistEntryWhereInput = {};

    if (userId) where.assignedUserId = userId;
    if (query.departmentId) where.departmentId = query.departmentId;

    if (query.startDate || query.endDate) {
      where.taskStartDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    } else {
      where.taskStartDate = { lte: targetDate };
    }

    if (query.status === "completed") {
      where.actualDate = { not: null };
    } else if (query.status === "pending") {
      where.actualDate = null;
      where.adminDone = false;
      where.leaveStatus = false;
    } else if (query.status === "overdue") {
      where.actualDate = null;
      where.adminDone = false;
      where.leaveStatus = false;
      where.taskStartDate = { lt: targetDate };
    } else if (query.status === "leave") {
      where.leaveStatus = true;
    } else if (query.status === "admin_done") {
      where.adminDone = true;
    }

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: "insensitive" } },
        { taskCode: { contains: query.search, mode: "insensitive" } },
        { assignedUser: { username: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.checklistEntry.findMany({
        where,
        skip,
        take,
        orderBy: [{ taskStartDate: "asc" }, { assignedUserId: "asc" }],
        include: {
          assignedUser: { select: { id: true, username: true } },
          department: { select: { id: true, name: true } },
          transferredTo: { select: { id: true, username: true } },
        },
      }),
      prisma.checklistEntry.count({ where }),
    ]);

    return { data: entries, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getHistory(query: ChecklistQueryInput, requesterId: number, requesterRole: string) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;

    const where: Prisma.ChecklistEntryWhereInput = {
      OR: [{ actualDate: { not: null } }, { leaveStatus: true }],
    };

    if (userId) where.assignedUserId = userId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.startDate || query.endDate) {
      where.actualDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const [entries, total] = await Promise.all([
      prisma.checklistEntry.findMany({
        where,
        skip,
        take,
        orderBy: { actualDate: "desc" },
        include: {
          assignedUser: { select: { id: true, username: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.checklistEntry.count({ where }),
    ]);

    return { data: entries, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getStats(query: ChecklistStatsQueryInput, requesterId: number, requesterRole: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;

    const baseWhere: Prisma.ChecklistEntryWhereInput = {
      taskStartDate: { lte: today },
      ...(userId ? { assignedUserId: userId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.startDate || query.endDate
        ? { taskStartDate: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          }}
        : {}),
    };

    const [total, completed, leave] = await Promise.all([
      prisma.checklistEntry.count({ where: { ...baseWhere, leaveStatus: false } }),
      prisma.checklistEntry.count({ where: { ...baseWhere, actualDate: { not: null }, leaveStatus: false } }),
      prisma.checklistEntry.count({ where: { ...baseWhere, leaveStatus: true } }),
    ]);

    const pending = total - completed;
    const overdue = await prisma.checklistEntry.count({
      where: {
        ...baseWhere,
        actualDate: null,
        adminDone: false,
        leaveStatus: false,
        taskStartDate: { lt: today },
      },
    });

    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";
    return { total, completed, pending, overdue, leave, completionRate: parseFloat(completionRate) };
  },

  async getStaffStats(params?: { startDate?: Date; endDate?: Date; departmentId?: number }) {
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);

    const { startDate, endDate, departmentId } = params ?? {};

    const where: Prisma.ChecklistEntryWhereInput = {
      leaveStatus: false,
      ...(departmentId ? { departmentId } : {}),
      taskStartDate:
        startDate && endDate
          ? { gte: startDate, lte: endDate }
          : { lte: today },
    };

    const entries = await prisma.checklistEntry.findMany({
      where,
      select: {
        assignedUserId: true,
        actualDate: true,
        adminDone: true,
        assignedUser: { select: { username: true, email: true } },
      },
    });

    const staffMap = new Map<number, { username: string; email: string; total: number; completed: number }>();
    for (const e of entries) {
      if (!staffMap.has(e.assignedUserId)) {
        staffMap.set(e.assignedUserId, {
          username: e.assignedUser.username,
          email: e.assignedUser.email ?? "",
          total: 0,
          completed: 0,
        });
      }
      const s = staffMap.get(e.assignedUserId)!;
      s.total++;
      if (e.actualDate || e.adminDone) s.completed++;
    }

    return Array.from(staffMap.entries())
      .map(([id, s]) => ({
        userId: id,
        username: s.username,
        email: s.email,
        total: s.total,
        completed: s.completed,
        pending: s.total - s.completed,
        progress: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.progress - a.progress);
  },

  async getMonthlyStats(year: number, userId?: number, departmentId?: number) {
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);

    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear =
      year === today.getUTCFullYear()
        ? today
        : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const where: Prisma.ChecklistEntryWhereInput = {
      taskStartDate: { gte: startOfYear, lte: endOfYear },
      leaveStatus: false,
      ...(userId ? { assignedUserId: userId } : {}),
      ...(departmentId ? { departmentId } : {}),
    };

    const entries = await prisma.checklistEntry.findMany({
      where,
      select: { taskStartDate: true, actualDate: true, adminDone: true },
    });

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES[i],
      completed: 0,
      pending: 0,
    }));

    for (const e of entries) {
      const m = new Date(e.taskStartDate).getUTCMonth();
      if (e.actualDate || e.adminDone) {
        months[m].completed++;
      } else {
        months[m].pending++;
      }
    }

    return months;
  },

  async submitEntry(entryId: bigint, input: SubmitChecklistInput, submittedByUserId: number, requesterRole: string) {
    const entry = await prisma.checklistEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw Object.assign(new Error("Entry not found"), { status: 404 });

    if (requesterRole !== "ADMIN" && entry.assignedUserId !== submittedByUserId) {
      throw Object.assign(new Error("Cannot submit someone else's task"), { status: 403 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const taskDate = new Date(entry.taskStartDate);
    taskDate.setUTCHours(0, 0, 0, 0);
    const delayDays = Math.max(0, Math.round((today.getTime() - taskDate.getTime()) / 86_400_000));

    return prisma.checklistEntry.update({
      where: { id: entryId },
      data: {
        actualDate: today,
        delayDays,
        completionStatus: input.completionStatus,
        remarks: input.remarks,
        uploadedImageUrl: input.uploadedImageUrl,
        remarks1: input.remarks1,
      },
    });
  },

  async markAdminDone(entryIds: bigint[]) {
    return prisma.checklistEntry.updateMany({
      where: { id: { in: entryIds } },
      data: { adminDone: true },
    });
  },

  async markLeave(input: LeaveInput, requesterId: number, markedByRole: string) {
    if (markedByRole !== "ADMIN" && input.userId !== requesterId) {
      throw Object.assign(new Error("You can only mark leave for yourself"), { status: 403 });
    }

    const start = new Date(input.startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(input.endDate);
    end.setUTCHours(23, 59, 59, 999);

    return prisma.checklistEntry.updateMany({
      where: {
        assignedUserId: input.userId,
        taskStartDate: { gte: start, lte: end },
        actualDate: null,
        adminDone: false,
      },
      data: { leaveStatus: true, actualDate: start },
    });
  },
};
