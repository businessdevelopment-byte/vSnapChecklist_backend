import { prisma } from "../../config/database";

// Builds the rows of the "Sync Checklist & Delegation - Server" sheet from
// the current DB state. Headers are the sheet's own legacy layout, and the
// words (Freq, Status, Admin Done, Task ID) are the ones the app's own
// importers accept (frontend MainSettings.tsx), so the sheet can be
// re-imported. Dates follow the Download Report's rules
// (checklist.service.ts getReport / delegation.service.ts getReport) so the
// sheet shows the same calendar day as the app.

export type SheetCellType = "text" | "number" | "date" | "datetime";
// date = "YYYY-MM-DD" (a calendar day), datetime = ISO instant.
export type SheetCell = string | number | null;

export interface SheetTable {
  tab: string;
  headers: string[];
  types: SheetCellType[];
  rows: SheetCell[][];
}

export const CHECKLIST_COLUMNS: [string, SheetCellType][] = [
  ["Timestamp", "datetime"],
  ["Task ID", "text"],
  ["Department", "text"],
  ["Given By", "text"],
  ["Name", "text"],
  ["Task Descriptions", "text"],
  ["Task Start Date", "date"],
  ["Freq", "text"],
  ["Enable Reminders", "text"],
  ["Require Attachment", "text"],
  ["Actual", "date"],
  ["Delay", "number"],
  ["Status", "text"],
  ["Remarks", "text"],
  ["Uploaded Image", "text"],
  ["Admin Done", "text"],
];

// "Upload Imgage" is the sheet's own spelling — headers must match exactly.
export const DELEGATION_COLUMNS: [string, SheetCellType][] = [
  ["Timestamp", "datetime"],
  ["Task ID", "text"],
  ["Department", "text"],
  ["Given By", "text"],
  ["Name", "text"],
  ["Task Description", "text"],
  ["Task Start Date", "date"],
  ["Freq", "text"],
  ["Enable Reminders", "text"],
  ["Require Attachment", "text"],
  ["Planned Date", "date"],
  ["Actual", "date"],
  ["Delay", "number"],
  ["Status", "text"],
  ["Remarks", "text"],
  ["Upload Imgage", "text"],
  ["Update Date", "date"],
  ["Color Code For", "text"],
  ["Color Code", "text"],
  ["Admin Done", "text"],
];

// The importers' words (MainSettings.tsx FREQ_MAP / DELEGATION_FREQ_MAP).
const FREQ_WORD: Record<string, string> = {
  DAILY: "Daily",
  ALTERNATE_DAY: "Alternate Day",
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
  END_OF_1ST_WEEK: "End of 1st Week",
  END_OF_2ND_WEEK: "End of 2nd Week",
  END_OF_3RD_WEEK: "End of 3rd Week",
  END_OF_4TH_WEEK: "End of 4th Week",
  END_OF_LAST_WEEK: "End of Last Week",
  ONE_TIME: "One Time",
  CRITICAL: "Critical",
  URGENT: "Urgent",
};

const COMPLETION_WORD: Record<string, string> = {
  YES: "Yes",
  NO: "No",
  NOT_REQUIRED: "Not Required",
  NOT_APPLICABLE: "N/A",
};

// The importer reads Status "Done" + Admin Done "Done" as approved, "Done"
// alone as awaiting review, and "Extend date" as an extension (PLANNED).
const DELEGATION_STATUS_WORD: Record<string, string | null> = {
  PENDING: null,
  PLANNED: "Extend date",
  VERIFY_PENDING: "Done",
  DONE: "Done",
};

const yesNo = (v: boolean) => (v ? "Yes" : "No");

// DATE columns come back as UTC midnight — their UTC date is the calendar day
// (same as the reports' dateKey / dateColumnKey).
const dateColumn = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

// Datetime columns are read as the server's own calendar day, as the
// Delegation report and submit() do.
const serverDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayNumber = (key: string) => Date.parse(`${key}T00:00:00Z`) / 86_400_000;

const CHECKLIST_PAGE = 5000;

