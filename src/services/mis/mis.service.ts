import type { MisSystemKey, MisWeeklyTarget } from "@prisma/client";
import { prisma } from "../../config/database";
import { buildPaginationMeta } from "../../utils/pagination";
import { getCurrentWeekBounds, getWeekBounds, toDateOnly } from "../../utils/misWeek";
import { misCalculators, type MisRowPartial } from "./misCalculators";
import { checklistService } from "../checklist.service";

const HISTORY_WEEKS_BACK = 8;

// Only Checklist & Delegation has assigned ("planned") work to count — the
// other systems' calculators leave planned/doneOnTime null.
const hasPlannedWork = (systemKey: MisSystemKey) => systemKey === "CHECKLIST_DELEGATION";

const emptyPartial = (systemKey: MisSystemKey): MisRowPartial => ({
  actual: 0,
  planned: hasPlannedWork(systemKey) ? 0 : null,
  doneOnTime: hasPlannedWork(systemKey) ? 0 : null,
  onTimePct: null,
  totalWork: null,
  weekPending: null,
  allPendingTillDate: null,
});

async function hydrateUsers(userIds: Iterable<number>) {
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, username: true, email: true, department: { select: { name: true } } },
  });
  return new Map(users.map((u) => [u.id, u]));
}

// Checklist entries are lazily materialized (see checklist.service.ts's
// "Task Generation" note) — a newly assigned template has no countable
// entry rows until someone loads the checklist. Materialize today's
// entries before computing, exactly like GET /api/checklist's admin path
// does, so a fresh assignment shows up on the MIS dashboard immediately.
// "Today" is the server's local date, same as the checklist's own reads.
async function materializeChecklistForToday(userId?: number) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (userId != null) {
    await checklistService.materializeTasks(userId, today);
    return;
  }
  await checklistService.materializeAllActive(today);
}

function addWeeks(weekStart: Date, weeks: number): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 7 * weeks);
  return d;
}

const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

interface RowInput {
  systemKey: MisSystemKey;
  user: { username: string; email: string | null; department: { name: string | null } | null } | undefined;
  week: { weekStart: Date; weekEnd: Date };
  thisWeek: MisWeeklyTarget | undefined; // plan/target row FOR this week (entered last week)
  nextWeek: MisWeeklyTarget | undefined; // plan row for next week (entered this week)
  current: MisRowPartial;
  last: MisRowPartial | undefined;
  next: MisRowPartial | undefined;
}

// One MIS row — the legacy sheet's columns, computed from the week's
// partial (P = planned, A = actual, T = done on time):
//   Actual % = A÷P · % Not Done = 100 − Actual % · Not Done = P − A
//   Not Done On Time = P − T · Not Done On Time % = (P − T)÷P
// "On time" is counted out of planned, not out of done (user decision).
function toRow(uid: number, r: RowInput) {
  const target = r.thisWeek?.target ?? null;
  const planned = r.current.planned;
  const actual = r.current.actual;
  const doneOnTime = r.current.doneOnTime;

  const percent =
    planned != null
      ? planned > 0 ? pct(actual, planned) : null
      : target != null && target > 0 ? pct(actual, target) : null;
  const notDone = planned != null ? Math.max(0, planned - actual) : null;
  const notDoneOnTime = planned != null && doneOnTime != null ? Math.max(0, planned - doneOnTime) : null;

  const nextWeekStart = addWeeks(r.week.weekStart, 1);
  const nextWeekEnd = addWeeks(r.week.weekEnd, 1);
  const trackPlanned = hasPlannedWork(r.systemKey);

  return {
    userId: uid,
    username: r.user?.username ?? "Unknown",
    department: r.user?.department?.name ?? null,
    email: r.user?.email ?? null,
    weekStart: toDateOnly(r.week.weekStart),
    weekEnd: toDateOnly(r.week.weekEnd),
    nextWeekStart: toDateOnly(nextWeekStart),
    nextWeekEnd: toDateOnly(nextWeekEnd),

    target,
    planned,
    actual,
    percent,
    notDone,
    notDonePct: planned != null && planned > 0 && percent != null ? 100 - percent : null,
    doneOnTime,
    notDoneOnTime,
    notDoneOnTimePct: planned != null && planned > 0 && notDoneOnTime != null ? pct(notDoneOnTime, planned) : null,
    weeklyWorkDoneOnTimePct: r.current.onTimePct,
    totalWork: r.current.totalWork,
    weekPending: r.current.weekPending,
    allPendingTillDate: r.current.allPendingTillDate,

    lastWeekPlanned: trackPlanned ? (r.last?.planned ?? 0) : null,
    lastWeekActual: r.last?.actual ?? 0,
    nextWeekPlanned: trackPlanned ? (r.next?.planned ?? 0) : null,
    // A week's actual only means something once that week is over.
    nextWeekActual: nextWeekEnd.getTime() < Date.now() ? (r.next?.actual ?? 0) : null,

    // Red columns: what was planned/committed FOR this week (entered last week).
    plannedNotDonePct: r.thisWeek?.plannedNotDonePct ?? null,
    plannedNotDoneOnTimePct: r.thisWeek?.plannedNotDoneOnTimePct ?? null,
    commitment: r.thisWeek?.commitment ?? null,
    // Green columns: what's being planned for NEXT week (editable this week).
    nextPlannedNotDonePct: r.nextWeek?.plannedNotDonePct ?? null,
    nextPlannedNotDoneOnTimePct: r.nextWeek?.plannedNotDoneOnTimePct ?? null,
    nextCommitment: r.nextWeek?.commitment ?? null,
    imageUrl: r.thisWeek?.imageUrl ?? null,
  };
}

