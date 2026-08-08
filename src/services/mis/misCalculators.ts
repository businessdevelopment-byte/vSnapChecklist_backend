import { Prisma, PipelineType, type MisSystemKey } from "@prisma/client";
import { prisma } from "../../config/database";
import { checklistService } from "../checklist.service";
import { delegationService } from "../delegation.service";

export interface MisRowPartial {
  actual: number;
  onTimePct: number | null;
  // Cumulative completed work up to the week being viewed — only computable
  // for Checklist & Delegation today (null elsewhere).
  totalWork: number | null;
  weekPending: number | null;
  allPendingTillDate: number | null;
}

export interface MisCalculator {
  // userId omitted = every user with activity in the range (Dashboard "all people" / admin History).
  // userId given = just that user's numbers (non-admin "my own" view).
  computeBulk(weekStart: Date, weekEnd: Date, userId?: number): Promise<Map<number, MisRowPartial>>;
}

const EPOCH = new Date("2020-01-01T00:00:00.000Z");
const emptyRow = (): MisRowPartial => ({
  actual: 0,
  onTimePct: null,
  totalWork: null,
  weekPending: null,
  allPendingTillDate: null,
});

// Checklist & Delegation is the only system with a real due-date-vs-completion
// concept and a real "assigned but not done" concept — on-time %, week
// pending, and all-pending-till-date are only meaningful here. Built on top
// of checklist.service.ts/delegation.service.ts's existing staff-stats
// methods rather than re-deriving their "active users only" / "isDeleted"
// business filters.
const checklistDelegationCalculator: MisCalculator = {
  async computeBulk(weekStart, weekEnd, userId) {
    const weekStartISO = weekStart.toISOString().slice(0, 10);
    const weekEndISO = weekEnd.toISOString().slice(0, 10);

    // Push userId down into every query instead of computing org-wide stats
    // and discarding all but one row — a non-admin's own dashboard shouldn't
    // pay the cost of scanning every other user's data.
    const [checklistWeek, delegationWeek, checklistCumulative, delegationCumulative] =
      await Promise.all([
        checklistService.getStaffStats({ startDate: weekStart, endDate: weekEnd, userId }),
        delegationService.getMisStaffStats({ startDate: weekStartISO, endDate: weekEndISO, userId }),
        // Both start+end passed (epoch..weekEnd) so checklist's stricter
        // branching (it only honors a custom range when BOTH are set,
        // otherwise defaults to "today") applies our exact cutoff instead.
        checklistService.getStaffStats({ startDate: EPOCH, endDate: weekEnd, userId }),
        delegationService.getMisStaffStats({ endDate: weekEndISO, userId }),
      ]);

    const cumulativePendingByUser = new Map<number, number>();
    const cumulativeCompletedByUser = new Map<number, number>();
    for (const s of checklistCumulative) {
      cumulativePendingByUser.set(s.userId, (cumulativePendingByUser.get(s.userId) ?? 0) + s.pending);
      cumulativeCompletedByUser.set(s.userId, (cumulativeCompletedByUser.get(s.userId) ?? 0) + s.completed);
    }
    for (const s of delegationCumulative) {
      cumulativePendingByUser.set(s.userId, (cumulativePendingByUser.get(s.userId) ?? 0) + s.pending);
      cumulativeCompletedByUser.set(s.userId, (cumulativeCompletedByUser.get(s.userId) ?? 0) + s.done);
    }

    type Acc = { actual: number; completed: number; onTime: number; weekPending: number };
    const accByUser = new Map<number, Acc>();
    const ensure = (uid: number): Acc => {
      if (!accByUser.has(uid)) accByUser.set(uid, { actual: 0, completed: 0, onTime: 0, weekPending: 0 });
      return accByUser.get(uid)!;
    };

    for (const s of checklistWeek) {
      const acc = ensure(s.userId);
      acc.actual += s.completed;
      acc.completed += s.completed;
      acc.onTime += s.onTime;
      acc.weekPending += s.pending;
    }
    for (const s of delegationWeek) {
      const acc = ensure(s.userId);
      acc.actual += s.done;
      acc.completed += s.done;
      acc.onTime += s.onTime;
      acc.weekPending += s.pending;
    }

    const result = new Map<number, MisRowPartial>();
    for (const [uid, acc] of accByUser) {
      result.set(uid, {
        actual: acc.actual,
        onTimePct: acc.completed > 0 ? Math.round((acc.onTime / acc.completed) * 100) : null,
        totalWork: cumulativeCompletedByUser.get(uid) ?? 0,
        weekPending: acc.weekPending,
        allPendingTillDate: cumulativePendingByUser.get(uid) ?? 0,
      });
    }

    if (userId != null) {
      const row = result.get(userId);
      return row ? new Map([[userId, row]]) : new Map();
    }
    return result;
  },
};