export async function buildChecklistTable(tab: string): Promise<SheetTable> {
  const collected: { sortKey: [string, string, string, bigint]; row: SheetCell[] }[] = [];
  let cursor: bigint | undefined;

  // Paged by id so a large table never comes back in one query.
  for (;;) {
    const page = await prisma.checklistEntry.findMany({
      take: CHECKLIST_PAGE,
      ...(cursor !== undefined ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        createdAt: true,
        taskCode: true,
        givenBy: true,
        description: true,
        taskStartDate: true,
        frequency: true,
        enableReminders: true,
        requireAttachment: true,
        actualDate: true,
        delayDays: true,
        completionStatus: true,
        remarks: true,
        uploadedImageUrl: true,
        adminDone: true,
        leaveStatus: true,
        department: { select: { name: true } },
        assignedUser: { select: { username: true } },
      },
    });
    if (page.length === 0) break;
    cursor = page[page.length - 1].id;

    for (const e of page) {
      const taskDate = dateColumn(e.taskStartDate)!;
      const status = e.leaveStatus
        ? "Leave"
        : e.completionStatus
          ? COMPLETION_WORD[e.completionStatus] ?? e.completionStatus
          : null;
      collected.push({
        sortKey: [taskDate, e.taskCode, e.assignedUser.username, e.id],
        row: [
          e.createdAt.toISOString(),
          e.taskCode,
          e.department.name,
          e.givenBy,
          e.assignedUser.username,
          e.description,
          taskDate,
          FREQ_WORD[e.frequency] ?? e.frequency,
          yesNo(e.enableReminders),
          yesNo(e.requireAttachment),
          dateColumn(e.actualDate),
          e.delayDays ?? null,
          status,
          e.remarks ?? null,
          e.uploadedImageUrl ?? null,
          e.adminDone ? "Done" : null,
        ],
      });
    }
    if (page.length < CHECKLIST_PAGE) break;
  }

  // Stable order — by day, then task, then person, then row id — so each run
  // writes every row to the same place as long as nothing changed.
  collected.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      const x = a.sortKey[i] as string;
      const y = b.sortKey[i] as string;
      if (x !== y) return x < y ? -1 : 1;
    }
    return a.sortKey[3] < b.sortKey[3] ? -1 : a.sortKey[3] > b.sortKey[3] ? 1 : 0;
  });

  return {
    tab,
    headers: CHECKLIST_COLUMNS.map(([h]) => h),
    types: CHECKLIST_COLUMNS.map(([, t]) => t),
    rows: collected.map((c) => c.row),
  };
}

export async function buildDelegationTable(tab: string): Promise<SheetTable> {
  // Soft-deleted tasks are gone from the app, so they leave the sheet too.
  const tasks = await prisma.delegationTask.findMany({
    where: { isDeleted: false },
    orderBy: [{ taskStartDate: "asc" }, { taskCode: "asc" }],
    select: {
      createdAt: true,
      taskCode: true,
      givenBy: true,
      description: true,
      taskStartDate: true,
      taskEndDate: true,
      frequency: true,
      enableReminders: true,
      requireAttachment: true,
      status: true,
      department: { select: { name: true } },
      assignedUser: { select: { username: true } },
      history: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          status: true,
          submissionDate: true,
          remarks: true,
          imageUrl: true,
          reviewStatus: true,
          reviewNote: true,
          adminDoneStatus: true,
        },
      },
    },
  });

  const rows = tasks.map((t) => {
    // Due date: the extended date once extended, else the assigned date —
    // the same rule submit() and the report use.
    const planned = serverDay(t.taskEndDate ?? t.taskStartDate);
    const latest = t.history[0];
    // The Done submission behind the current state: awaiting review or approved.
    const done =
      t.status === "VERIFY_PENDING" || t.status === "DONE"
        ? t.history.find((h) => h.status === "DONE" && h.reviewStatus !== "REJECTED")
        : undefined;
    const actual = dateColumn(done?.submissionDate);
    const delay = actual ? Math.max(0, dayNumber(actual) - dayNumber(planned)) : null;
    // After a rejection the reviewer's note is the latest word on the task.
    const remarks =
      latest?.reviewStatus === "REJECTED" && latest.reviewNote ? latest.reviewNote : latest?.remarks ?? null;
    const adminDone = t.status === "DONE" || t.history.some((h) => h.adminDoneStatus?.trim().toLowerCase() === "done");

    return [
      t.createdAt.toISOString(),
      // The importer turns Task ID "123" into "DLG-123".
      t.taskCode.replace(/^DLG-/i, ""),
      t.department.name,
      t.givenBy,
      t.assignedUser.username,
      t.description,
      serverDay(t.taskStartDate),
      FREQ_WORD[t.frequency] ?? t.frequency,
      yesNo(t.enableReminders),
      yesNo(t.requireAttachment),
      planned,
      actual,
      delay,
      DELEGATION_STATUS_WORD[t.status] ?? null,
      remarks,
      done?.imageUrl ?? t.history.find((h) => h.imageUrl)?.imageUrl ?? null,
      dateColumn(latest?.submissionDate),
      null,
      null,
      adminDone ? "Done" : null,
    ] as SheetCell[];
  });

  return {
    tab,
    headers: DELEGATION_COLUMNS.map(([h]) => h),
    types: DELEGATION_COLUMNS.map(([, t]) => t),
    rows,
  };
}
