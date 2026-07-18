import type { MisSystemKey, MisWeeklyTarget } from "@prisma/client";
import { prisma } from "../../config/database";
import { buildPaginationMeta } from "../../utils/pagination";
import { getCurrentWeekBounds, getWeekBounds } from "../../utils/misWeek";
import { misCalculators, type MisRowPartial } from "./misCalculators";
import { checklistService } from "../checklist.service";

const HISTORY_WEEKS_BACK = 8;
const EMPTY_PARTIAL: MisRowPartial = {
  actual: 0,
  onTimePct: null,
  totalWork: null,
  weekPending: null,
  allPendingTillDate: null,
};

async function hydrateUsers(userIds: Iterable<number>) {
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, username: true, department: { select: { name: true } } },
  });
  return new Map(users.map((u) => [u.id, u]));
}

// Checklist entries are lazily materialized (see checklist.service.ts's
// "Task Generation" note) — a newly assigned template has no countable
// entry rows until someone loads the checklist. Materialize today's
// entries before computing, exactly like GET /api/checklist's admin path
// does, so a fresh assignment shows up on the MIS dashboard immediately.
async function materializeChecklistForToday(userId?: number) {
  const today = new Date();
  if (userId != null) {
    await checklistService.materializeTasks(userId, today);
    return;
  }
  const activeUsers = await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  await Promise.all(activeUsers.map((u) => checklistService.materializeTasks(u.id, today)));
}

function toRow(
  uid: number,
  user: { username: string; department: { name: string | null } | null } | undefined,
  thisWeek: MisWeeklyTarget | undefined,
  nextWeek: MisWeeklyTarget | undefined,
  partial: MisRowPartial
) {
  const target = thisWeek?.target ?? null;
  return {
    userId: uid,
    username: user?.username ?? "Unknown",
    department: user?.department?.name ?? null,
    target,
    actual: partial.actual,
    percent: target != null && target > 0 ? Math.round((partial.actual / target) * 100) : null,
    weeklyWorkDoneOnTimePct: partial.onTimePct,
    totalWork: partial.totalWork,
    weekPending: partial.weekPending,
    allPendingTillDate: partial.allPendingTillDate,
    // Red columns: what was planned/committed FOR this week (entered last week).
    plannedNotDonePct: thisWeek?.plannedNotDonePct ?? null,
    plannedNotDoneOnTimePct: thisWeek?.plannedNotDoneOnTimePct ?? null,
    commitment: thisWeek?.commitment ?? null,
    // Green columns: what's being planned for NEXT week (editable this week).
    nextPlannedNotDonePct: nextWeek?.plannedNotDonePct ?? null,
    nextPlannedNotDoneOnTimePct: nextWeek?.plannedNotDoneOnTimePct ?? null,
    nextCommitment: nextWeek?.commitment ?? null,
  };
}

function addWeeks(weekStart: Date, weeks: number): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 7 * weeks);
  return d;
}

export const misService = {
  async getDashboard(params: { systemKey: MisSystemKey; weekStart?: string; userId?: number }) {
    const { weekStart, weekEnd } = params.weekStart
      ? getWeekBounds(new Date(params.weekStart))
      : getCurrentWeekBounds();
    const nextWeekStart = addWeeks(weekStart, 1);

    if (params.systemKey === "CHECKLIST_DELEGATION") {
      await materializeChecklistForToday(params.userId);
    }

    const calculator = misCalculators[params.systemKey];
    const [actuals, targets] = await Promise.all([
      calculator.computeBulk(weekStart, weekEnd, params.userId),
      prisma.misWeeklyTarget.findMany({
        where: {
          systemKey: params.systemKey,
          weekStart: { in: [weekStart, nextWeekStart] },
          ...(params.userId != null ? { userId: params.userId } : {}),
        },
      }),
    ]);

    const thisWeekByUser = new Map(targets.filter((t) => t.weekStart.getTime() === weekStart.getTime()).map((t) => [t.userId, t]));
    const nextWeekByUser = new Map(targets.filter((t) => t.weekStart.getTime() === nextWeekStart.getTime()).map((t) => [t.userId, t]));

    const userIds = new Set<number>([...actuals.keys(), ...thisWeekByUser.keys(), ...nextWeekByUser.keys()]);
    if (params.userId != null) userIds.add(params.userId);
    if (userIds.size === 0) return [];

    const userById = await hydrateUsers(userIds);

    return [...userIds]
      .map((uid) =>
        toRow(uid, userById.get(uid), thisWeekByUser.get(uid), nextWeekByUser.get(uid), actuals.get(uid) ?? EMPTY_PARTIAL)
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
    const weeks = Array.from({ length: HISTORY_WEEKS_BACK }, (_, i) =>
      getWeekBounds(addWeeks(currentWeekStart, -i))
    );

    const calculator = misCalculators[params.systemKey];
    const [perWeekActuals, targets] = await Promise.all([
      Promise.all(weeks.map((w) => calculator.computeBulk(w.weekStart, w.weekEnd, params.userId))),
      prisma.misWeeklyTarget.findMany({
        where: {
          systemKey: params.systemKey,
          // Includes one week past the newest so every week's row can show
          // its own next-week planning columns.
          weekStart: { in: [...weeks.map((w) => w.weekStart), addWeeks(currentWeekStart, 1)] },
          ...(params.userId != null ? { userId: params.userId } : {}),
        },
      }),
    ]);

    const targetKey = (uid: number, ws: Date) => `${uid}|${ws.toISOString()}`;
    const targetMap = new Map(targets.map((t) => [targetKey(t.userId, t.weekStart), t]));

    const allUserIds = new Set<number>();
    perWeekActuals.forEach((m) => m.forEach((_v, uid) => allUserIds.add(uid)));
    targets.forEach((t) => allUserIds.add(t.userId));

    const userById = await hydrateUsers(allUserIds);

    let rows = weeks.flatMap((w, i) => {
      const actualsForWeek = perWeekActuals[i];
      const nextWeekStart = addWeeks(w.weekStart, 1);
      const rowUserIds = new Set<number>(actualsForWeek.keys());
      for (const uid of allUserIds) {
        if (targetMap.has(targetKey(uid, w.weekStart))) rowUserIds.add(uid);
      }

      return [...rowUserIds].map((uid) => ({
        ...toRow(
          uid,
          userById.get(uid),
          targetMap.get(targetKey(uid, w.weekStart)),
          targetMap.get(targetKey(uid, nextWeekStart)),
          actualsForWeek.get(uid) ?? EMPTY_PARTIAL
        ),
        weekStart: w.weekStart,
        weekEnd: w.weekEnd,
      }));
    });

    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter((r) => r.username.toLowerCase().includes(q));
    }

    rows.sort((a, b) => {
      if (a.weekStart.getTime() !== b.weekStart.getTime()) return b.weekStart.getTime() - a.weekStart.getTime();
      return a.username.localeCompare(b.username);
    });

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
  async submitPlans(input: {
    items: {
      userId: number;
      systemKey: MisSystemKey;
      weekStart: string;
      plannedNotDonePct?: number;
      plannedNotDoneOnTimePct?: number;
      commitment?: string;
    }[];
    setByUserId: number;
  }) {
    const results = await prisma.$transaction(
      input.items.map((item) => {
        const { weekStart, weekEnd } = getWeekBounds(new Date(item.weekStart));
        const planFields = {
          plannedNotDonePct: item.plannedNotDonePct ?? null,
          plannedNotDoneOnTimePct: item.plannedNotDoneOnTimePct ?? null,
          commitment: item.commitment ?? null,
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
};
