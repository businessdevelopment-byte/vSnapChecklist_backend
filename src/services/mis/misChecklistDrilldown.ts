// MIS drill-down for Checklist & Delegation, in the shape the MIS doc describes:
//   Level 1 — the person's totals for the week (one row)
//   Level 2 — one row per task title (checklist and delegation alike)
//   Level 3 — one row per occurrence behind a title, with a status
//
// Pure: takes the rows the checklist and delegation services already load, so
// the numbers follow the same rules as the MIS table (getStaffStats,
// getMisStaffStats, misCalculators.checklistDelegationCalculator).

// AWAITING_APPROVAL: a delegation the user submitted as Done that an admin has
// not approved yet (VERIFY_PENDING). Not Pending, not Overdue, not yet Done.
export type DrilldownStatus = "ON_TIME" | "DONE_LATE" | "DONE_NO_TIME" | "AWAITING_APPROVAL" | "OVERDUE" | "PENDING";

export interface ChecklistEntryRow {
  description: string;
  taskStartDate: Date;
  actualDate: Date | null;
  delayDays: number | null;
  adminDone: boolean;
}

export interface ProjectedRow {
  title: string;
  day: Date;
}

export interface DelegationRow {
  title: string;
  taskStartDate: Date;
  deadline: Date;
  status: string;
  isLate: boolean | null;
  completedOn: Date | null;
  submittedOn: Date | null;
}

export interface DrilldownTask {
  source: "CHECKLIST" | "DELEGATION";
  title: string;
  taskStartDate: string; // YYYY-MM-DD
  deadline: string | null;
  completedOn: string | null;
  // Date the user submitted it, while it waits for admin approval.
  submittedOn: string | null;
  delayDays: number | null;
  inWeek: boolean;
  // false = a day not materialized yet (projected from the template); no entry exists.
  generated: boolean;
  status: DrilldownStatus;
}

export interface DrilldownSummary {
  target: number; // planned this week (checklist days + delegation tasks)
  actual: number; // completed this week
  achievementPct: number | null;
  notDone: number;
  notDonePct: number | null;
  doneOnTime: number;
  notDoneOnTime: number;
  notDoneOnTimePct: number | null;
  weekPending: number;
  allPendingTillDate: number;
  // Submitted, waiting for admin approval (any date up to the week's end).
  awaitingApproval: number;
}

export interface DrilldownPage extends DrilldownSummary {
  title: string;
  sources: ("CHECKLIST" | "DELEGATION")[];
}

export interface ChecklistDrilldown {
  weekStart: string;
  weekEnd: string;
  person: DrilldownSummary;
  pages: DrilldownPage[];
  tasks: DrilldownTask[];
}

const COMPLETED: ReadonlySet<DrilldownStatus> = new Set(["ON_TIME", "DONE_LATE", "DONE_NO_TIME"]);
// Still with the user. AWAITING_APPROVAL is in neither set.
const OPEN: ReadonlySet<DrilldownStatus> = new Set(["OVERDUE", "PENDING"]);

const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);
const ratio = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 100) : null);

// Same definitions as mis.service.ts toRow(): Target = planned, Done = actual,
// Not Done On Time = target − on-time, all pending = open items dated up to the week's end.
function summarize(list: DrilldownTask[]): DrilldownSummary {
  const inWeek = list.filter((t) => t.inWeek);
  const target = inWeek.length;
  const actual = inWeek.filter((t) => COMPLETED.has(t.status)).length;
  const doneOnTime = inWeek.filter((t) => t.status === "ON_TIME").length;
  const notDone = Math.max(0, target - actual);
  const notDoneOnTime = Math.max(0, target - doneOnTime);
  return {
    target,
    actual,
    achievementPct: ratio(actual, target),
    notDone,
    notDonePct: ratio(notDone, target),
    doneOnTime,
    notDoneOnTime,
    notDoneOnTimePct: ratio(notDoneOnTime, target),
    // Real entries/tasks only — days not generated yet are not "open" work yet.
    weekPending: inWeek.filter((t) => t.generated && OPEN.has(t.status)).length,
    allPendingTillDate: list.filter((t) => OPEN.has(t.status)).length,
    awaitingApproval: list.filter((t) => t.status === "AWAITING_APPROVAL").length,
  };
}

export function buildChecklistDrilldown(input: {
  weekStart: Date;
  weekEnd: Date;
  today: Date;
  checklist: { entries: ChecklistEntryRow[]; projected: ProjectedRow[] };
  delegation: DelegationRow[];
}): ChecklistDrilldown {
  const { weekStart, weekEnd, today } = input;
  const inRange = (d: Date) => d >= weekStart && d <= weekEnd;
  const tasks: DrilldownTask[] = [];

  for (const e of input.checklist.entries) {
    let status: DrilldownStatus;
    if (e.actualDate != null) status = (e.delayDays ?? 0) > 0 ? "DONE_LATE" : "ON_TIME";
    else if (e.adminDone) status = "DONE_NO_TIME";
    else status = e.taskStartDate < today ? "OVERDUE" : "PENDING";
    tasks.push({
      source: "CHECKLIST",
      title: e.description,
      taskStartDate: dateOnly(e.taskStartDate),
      deadline: null,
      completedOn: e.actualDate ? dateOnly(e.actualDate) : null,
      submittedOn: null, // Checklist has no approval step.
      delayDays: e.delayDays,
      inWeek: inRange(e.taskStartDate),
      generated: true,
      status,
    });
  }

  // Days in the week that have no entry yet. They are in Target and All
  // Pending, the same as the MIS table, so they appear here too.
  for (const p of input.checklist.projected) {
    tasks.push({
      source: "CHECKLIST",
      title: p.title,
      taskStartDate: dateOnly(p.day),
      deadline: null,
      completedOn: null,
      submittedOn: null,
      delayDays: null,
      inWeek: inRange(p.day),
      generated: false,
      status: "PENDING",
    });
  }

  for (const t of input.delegation) {
    let status: DrilldownStatus;
    if (t.status === "DONE") {
      status = t.isLate === false ? "ON_TIME" : t.isLate === true ? "DONE_LATE" : "DONE_NO_TIME";
    } else if (t.status === "VERIFY_PENDING") {
      status = "AWAITING_APPROVAL";
    } else {
      // Deadline = extended end date when set, else the start date.
      status = t.deadline < today ? "OVERDUE" : "PENDING";
    }
    tasks.push({
      source: "DELEGATION",
      title: t.title,
      taskStartDate: dateOnly(t.taskStartDate),
      deadline: dateOnly(t.deadline),
      completedOn: t.completedOn ? dateOnly(t.completedOn) : null,
      submittedOn: t.submittedOn ? dateOnly(t.submittedOn) : null,
      // Delegation stores only whether a submission was late, not by how many days.
      delayDays: null,
      inWeek: inRange(t.taskStartDate),
      generated: true,
      status,
    });
  }

  tasks.sort((a, b) => a.taskStartDate.localeCompare(b.taskStartDate) || a.title.localeCompare(b.title));

  const byTitle = new Map<string, DrilldownTask[]>();
  for (const t of tasks) {
    const list = byTitle.get(t.title) ?? [];
    list.push(t);
    byTitle.set(t.title, list);
  }
  const pages: DrilldownPage[] = [...byTitle.entries()]
    .map(([title, list]) => ({
      title,
      sources: [...new Set(list.map((t) => t.source))],
      ...summarize(list),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    weekStart: dateOnly(weekStart),
    weekEnd: dateOnly(weekEnd),
    person: summarize(tasks),
    pages,
    tasks,
  };
}
