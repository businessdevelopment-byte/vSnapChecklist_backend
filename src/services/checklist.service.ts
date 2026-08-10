import { Prisma, TaskTemplate } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  ChecklistQueryInput,
  SubmitChecklistInput,
  LeaveInput,
  ChecklistStatsQueryInput,
  PreviewQueryInput,
  TransferredInQueryInput,
  LeaveLogsQueryInput,
} from "../schemas/checklist.schemas";

// ─────────────────────────────────────────
// Working-day helpers
// ─────────────────────────────────────────

/** Returns YYYY-MM-DD key for a Date (UTC midnight) */
function dateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Converts a Date returned by pg for a DATE column to UTC midnight of the
 * correct calendar date. pg applies the local timezone offset when converting
 * PostgreSQL DATE → JS Date, so e.g. DATE 2026-06-08 in an IST (UTC+5:30)
 * server becomes 2026-06-07T18:30:00Z. Using local date components corrects this.
 */
function toUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * WHERE fragment: entries permanently assigned to `userId`, excluding any
 * currently on an active loan away from them — exactly what getEntries shows
 * for that user's own Checklist page. Deliberately does NOT pull in entries
 * on loan TO `userId`: those are handled exclusively via the Delegation
 * page's "Transferred Tasks" section while the loan is active (see
 * getTransferredIn), never via the Checklist page's own list. Used by
 * per-user views that are paired 1:1 with that list (getStats, getHistory,
 * getCalendarSummary) — pulling in on-loan-to-them entries there would make
 * the badge/chart disagree with what the page's own list actually shows.
 */
function assignedExcludingOnLoan(userId: number, now: Date): Prisma.ChecklistEntryWhereInput {
  // transferValidUntil: null covers both "never transferred" and entries
  // transferred under the old permanent-reassignment scheme (before this
  // temporary-transfer overlay existed) — transferredToId can be non-null
  // there with no expiry ever set, and that must NOT read as "still on an
  // active loan" (a `lt`/`gte` comparison against a null column is always
  // false in SQL, so omitting this branch silently hid those entries from
  // every userId-scoped view, including their own owner's Checklist page).
  return {
    assignedUserId: userId,
    OR: [
      { transferredToId: null },
      { transferValidUntil: null },
      { transferValidUntil: { lt: now } },
    ],
  };
}

/**
 * WHERE fragment selecting entries whose CURRENT effective owner is `userId`
 * — either they're the permanent assignee (per assignedExcludingOnLoan
 * above) or they're the active transferee. For cross-staff reporting views
 * (getStaffStats, getMonthlyStats) where each row represents "how much is
 * this person really doing right now," regardless of which page's UI they
 * used to do it — unlike the per-user views above, there's no single list
 * on the same page for this number to disagree with.
 */