// Shared by otpCalculator/makePipelineCalculator/hrCalculator: turn a list of
// { <actorField>: number|null, _count } groupBy rows into a userId -> MisRowPartial
// map, dropping any row whose actor is null (unattributed — see the actorUserId
// nullability note on OtpStageEvent/PipelineStageEvent in schema.prisma).
function actorRowsToMap(rows: { actorUserId: number | null; _count: number }[]): Map<number, MisRowPartial> {
  const result = new Map<number, MisRowPartial>();
  for (const r of rows) {
    if (r.actorUserId == null) continue;
    result.set(r.actorUserId, { ...emptyRow(), actual: r._count });
  }
  return result;
}

const otpCalculator: MisCalculator = {
  async computeBulk(weekStart, weekEnd, userId) {
    const where: Prisma.OtpStageEventWhereInput = { createdAt: { gte: weekStart, lte: weekEnd } };
    where.actorUserId = userId != null ? userId : { not: null };

    const rows = await prisma.otpStageEvent.groupBy({ by: ["actorUserId"], where, _count: true });
    return actorRowsToMap(rows);
  },
};

function makePipelineCalculator(pipelineType: PipelineType): MisCalculator {
  return {
    async computeBulk(weekStart, weekEnd, userId) {
      const where: Prisma.PipelineStageEventWhereInput = {
        createdAt: { gte: weekStart, lte: weekEnd },
        pipelineJob: { pipelineType },
      };
      where.actorUserId = userId != null ? userId : { not: null };

      const rows = await prisma.pipelineStageEvent.groupBy({ by: ["actorUserId"], where, _count: true });
      return actorRowsToMap(rows);
    },
  };
}

const hrCalculator: MisCalculator = {
  async computeBulk(weekStart, weekEnd, userId) {
    const range = { gte: weekStart, lte: weekEnd };
    const actorFilter = userId != null ? userId : { not: null };

    const [indents, enquiries, followUps, jobApps] = await Promise.all([
      prisma.indent.groupBy({ by: ["createdByUserId"], where: { createdAt: range, createdByUserId: actorFilter }, _count: true }),
      prisma.enquiry.groupBy({ by: ["createdByUserId"], where: { createdAt: range, createdByUserId: actorFilter }, _count: true }),
      prisma.followUp.groupBy({ by: ["createdByUserId"], where: { createdAt: range, createdByUserId: actorFilter }, _count: true }),
      prisma.jobApplication.groupBy({ by: ["createdByUserId"], where: { createdAt: range, createdByUserId: actorFilter }, _count: true }),
    ]);

    const result = new Map<number, MisRowPartial>();
    const add = (rows: { createdByUserId: number | null; _count: number }[]) => {
      for (const r of rows) {
        if (r.createdByUserId == null) continue;
        const existing = result.get(r.createdByUserId) ?? emptyRow();
        result.set(r.createdByUserId, { ...existing, actual: existing.actual + r._count });
      }
    };
    add(indents);
    add(enquiries);
    add(followUps);
    add(jobApps);
    return result;
  },
};

export const misCalculators: Record<MisSystemKey, MisCalculator> = {
  CHECKLIST_DELEGATION: checklistDelegationCalculator,
  ORDER_TO_PAYMENT: otpCalculator,
  PMS: makePipelineCalculator(PipelineType.PMS),
  POLITICAL: makePipelineCalculator(PipelineType.POLITICAL),
  HR: hrCalculator,
};