export const misService = {
  async getDashboard(params: { systemKey: MisSystemKey; weekStart?: string; userId?: number }) {
    const week = params.weekStart ? getWeekBounds(new Date(params.weekStart)) : getCurrentWeekBounds();
    const lastWeek = getWeekBounds(addWeeks(week.weekStart, -1));
    const nextWeek = getWeekBounds(addWeeks(week.weekStart, 1));

    if (params.systemKey === "CHECKLIST_DELEGATION") {
      await materializeChecklistForToday(params.userId);
    }

    const calculator = misCalculators[params.systemKey];
    const [current, last, next, targets] = await Promise.all([
      calculator.computeBulk(week.weekStart, week.weekEnd, params.userId),
      calculator.computeBulk(lastWeek.weekStart, lastWeek.weekEnd, params.userId),
      calculator.computeBulk(nextWeek.weekStart, nextWeek.weekEnd, params.userId),
      prisma.misWeeklyTarget.findMany({
        where: {
          systemKey: params.systemKey,
          weekStart: { in: [week.weekStart, nextWeek.weekStart] },
          ...(params.userId != null ? { userId: params.userId } : {}),
        },
      }),
    ]);

    const thisWeekByUser = new Map(targets.filter((t) => t.weekStart.getTime() === week.weekStart.getTime()).map((t) => [t.userId, t]));
    const nextWeekByUser = new Map(targets.filter((t) => t.weekStart.getTime() === nextWeek.weekStart.getTime()).map((t) => [t.userId, t]));

    const userIds = new Set<number>([
      ...current.keys(),
      ...last.keys(),
      ...next.keys(),
      ...thisWeekByUser.keys(),
      ...nextWeekByUser.keys(),
    ]);
    if (params.userId != null) userIds.add(params.userId);
    if (userIds.size === 0) return [];

    const userById = await hydrateUsers(userIds);

    return [...userIds]
      .map((uid) =>
        toRow(uid, {
          systemKey: params.systemKey,
          user: userById.get(uid),
          week,
          thisWeek: thisWeekByUser.get(uid),
          nextWeek: nextWeekByUser.get(uid),
          current: current.get(uid) ?? emptyPartial(params.systemKey),
          last: last.get(uid),
          next: next.get(uid),
        })
      )
      .sort((a, b) => a.username.localeCompare(b.username));
  },

  async getHistory(params: {
    systemKey: MisSystemKey;
    userId?: number;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { weekStart: currentWeekStart } = getCurrentWeekBounds();
    // Offsets +1 (next week) … −HISTORY_WEEKS_BACK: every shown week (0 …
    // −(N−1)) also needs the week before it and the week after it.
    const offsets = Array.from({ length: HISTORY_WEEKS_BACK + 2 }, (_, i) => 1 - i);
    const weekAt = new Map(offsets.map((o) => [o, getWeekBounds(addWeeks(currentWeekStart, o))]));

    // Week index 0 is the current, still-in-progress week — History's most
    // recent row needs today's entries materialized exactly like
    // getDashboard() already does, or opening History first (before ever
    // opening Dashboard/the Checklist page) undercounts today's contribution
    // to that row. See docs/migration/DECISIONS.md.
    if (params.systemKey === "CHECKLIST_DELEGATION") {
      await materializeChecklistForToday(params.userId);
    }

    const calculator = misCalculators[params.systemKey];
    const shownOffsets = offsets.filter((o) => o <= 0 && o > -HISTORY_WEEKS_BACK);
    const [partials, targets] = await Promise.all([
      Promise.all(offsets.map((o) => calculator.computeBulk(weekAt.get(o)!.weekStart, weekAt.get(o)!.weekEnd, params.userId))),
      prisma.misWeeklyTarget.findMany({
        where: {
          systemKey: params.systemKey,
          // Includes one week past the newest so every week's row can show
          // its own next-week planning columns.
          weekStart: { in: [...shownOffsets, 1].map((o) => weekAt.get(o)!.weekStart) },
          ...(params.userId != null ? { userId: params.userId } : {}),
        },
      }),
    ]);
    const partialAt = new Map(offsets.map((o, i) => [o, partials[i]]));

    const targetKey = (uid: number, ws: Date) => `${uid}|${ws.toISOString()}`;
    const targetMap = new Map(targets.map((t) => [targetKey(t.userId, t.weekStart), t]));

    const allUserIds = new Set<number>();
    shownOffsets.forEach((o) => partialAt.get(o)!.forEach((_v, uid) => allUserIds.add(uid)));
    targets.forEach((t) => allUserIds.add(t.userId));

    const userById = await hydrateUsers(allUserIds);

    let rows = shownOffsets.flatMap((o) => {
      const week = weekAt.get(o)!;
      const current = partialAt.get(o)!;
      const nextWeekStart = weekAt.get(o + 1)!.weekStart;
      const rowUserIds = new Set<number>(current.keys());
      for (const uid of allUserIds) {
        if (targetMap.has(targetKey(uid, week.weekStart))) rowUserIds.add(uid);
      }

      return [...rowUserIds].map((uid) =>
        toRow(uid, {
          systemKey: params.systemKey,
          user: userById.get(uid),
          week,
          thisWeek: targetMap.get(targetKey(uid, week.weekStart)),
          nextWeek: targetMap.get(targetKey(uid, nextWeekStart)),
          current: current.get(uid) ?? emptyPartial(params.systemKey),
          last: partialAt.get(o - 1)!.get(uid),
          next: partialAt.get(o + 1)!.get(uid),
        })
      );
    });

    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter((r) => r.username.toLowerCase().includes(q));
    }

    // weekStart is "YYYY-MM-DD", so string order is date order.
    rows.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.username.localeCompare(b.username));

    const total = rows.length;
    const start = (params.page - 1) * params.limit;
    const data = rows.slice(start, start + params.limit);
    return { data, pagination: buildPaginationMeta(total, params.page, params.limit) };
  },

  async setTarget(input: { userId: number; systemKey: MisSystemKey; weekStart: string; target: number; setByUserId: number }) {
    const { weekStart, weekEnd } = getWeekBounds(new Date(input.weekStart));
    return prisma.misWeeklyTarget.upsert({
      where: { userId_systemKey_weekStart: { userId: input.userId, systemKey: input.systemKey, weekStart } },
      create: {
        userId: input.userId,
        systemKey: input.systemKey,
        weekStart,
        weekEnd,
        target: input.target,
        setByUserId: input.setByUserId,
      },
      update: { target: input.target, weekEnd, setByUserId: input.setByUserId },
    });
  },

  // Ports the old dashboard's "Submit Selection": bulk-save planning fields
  // (planned-%-not-done / commitment) for the selected people's NEXT week.
  // A field left out is kept as it is; null clears it — so saving just a
  // commitment no longer wipes the % fields someone else entered.
  async submitPlans(input: {
    items: {
      userId: number;
      systemKey: MisSystemKey;
      weekStart: string;
      plannedNotDonePct?: number | null;
      plannedNotDoneOnTimePct?: number | null;
      commitment?: string | null;
    }[];
    setByUserId: number;
  }) {
    const results = await prisma.$transaction(
      input.items.map((item) => {
        const { weekStart, weekEnd } = getWeekBounds(new Date(item.weekStart));
        const planFields = {
          ...(item.plannedNotDonePct !== undefined ? { plannedNotDonePct: item.plannedNotDonePct } : {}),
          ...(item.plannedNotDoneOnTimePct !== undefined ? { plannedNotDoneOnTimePct: item.plannedNotDoneOnTimePct } : {}),
          ...(item.commitment !== undefined ? { commitment: item.commitment?.trim() || null } : {}),
        };
        return prisma.misWeeklyTarget.upsert({
          where: { userId_systemKey_weekStart: { userId: item.userId, systemKey: item.systemKey, weekStart } },
          create: {
            userId: item.userId,
            systemKey: item.systemKey,
            weekStart,
            weekEnd,
            target: null,
            ...planFields,
            setByUserId: input.setByUserId,
          },
          update: { ...planFields, setByUserId: input.setByUserId },
        });
      })
    );
    return { count: results.length };
  },

  // The week's "Image Link" — an image attached to that person's MIS row for
  // the week (uploaded through /upload first; this stores its URL).
  async setImages(input: {
    items: { userId: number; systemKey: MisSystemKey; weekStart: string; imageUrl: string | null }[];
    setByUserId: number;
  }) {
    const results = await prisma.$transaction(
      input.items.map((item) => {
        const { weekStart, weekEnd } = getWeekBounds(new Date(item.weekStart));
        return prisma.misWeeklyTarget.upsert({
          where: { userId_systemKey_weekStart: { userId: item.userId, systemKey: item.systemKey, weekStart } },
          create: {
            userId: item.userId,
            systemKey: item.systemKey,
            weekStart,
            weekEnd,
            target: null,
            imageUrl: item.imageUrl,
            setByUserId: input.setByUserId,
          },
          update: { imageUrl: item.imageUrl, setByUserId: input.setByUserId },
        });
      })
    );
    return { count: results.length };
  },
};