function ownedByEffective(userId: number, now: Date): Prisma.ChecklistEntryWhereInput {
  return {
    OR: [
      assignedExcludingOnLoan(userId, now),
      { transferredToId: userId, transferValidUntil: { gte: now } },
    ],
  };
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
// Occurrence matching (shared by real backfill + virtual preview)
// ─────────────────────────────────────────

/**
 * Finds every (template, day) pair that should have a checklist entry,
 * given a set of active templates, a set of working days, and the keys
 * ("templateId__date") that already have a real entry. Shared by
 * backfillUser() (persists real rows) and previewUpcoming() (computes
 * virtual rows only) so the frequency/working-day rules never diverge
 * between the two.
 */
function matchingOccurrences<T extends TaskTemplate>(
  templates: T[],
  workingDays: Date[],
  existingKeys: Set<string>
): { template: T; day: Date }[] {
  const out: { template: T; day: Date }[] = [];

  for (const template of templates) {
    const tStart = toUtcDay(new Date(template.startDate));
    const tEnd = template.lastDate ? toUtcDay(new Date(template.lastDate)) : null;

    for (const day of workingDays) {
      if (day < tStart) continue;
      if (tEnd && day > tEnd) continue;
      const key = `${template.id}__${dateKey(day)}`;
      if (existingKeys.has(key)) continue;
      if (!shouldGenerateForDate(template.frequency, tStart, day)) continue;

      out.push({ template, day });
    }
  }

  return out;
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
  const toCreate: Prisma.ChecklistEntryCreateManyInput[] = matchingOccurrences(
    templates,
    workingDays,
    existingKeys
  ).map(({ template, day }) => ({
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
    sampleImageUrl: template.sampleImageUrl ?? null,
  }));

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
   * Clears the "on loan" overlay (transferredToId/transferValidUntil) once
   * its window has passed — the lazy-on-read equivalent of a cron job, since
   * this backend has none. Cheap/global, same style as materializeTasks.
   */
  async reconcileExpiredTransfers(): Promise<void> {
    const today = toUtcDay(new Date());
    await prisma.checklistEntry.updateMany({
      where: { transferredToId: { not: null }, transferValidUntil: { lt: today } },
      data: { transferredToId: null, transferValidUntil: null },
    });
  },

  /**
   * Called at start of every GET /api/checklist.
   * Ensures today (and up to 7 days back) has entries for the user.
   */
  async materializeTasks(userId: number, targetDate: Date): Promise<void> {
    // Skip task generation for INACTIVE users
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!userRecord || userRecord.status === "INACTIVE") return;

    const today = new Date(targetDate);
    today.setUTCHours(0, 0, 0, 0);

    const { holidayKeys, skipSundays } = await loadCalendarConfig();

    // Always backfill a 30-day window so templates added after the initial
    // setup are caught on the next checklist load. skipDuplicates in
    // backfillUser makes this safe and idempotent.
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const earliest = await prisma.taskTemplate.findFirst({
      where: { assignedUserId: userId, isActive: true },
      orderBy: { startDate: "asc" },
      select: { startDate: true },
    });

    if (!earliest) return;

    const fromDate = earliest.startDate > thirtyDaysAgo
      ? earliest.startDate
      : thirtyDaysAgo;

    await backfillUser(userId, fromDate, today, holidayKeys, skipSundays);
  },

  /**
   * Materializes real entries for exactly the requested range, no more —
   * used by mutations (mark leave, transfer) that need real rows to act on,
   * unlike materializeTasks() above (read path, always backfills to "today").
   */
  async ensureGenerated(userId: number, fromDate: Date, toDate: Date): Promise<void> {
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!userRecord || userRecord.status === "INACTIVE") return;

    const { holidayKeys, skipSundays } = await loadCalendarConfig();
    await backfillUser(userId, fromDate, toDate, holidayKeys, skipSundays);
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
    await this.reconcileExpiredTransfers();

    const { skip, take, page, limit } = getPaginationParams(query);

    const targetDate = toUtcDay(query.date ? new Date(query.date) : new Date());
    const now = toUtcDay(new Date());

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

    if (userId) {
      // Hides entries currently on loan (temporary transfer) to someone else
      // — only meaningful for a SPECIFIC user's own list (they surface on the
      // Delegation page's "Transferred Tasks" section for the receiving user
      // instead, via getTransferredIn below). The admin's "All users"
      // aggregate view must NOT drop these — they're still real, active
      // tasks system-wide, and getStats/getCalendarSummary already count
      // them in that view, so hiding them here just breaks the two views'
      // totals against each other.
      Object.assign(where, assignedExcludingOnLoan(userId, now));
    }
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
      // Overdue always means "before today," full stop — it ignores the
      // generic date-range block above entirely (both bounds, not just the
      // upper one), because that range describes a different page state
      // (which day's snapshot the other tabs are showing) that has nothing
      // to do with what's overdue. Previously this carried over the range's
      // lower bound if present, which silently made "Overdue" always return
      // 0 under the page's own default filter (startDate=endDate=today
      // merges to an impossible {gte: today, lt: today}), correct only by
      // coincidence when something else had cleared startDate first.
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

  /**
   * Checklist entries currently on loan (temporary transfer) TO the given
   * user — the data behind the Delegation page's "Transferred Tasks" section.
   * assignedUser here is the ORIGINAL owner, not the caller.
   */
  async getTransferredIn(query: TransferredInQueryInput, requesterId: number, requesterRole: string) {
    await this.reconcileExpiredTransfers();

    const now = toUtcDay(new Date());
    const userId = requesterRole === "ADMIN" ? query.userId ?? requesterId : requesterId;

    const entries = await prisma.checklistEntry.findMany({
      // Only still-pending ones — once the transferee submits it, it belongs
      // in Checklist history, not this "to do" list.
      where: { transferredToId: userId, transferValidUntil: { gte: now }, actualDate: null },
      orderBy: { taskStartDate: "asc" },
      include: {
        assignedUser: { select: { id: true, username: true } },
        department: { select: { id: true, name: true } },
      },
    });

    return entries;
  },

  /**
   * Computes (never persists) the checklist entries that WOULD be generated
   * for future dates, since materializeTasks() only ever creates real rows
   * up to today. Reuses matchingOccurrences() so the frequency/working-day
   * rules stay identical to the real backfill path.
   */
  async previewUpcoming(query: PreviewQueryInput, requesterId: number, requesterRole: string) {
    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;

    const today = toUtcDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const rangeStart = toUtcDay(new Date(query.startDate));
    const rangeEnd = toUtcDay(new Date(query.endDate));
    const from = rangeStart > tomorrow ? rangeStart : tomorrow;

    if (from > rangeEnd) return { data: [], truncated: false };

    const templateWhere: Prisma.TaskTemplateWhereInput = {
      isActive: true,
      startDate: { lte: rangeEnd },
      OR: [{ lastDate: null }, { lastDate: { gte: from } }],
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(userId ? { assignedUserId: userId } : { assignedUser: { status: "ACTIVE" } }),
    };

    const templates = await prisma.taskTemplate.findMany({
      where: templateWhere,
      include: {
        assignedUser: { select: { id: true, username: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (templates.length === 0) return { data: [], truncated: false };

    const { holidayKeys, skipSundays } = await loadCalendarConfig();

    const workingDays: Date[] = [];
    const cursor = new Date(from);
    while (cursor <= rangeEnd) {
      if (isWorkingDay(cursor, holidayKeys, skipSundays)) {
        workingDays.push(new Date(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    if (workingDays.length === 0) return { data: [], truncated: false };

    // Skip any (template, day) that already has a real materialized entry —
    // e.g. an admin already ran /checklist/backfill ahead of time.
    const existing = await prisma.checklistEntry.findMany({
      where: {
        taskStartDate: { gte: from, lte: rangeEnd },
        templateId: { in: templates.map((t) => t.id) },
      },
      select: { templateId: true, taskStartDate: true },
    });
    const existingKeys = new Set(
      existing.map((e) => `${e.templateId}__${dateKey(e.taskStartDate)}`)
    );

    let occurrences = matchingOccurrences(templates, workingDays, existingKeys);

    const search = query.search?.trim().toLowerCase();
    if (search) {
      occurrences = occurrences.filter(
        ({ template }) =>
          template.description.toLowerCase().includes(search) ||
          template.taskCode.toLowerCase().includes(search) ||
          template.assignedUser.username.toLowerCase().includes(search)
      );
    }

    occurrences.sort((a, b) => a.day.getTime() - b.day.getTime());

    const PREVIEW_CAP = 1000;
    const truncated = occurrences.length > PREVIEW_CAP;
    const limited = truncated ? occurrences.slice(0, PREVIEW_CAP) : occurrences;

    const data = limited.map(({ template, day }) => ({
      id: `preview-${template.id}-${dateKey(day)}`,
      templateId: template.id,
      taskCode: template.taskCode,
      departmentId: template.departmentId,
      department: template.department,
      givenBy: template.givenBy,
      assignedUserId: template.assignedUserId,
      assignedUser: template.assignedUser,
      description: template.description,
      taskStartDate: day,
      taskStartTime: null as string | null,
      frequency: template.frequency,
      enableReminders: template.enableReminders,
      requireAttachment: template.requireAttachment,
      sampleImageUrl: template.sampleImageUrl,
      actualDate: null as Date | null,
      delayDays: null as number | null,
      completionStatus: null as Prisma.ChecklistEntryUncheckedCreateInput["completionStatus"],
      remarks: null as string | null,
      uploadedImageUrl: null as string | null,
      adminDone: false,
      leaveStatus: false,
      transferredToId: null as number | null,
      transferredTo: null as { id: number; username: string } | null,
      remarks1: null as string | null,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      isPreview: true as const,
    }));

    return { data, truncated };
  },

  async getHistory(query: ChecklistQueryInput, requesterId: number, requesterRole: string) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;
    const now = toUtcDay(new Date());

    const completionFilter: Prisma.ChecklistEntryWhereInput = {
      OR: [{ actualDate: { not: null } }, { leaveStatus: true }],
    };

    // Excludes anything currently on loan away — that work is handled (and
    // will show in history) via the Delegation page's "Transferred Tasks"
    // section instead, never here, matching what getEntries shows this user.
    const where: Prisma.ChecklistEntryWhereInput = userId
      ? { AND: [completionFilter, assignedExcludingOnLoan(userId, now)] }
      : completionFilter;

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
    const now = toUtcDay(new Date());

    const baseWhere: Prisma.ChecklistEntryWhereInput = {
      taskStartDate: { lte: today },
      ...(userId ? assignedExcludingOnLoan(userId, now) : {}),
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
    // Overdue always means "before today," full stop — it ignores
    // baseWhere's taskStartDate bounds entirely (both, not just the upper
    // one), same reasoning as getEntries' "overdue" branch: that range
    // describes which day's snapshot the other four counts above are using,
    // which has nothing to do with what's overdue. Previously this carried
    // over baseWhere's lower bound if present, which silently zeroed this
    // badge under the page's own default filter (startDate=endDate=today
    // merges to an impossible {gte: today, lt: today}) unless something else
    // had cleared it first.
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

  async getStaffStats(params?: { startDate?: Date; endDate?: Date; departmentId?: number; userId?: number }) {
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);

    const { startDate, endDate, departmentId, userId } = params ?? {};
    // Loan-active status is evaluated as of the end of the window being
    // queried, not real "today" — a historical week/range's stats should
    // reflect who held a task during THAT period, not who holds it as of
    // whenever this happens to be called. Capped at today (never look into
    // the future) so an in-progress week (endDate = its own not-yet-arrived
    // Sunday) still reflects live, current ownership rather than a
    // not-yet-happened loan expiry — only genuinely past weeks are affected.
    const now = toUtcDay(new Date());
    const asOf = endDate ? new Date(Math.min(toUtcDay(endDate).getTime(), now.getTime())) : now;

    // No assignedUserId/userId filter here — a task on loan to `userId` won't
    // have assignedUserId === userId, so filtering by userId at the query
    // level would silently drop it. The per-user filter is applied after
    // computing each entry's effective (post-transfer) owner below instead.
    const where: Prisma.ChecklistEntryWhereInput = {
      leaveStatus: false,
      // Only include entries belonging to ACTIVE users
      assignedUser: { status: "ACTIVE" },
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
        delayDays: true,
        transferredToId: true,
        transferValidUntil: true,
        assignedUser: { select: { username: true, email: true } },
        transferredTo: { select: { username: true, email: true } },
      },
    });

    const staffMap = new Map<
      number,
      { username: string; email: string; total: number; completed: number; onTime: number }
    >();
    for (const e of entries) {
      // A task currently on an active loan counts toward the transferee, not
      // the permanent assignee — otherwise the receiving staff member's
      // totals never reflect work they're actually holding/doing, and the
      // original assignee gets credited for work they didn't do.
      const isOnLoan = e.transferredToId != null && e.transferValidUntil != null && e.transferValidUntil >= asOf;
      const ownerId = isOnLoan ? e.transferredToId! : e.assignedUserId;
      if (userId != null && ownerId !== userId) continue;

      const owner = isOnLoan ? (e.transferredTo ?? e.assignedUser) : e.assignedUser;

      if (!staffMap.has(ownerId)) {
        staffMap.set(ownerId, {
          username: owner.username,
          email: owner.email ?? "",
          total: 0,
          completed: 0,
          onTime: 0,
        });
      }
      const s = staffMap.get(ownerId)!;
      s.total++;
      const isCompleted = e.actualDate || e.adminDone;
      if (isCompleted) {
        s.completed++;
        // MIS on-time metric — used by mis.service.ts's Checklist & Delegation
        // calculator. delayDays is only ever computed by submitEntry() at the
        // same time as actualDate — markAdminDone() never sets it, so an
        // adminDone-only completion always has delayDays === null with no
        // real evidence of lateness. Require actualDate before crediting
        // on-time, so those entries count as completed but not as on-time.
        if (e.actualDate && (e.delayDays === null || e.delayDays <= 0)) s.onTime++;
      }
    }

    return Array.from(staffMap.entries())
      .map(([id, s]) => ({
        userId: id,
        username: s.username,
        email: s.email,
        total: s.total,
        completed: s.completed,
        onTime: s.onTime,
        pending: s.total - s.completed,
        progress: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.progress - a.progress);
  },

  async getMonthlyStats(year: number, userId?: number, departmentId?: number) {
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const now = toUtcDay(new Date());

    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear =
      year === today.getUTCFullYear()
        ? today
        : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const where: Prisma.ChecklistEntryWhereInput = {
      taskStartDate: { gte: startOfYear, lte: endOfYear },
      leaveStatus: false,
      ...(userId ? ownedByEffective(userId, now) : { assignedUser: { status: "ACTIVE" } }),
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

    const today = toUtcDay(new Date());
    const isActiveTransferee = entry.transferredToId === submittedByUserId
      && entry.transferValidUntil != null && entry.transferValidUntil >= today;

    if (requesterRole !== "ADMIN" && entry.assignedUserId !== submittedByUserId && !isActiveTransferee) {
      throw Object.assign(new Error("Cannot submit someone else's task"), { status: 403 });
    }

    if (entry.requireAttachment && !input.uploadedImageUrl) {
      throw Object.assign(new Error("This task requires an attached image"), { status: 400 });
    }

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

    // The range may extend into the future, where no real entry exists yet —
    // materialize exactly this window first so the updateMany below can find it.
    await this.ensureGenerated(input.userId, start, end);

    const result = await prisma.checklistEntry.updateMany({
      where: {
        assignedUserId: input.userId,
        taskStartDate: { gte: start, lte: end },
        actualDate: null,
        adminDone: false,
      },
      data: { leaveStatus: true, actualDate: start },
    });

    // leaveStatus on the entries themselves carries no memory of who marked
    // it or when — this is the actual audit trail for that.
    await prisma.leaveLog.create({
      data: {
        userId: input.userId,
        markedByUserId: requesterId,
        startDate: start,
        endDate: end,
        reason: input.reason,
      },
    });

    return result;
  },

  async getLeaveLogs(query: LeaveLogsQueryInput, requesterId: number, requesterRole: string) {
    const effectiveUserId = requesterRole === "ADMIN" ? query.userId : requesterId;

    return prisma.leaveLog.findMany({
      where: effectiveUserId ? { userId: effectiveUserId } : undefined,
      orderBy: { markedAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, username: true } },
        markedBy: { select: { id: true, username: true } },
      },
    });
  },

  async getCalendarSummary(
    startDate: string,
    endDate: string,
    requesterId: number,
    requesterRole: string,
    filterUserId?: number
  ) {
    const today = toUtcDay(new Date());
    const userId = requesterRole === "ADMIN" ? filterUserId : requesterId;

    // Materialize tasks so today's entries exist
    if (userId) {
      await this.materializeTasks(userId, today);
    } else if (requesterRole === "ADMIN" && !filterUserId) {
      const activeUsers = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      await Promise.all(activeUsers.map((u) => this.materializeTasks(u.id, today)));
    }

    const where: Prisma.ChecklistEntryWhereInput = {
      taskStartDate: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
    // Same on-loan exclusion as getEntries, so a day's calendar badge count
    // matches what opening that day's checklist actually shows.
    if (userId) Object.assign(where, assignedExcludingOnLoan(userId, today));

    const groups = await prisma.checklistEntry.groupBy({
      by: ["taskStartDate"],
      where,
      _count: { _all: true },
      orderBy: { taskStartDate: "asc" },
    });

    const summary: Record<string, number> = {};
    for (const g of groups) {
      const key = toUtcDay(new Date(g.taskStartDate)).toISOString().slice(0, 10);
      summary[key] = (summary[key] ?? 0) + g._count._all;
    }
    return summary;
  },
};
