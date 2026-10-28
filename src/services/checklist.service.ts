import { Prisma, TaskTemplate } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  ChecklistQueryInput,
  SubmitChecklistInput,
  LeaveInput,
  ChecklistStatsQueryInput,
  ChecklistTabCountsQueryInput,
  PreviewQueryInput,
  TransferredInQueryInput,
  LeaveLogsQueryInput,
} from "../schemas/checklist.schemas";
import { REPORT_MAX_ROWS, tooManyRowsError, type ReportQueryInput } from "../schemas/report.schemas";

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

/**
 * The Checklist list's WHERE — shared by getEntries() and getTabCounts(), so
 * each tab's badge counts exactly the rows that tab lists.
 */
function checklistEntriesWhere(
  query: ChecklistTabCountsQueryInput & { status?: ChecklistQueryInput["status"] },
  userId: number | undefined,
  targetDate: Date,
  now: Date
): Prisma.ChecklistEntryWhereInput {
  const where: Prisma.ChecklistEntryWhereInput = {};

  if (userId) {
    // Hides entries currently on loan (temporary transfer) to someone else
    // — only meaningful for a SPECIFIC user's own list (they surface on the
    // Delegation page's "Transferred Tasks" section for the receiving user
    // instead, via getTransferredIn). The admin's "All users" aggregate view
    // must NOT drop these — they're still real, active tasks system-wide,
    // and getStats/getCalendarSummary already count them in that view, so
    // hiding them here just breaks the two views' totals against each other.
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

  // Each tab lists exactly the rows whose badge reads that status — the row
  // badge's precedence is Admin Done > Leave > Completed (MainChecklist
  // getStatus). markLeave() sets actualDate too, so "actualDate not null"
  // alone listed every leave day under Completed, tagged "Leave".
  if (query.status === "completed") {
    where.actualDate = { not: null };
    where.leaveStatus = false;
    where.adminDone = false;
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
    where.adminDone = false;
  } else if (query.status === "admin_done") {
    where.adminDone = true;
  }

  if (query.search) {
    // Under AND, not where.OR — assignedExcludingOnLoan() above already set
    // where.OR, and overwriting it brought on-loan tasks back on every search.
    where.AND = [
      {
        OR: [
          { description: { contains: query.search, mode: "insensitive" } },
          { taskCode: { contains: query.search, mode: "insensitive" } },
          { assignedUser: { username: { contains: query.search, mode: "insensitive" } } },
        ],
      },
    ];
  }
  return where;
}

type ChecklistReportStatus = "ADMIN_DONE" | "LEAVE" | "COMPLETED" | "OVERDUE" | "PENDING";

/** Same precedence as the Checklist page's own status badge (MainChecklist.tsx getStatus). */
function checklistReportStatus(
  e: { adminDone: boolean; leaveStatus: boolean; actualDate: Date | null; taskStartDate: Date },
  today: Date
): ChecklistReportStatus {
  if (e.adminDone) return "ADMIN_DONE";
  if (e.leaveStatus) return "LEAVE";
  if (e.actualDate) return "COMPLETED";
  if (e.taskStartDate < today) return "OVERDUE";
  return "PENDING";
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

// Postgres caps a statement at 65,535 bind parameters; an entry row binds 11,
// and the first load after a big import can create tens of thousands at once.
// Chunks are inserted a few at a time in parallel — one long serial insert
// was slower than the old per-user fan-out — while leaving most of the
// 10-connection pool free for other requests.
const CREATE_CHUNK = 1000;
const CREATE_PARALLEL = 4;

/**
 * Generates all missing checklist entries for the active templates matching
 * `templateWhere` across a date range. Respects working-day calendar
 * (Mon-Sat, no holidays). Shared by the per-user path and the all-users pass.
 */
async function backfillTemplates(
  templateWhere: Prisma.TaskTemplateWhereInput,
  fromDate: Date,
  toDate: Date,
  holidayKeys: Set<string>,
  skipSundays: boolean
): Promise<number> {
  const from = new Date(fromDate);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(toDate);
  to.setUTCHours(0, 0, 0, 0);

  // Active templates within the range
  const templates = await prisma.taskTemplate.findMany({
    where: {
      ...templateWhere,
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

  // Existing entries in range (to avoid duplicates). Keyed the same way as
  // the (templateId, taskStartDate) unique constraint.
  const existing = await prisma.checklistEntry.findMany({
    where: {
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

  const chunks: Prisma.ChecklistEntryCreateManyInput[][] = [];
  for (let i = 0; i < toCreate.length; i += CREATE_CHUNK) chunks.push(toCreate.slice(i, i + CREATE_CHUNK));

  let created = 0;
  for (let i = 0; i < chunks.length; i += CREATE_PARALLEL) {
    const results = await Promise.all(
      chunks
        .slice(i, i + CREATE_PARALLEL)
        .map((data) => prisma.checklistEntry.createMany({ data, skipDuplicates: true }))
    );
    created += results.reduce((sum, r) => sum + r.count, 0);
  }

  return created;
}

/** Generates all missing checklist entries for one user across a date range. */
function backfillUser(
  userId: number,
  fromDate: Date,
  toDate: Date,
  holidayKeys: Set<string>,
  skipSundays: boolean
): Promise<number> {
  return backfillTemplates({ assignedUserId: userId }, fromDate, toDate, holidayKeys, skipSundays);
}

// ─────────────────────────────────────────
// All-users materialization (admin read paths)
// ─────────────────────────────────────────

// An admin's "all users" view used to run materializeTasks once per active
// user (~7 queries each) on every read, and the dashboard alone makes several
// such reads per load. One batched pass covers everyone instead; concurrent
// callers for the same day share it, and a finished pass is reused briefly.
const ALL_PASS_TTL_MS = 60_000;
let allPass: { day: string; startedAt: number; promise: Promise<void> } | null = null;

/** Drops the cached all-users pass so the next read regenerates (templates changed). */
export function invalidateMaterializeCache(): void {
  allPass = null;
}

/**
 * Template occurrences on working days in [from, to] that have no real
 * entry yet — the days the lazy materializer hasn't reached. Shared by
 * previewUpcoming() (virtual rows on the Checklist page) and
 * countProjectedByUser() (MIS "planned" for the rest of a week), so both
 * apply the same frequency/working-day/existing-entry rules.
 */
async function projectOccurrences(templateWhere: Prisma.TaskTemplateWhereInput, from: Date, to: Date) {
  const templates = await prisma.taskTemplate.findMany({
    where: {
      ...templateWhere,
      isActive: true,
      startDate: { lte: to },
      OR: [{ lastDate: null }, { lastDate: { gte: from } }],
    },
    include: {
      assignedUser: { select: { id: true, username: true } },
      department: { select: { id: true, name: true } },
    },
  });
  if (templates.length === 0) return [];

  const { holidayKeys, skipSundays } = await loadCalendarConfig();

  const workingDays: Date[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    if (isWorkingDay(cursor, holidayKeys, skipSundays)) {
      workingDays.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (workingDays.length === 0) return [];

  // Skip any (template, day) that already has a real materialized entry —
  // e.g. an admin already ran /checklist/backfill ahead of time.
  const existing = await prisma.checklistEntry.findMany({
    where: {
      taskStartDate: { gte: from, lte: to },
      templateId: { in: templates.map((t) => t.id) },
    },
    select: { templateId: true, taskStartDate: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.templateId}__${dateKey(e.taskStartDate)}`));

  return matchingOccurrences(templates, workingDays, existingKeys);
}

async function runAllActivePass(today: Date): Promise<void> {
  const { holidayKeys, skipSundays } = await loadCalendarConfig();

  // Same 30-day window as materializeTasks; days before a template's own
  // start date are skipped by matchingOccurrences, so starting every template
  // at the window edge yields exactly the per-user result.
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  await backfillTemplates(
    { assignedUser: { status: "ACTIVE" } },
    thirtyDaysAgo,
    today,
    holidayKeys,
    skipSundays
  );
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
   * The all-users equivalent of materializeTasks(), for admin views with no
   * user selected. One batched pass for every ACTIVE user; concurrent callers
   * for the same day share it, and a finished pass is reused for
   * ALL_PASS_TTL_MS (template writes call invalidateMaterializeCache()).
   */
  async materializeAllActive(targetDate: Date): Promise<void> {
    const today = new Date(targetDate);
    today.setUTCHours(0, 0, 0, 0);
    const day = dateKey(today);

    if (allPass && allPass.day === day && Date.now() - allPass.startedAt < ALL_PASS_TTL_MS) {
      return allPass.promise;
    }

    const pass = { day, startedAt: Date.now(), promise: runAllActivePass(today) };
    allPass = pass;
    // A failed pass must not be reused — the next read retries it.
    pass.promise.catch(() => {
      if (allPass === pass) allPass = null;
    });
    return pass.promise;
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

  /**
   * Runs before any Checklist list read (getEntries, getTabCounts): clears
   * expired loans and generates the entries due so far, then says which user
   * the read is scoped to. Both reads doing this keeps a badge from counting
   * before the day's tasks exist while the list beside it shows them.
   */
  async prepareListRead(
    query: { userId?: number; date?: string },
    requesterId: number,
    requesterRole: string
  ) {
    await this.reconcileExpiredTransfers();

    const targetDate = toUtcDay(query.date ? new Date(query.date) : new Date());
    const now = toUtcDay(new Date());
    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;

    if (userId) {
      await this.materializeTasks(userId, targetDate);
    } else if (requesterRole === "ADMIN" && !query.userId) {
      await this.materializeAllActive(targetDate);
    }
    return { userId, targetDate, now };
  },

  async getEntries(query: ChecklistQueryInput, requesterId: number, requesterRole: string) {
    const { userId, targetDate, now } = await this.prepareListRead(query, requesterId, requesterRole);
    const { skip, take, page, limit } = getPaginationParams(query);
    const where = checklistEntriesWhere(query, userId, targetDate, now);
    const order = query.order ?? "asc";

    const [entries, total] = await Promise.all([
      prisma.checklistEntry.findMany({
        where,
        skip,
        take,
        // id last: without a unique tiebreaker, rows sharing a date and user
        // can swap between page requests and show twice or not at all.
        orderBy: [{ taskStartDate: order }, { assignedUserId: "asc" }, { id: "asc" }],
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
   * The Checklist page's tab badges: each one counts exactly what that tab
   * lists under the same filters and search (same WHERE as getEntries).
   * getStats counts differently — All without leave, Pending including Admin
   * Done, no search — and stays as it is for Dashboard and Calendar.
   */
  async getTabCounts(query: ChecklistTabCountsQueryInput, requesterId: number, requesterRole: string) {
    const { userId, targetDate, now } = await this.prepareListRead(query, requesterId, requesterRole);
    const count = (status?: ChecklistQueryInput["status"]) =>
      prisma.checklistEntry.count({ where: checklistEntriesWhere({ ...query, status }, userId, targetDate, now) });

    const [all, pending, completed, overdue, leave] = await Promise.all([
      count(),
      count("pending"),
      count("completed"),
      count("overdue"),
      count("leave"),
    ]);
    return { all, pending, completed, overdue, leave };
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
  /**
   * Per-user count of checklist occurrences in [fromDate, toDate] that have
   * no real entry yet, counted from today onward — MIS "planned" for the
   * rest of a week, which the lazy materializer hasn't reached. ACTIVE users
   * only, matching getStaffStats(). Takes UTC-midnight-based week bounds.
   */
  async countProjectedByUser(fromDate: Date, toDate: Date, userId?: number): Promise<Map<number, number>> {
    const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const today = toUtcDay(new Date());
    const rangeStart = utcDay(fromDate);
    const rangeEnd = utcDay(toDate);
    const from = rangeStart > today ? rangeStart : today;

    const counts = new Map<number, number>();
    if (from > rangeEnd) return counts;

    const occurrences = await projectOccurrences(
      userId != null
        ? { assignedUserId: userId, assignedUser: { status: "ACTIVE" } }
        : { assignedUser: { status: "ACTIVE" } },
      from,
      rangeEnd
    );
    for (const { template } of occurrences) {
      counts.set(template.assignedUserId, (counts.get(template.assignedUserId) ?? 0) + 1);
    }
    return counts;
  },

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
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(userId ? { assignedUserId: userId } : { assignedUser: { status: "ACTIVE" } }),
    };

    let occurrences = await projectOccurrences(templateWhere, from, rangeEnd);
    if (occurrences.length === 0) return { data: [], truncated: false };

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

    const [total, completed, leave, overdue] = await Promise.all([
      prisma.checklistEntry.count({ where: { ...baseWhere, leaveStatus: false } }),
      prisma.checklistEntry.count({ where: { ...baseWhere, actualDate: { not: null }, leaveStatus: false } }),
      prisma.checklistEntry.count({ where: { ...baseWhere, leaveStatus: true } }),
      // Overdue always means "before today," full stop — it ignores
      // baseWhere's taskStartDate bounds entirely (both, not just the upper
      // one), same reasoning as getEntries' "overdue" branch: that range
      // describes which day's snapshot the other counts are using, which has
      // nothing to do with what's overdue. Previously this carried over
      // baseWhere's lower bound if present, which silently zeroed this badge
      // under the page's own default filter (startDate=endDate=today merges
      // to an impossible {gte: today, lt: today}) unless something else had
      // cleared it first.
      prisma.checklistEntry.count({
        where: {
          ...baseWhere,
          actualDate: null,
          adminDone: false,
          leaveStatus: false,
          taskStartDate: { lt: today },
        },
      }),
    ]);

    const pending = total - completed;
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
    // endDate's own calendar day, read in UTC — callers pass UTC midnight
    // ("YYYY-MM-DD") or a week's Sunday 23:59:59.999Z, and toUtcDay's local
    // read turned the latter into Monday in IST (so a loan ending on the
    // week's Sunday counted as already expired for that week).
    const endDay = endDate
      ? new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))
      : now;
    const asOf = new Date(Math.min(endDay.getTime(), now.getTime()));

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

    // Counted in the database, grouped by everything that decides an entry's
    // effective owner — the group count stays tiny however many rows match,
    // instead of loading every matching entry into memory.
    const [totals, completedGroups, onTimeGroups] = await Promise.all([
      prisma.checklistEntry.groupBy({
        by: ["assignedUserId", "transferredToId", "transferValidUntil"],
        where,
        _count: { _all: true },
      }),
      prisma.checklistEntry.groupBy({
        by: ["assignedUserId", "transferredToId", "transferValidUntil"],
        where: { AND: [where, { OR: [{ actualDate: { not: null } }, { adminDone: true }] }] },
        _count: { _all: true },
      }),
      // MIS on-time metric — used by mis.service.ts's Checklist & Delegation
      // calculator. delayDays is only ever computed by submitEntry() at the
      // same time as actualDate — markAdminDone() never sets it, so an
      // adminDone-only completion always has delayDays === null with no real
      // evidence of lateness. Require actualDate before crediting on-time, so
      // those entries count as completed but not as on-time.
      prisma.checklistEntry.groupBy({
        by: ["assignedUserId", "transferredToId", "transferValidUntil"],
        where: {
          AND: [where, { actualDate: { not: null } }, { OR: [{ delayDays: null }, { delayDays: { lte: 0 } }] }],
        },
        _count: { _all: true },
      }),
    ]);

    // A task currently on an active loan counts toward the transferee, not
    // the permanent assignee — otherwise the receiving staff member's totals
    // never reflect work they're actually holding/doing, and the original
    // assignee gets credited for work they didn't do.
    const ownerOf = (g: { assignedUserId: number; transferredToId: number | null; transferValidUntil: Date | null }) =>
      g.transferredToId != null && g.transferValidUntil != null && g.transferValidUntil >= asOf
        ? g.transferredToId
        : g.assignedUserId;

    const staffMap = new Map<number, { total: number; completed: number; onTime: number }>();
    const tally = (groups: typeof totals, field: "total" | "completed" | "onTime") => {
      for (const g of groups) {
        const ownerId = ownerOf(g);
        if (userId != null && ownerId !== userId) continue;
        const s = staffMap.get(ownerId) ?? { total: 0, completed: 0, onTime: 0 };
        s[field] += g._count._all;
        staffMap.set(ownerId, s);
      }
    };
    tally(totals, "total");
    tally(completedGroups, "completed");
    tally(onTimeGroups, "onTime");

    const owners = await prisma.user.findMany({
      where: { id: { in: [...staffMap.keys()] } },
      select: { id: true, username: true, email: true },
    });
    const ownerById = new Map(owners.map((u) => [u.id, u]));

    return Array.from(staffMap.entries())
      .map(([id, s]) => ({
        userId: id,
        username: ownerById.get(id)?.username ?? "",
        email: ownerById.get(id)?.email ?? "",
        total: s.total,
        completed: s.completed,
        onTime: s.onTime,
        pending: s.total - s.completed,
        progress: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.progress - a.progress || a.username.localeCompare(b.username));
  },

  /**
   * Every checklist entry dated in [startDate, endDate] plus a per-person
   * summary, for the Download Report page. The summary follows
   * getStaffStats()'s definitions exactly — leave excluded from the total,
   * admin-done counts as completed, on-time needs a real submission, and a
   * task on an active loan is credited to the transferee — so the file
   * agrees with the Dashboard's staff table for the same range.
   */
  async getReport(query: ReportQueryInput, requesterId: number, requesterRole: string) {
    await this.reconcileExpiredTransfers();

    const today = toUtcDay(new Date());
    const userId = requesterRole === "ADMIN" ? query.userId : requesterId;

    // The same lazy generation the Checklist page's own read runs, so recent
    // pending/overdue days exist even if nobody has opened that page today.
    if (userId) await this.materializeTasks(userId, today);
    else await this.materializeAllActive(today);

    const start = new Date(query.startDate);
    const requestedEnd = new Date(query.endDate);
    // Real entries only exist up to today — later days are projections (see
    // previewUpcoming), apart from the odd row a leave/transfer pre-created,
    // so counting those would make a future range look randomly partial.
    // Also the loan as-of day, matching getStaffStats.
    const end = requestedEnd < today ? requestedEnd : today;
    if (start > end) return { rows: [], summary: [], countedUntil: dateKey(end) };

    const where: Prisma.ChecklistEntryWhereInput = {
      taskStartDate: { gte: start, lte: end },
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      // Widened to anything loaned to them as well — narrowed to the
      // effective owner below, once each row's loan state is known.
      ...(userId ? { OR: [{ assignedUserId: userId }, { transferredToId: userId }] } : {}),
    };

    const count = await prisma.checklistEntry.count({ where });
    if (count > REPORT_MAX_ROWS) throw tooManyRowsError("checklist", count);

    const entries = await prisma.checklistEntry.findMany({
      where,
      orderBy: [{ taskStartDate: "asc" }, { assignedUserId: "asc" }, { id: "asc" }],
      select: {
        taskCode: true,
        givenBy: true,
        description: true,
        taskStartDate: true,
        frequency: true,
        actualDate: true,
        delayDays: true,
        completionStatus: true,
        remarks: true,
        uploadedImageUrl: true,
        adminDone: true,
        leaveStatus: true,
        transferValidUntil: true,
        assignedUser: { select: { id: true, username: true } },
        transferredTo: { select: { id: true, username: true } },
        department: { select: { name: true } },
      },
    });

    const owned = entries
      .map((e) => {
        const onLoanTo =
          e.transferredTo && e.transferValidUntil && e.transferValidUntil >= end ? e.transferredTo : null;
        return { e, onLoanTo, owner: onLoanTo ?? e.assignedUser };
      })
      .filter(({ owner }) => !userId || owner.id === userId);

    const tallies = new Map<
      number,
      { userId: number; username: string; total: number; completed: number; onTime: number; overdue: number; leave: number }
    >();
    for (const { e, owner } of owned) {
      const t = tallies.get(owner.id) ?? {
        userId: owner.id, username: owner.username, total: 0, completed: 0, onTime: 0, overdue: 0, leave: 0,
      };
      if (e.leaveStatus) {
        t.leave++;
      } else {
        const completed = e.actualDate != null || e.adminDone;
        t.total++;
        if (completed) t.completed++;
        if (e.actualDate != null && (e.delayDays == null || e.delayDays <= 0)) t.onTime++;
        if (!completed && e.taskStartDate < today) t.overdue++;
      }
      tallies.set(owner.id, t);
    }

    const rows = owned.map(({ e, onLoanTo }) => ({
      taskDate: dateKey(e.taskStartDate),
      taskCode: e.taskCode,
      department: e.department.name,
      givenBy: e.givenBy,
      assignedTo: e.assignedUser.username,
      transferredTo: onLoanTo?.username ?? null,
      description: e.description,
      frequency: e.frequency,
      status: checklistReportStatus(e, today),
      completedOn: e.actualDate ? dateKey(e.actualDate) : null,
      delayDays: e.delayDays,
      completionStatus: e.completionStatus,
      remarks: e.remarks,
      attachmentUrl: e.uploadedImageUrl,
    }));

    const summary = [...tallies.values()]
      .map((t) => ({
        ...t,
        pending: t.total - t.completed,
        completionRate: t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0,
      }))
      .sort((a, b) => a.username.localeCompare(b.username));

    return { rows, summary, countedUntil: dateKey(end) };
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

    // Per-day counts from the database (at most 366 groups), bucketed into
    // months here — instead of loading a whole year of entries.
    const [perDay, completedPerDay] = await Promise.all([
      prisma.checklistEntry.groupBy({ by: ["taskStartDate"], where, _count: { _all: true } }),
      prisma.checklistEntry.groupBy({
        by: ["taskStartDate"],
        where: { AND: [where, { OR: [{ actualDate: { not: null } }, { adminDone: true }] }] },
        _count: { _all: true },
      }),
    ]);

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES[i],
      completed: 0,
      pending: 0,
    }));

    for (const g of perDay) months[new Date(g.taskStartDate).getUTCMonth()].pending += g._count._all;
    for (const g of completedPerDay) {
      const m = new Date(g.taskStartDate).getUTCMonth();
      months[m].completed += g._count._all;
      months[m].pending -= g._count._all;
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
        // Re-submitting a completed task (e.g. replacing its image from the
        // Completed tab) keeps the day it was really done — resetting it to
        // today used to turn an on-time task into a late one.
        ...(entry.actualDate ? {} : { actualDate: today, delayDays }),
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
      await this.materializeAllActive(today);
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
