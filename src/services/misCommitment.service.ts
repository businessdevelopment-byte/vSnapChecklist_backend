import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import { resolveOwnMisName } from "./misRecord.service";
import type {
  MisCommitmentQueryInput,
  SubmitMisCommitmentsInput,
} from "../schemas/misCommitment.schemas";

export const misCommitmentService = {
  async list(query: MisCommitmentQueryInput, requester: { userId: number; role: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const conditions: Prisma.MisArchivedCommitmentWhereInput[] = [];
    if (query.search) {
      conditions.push({ name: { contains: query.search, mode: "insensitive" } });
    }
    if (query.name) {
      conditions.push({ name: query.name });
    }
    if (query.dateStart) {
      conditions.push({ dateStart: new Date(query.dateStart) });
    }
    if (requester.role !== "ADMIN") {
      const ownName = await resolveOwnMisName(requester.userId);
      conditions.push({ name: { equals: ownName, mode: "insensitive" } });
    }
    const where: Prisma.MisArchivedCommitmentWhereInput = conditions.length
      ? { AND: conditions }
      : {};

    const [data, total] = await Promise.all([
      prisma.misArchivedCommitment.findMany({
        where,
        skip,
        take,
        orderBy: [{ dateStart: "desc" }, { name: "asc" }],
      }),
      prisma.misArchivedCommitment.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  // Ports Dashboard.jsx:1038-1093 (handleMainSubmit): one archived row per
  // person per week, insert-or-update keyed by name + week start (the source
  // built `archivedMap` from rows within the current week, Dashboard.jsx:282-320).
  // The snapshot widens the source's 6 archived columns to the full record so
  // the History page can show its complete 17-column layout —
  // workNotDone/workNotDoneOnTime derive as 100 - weekly done values exactly
  // like HistoryCommitment.jsx:23-24. The record's own nextWeek* fields are
  // updated too, mirroring how the source's "For Records" sheet columns Q-S
  // reflected the latest archived values. Non-admins may only submit rows
  // matching their own resolved name (source: hod/user submitted within the
  // rows visible to them).
  async submit(input: SubmitMisCommitmentsInput, requester: { userId: number; role: string }) {
    const ownName = requester.role !== "ADMIN" ? await resolveOwnMisName(requester.userId) : null;

    const records = await Promise.all(
      input.items.map(async (item) => {
        const record = await prisma.misRecord.findUnique({ where: { id: item.recordId } });
        if (!record) {
          throw Object.assign(new Error(`MIS record ${item.recordId} not found`), { status: 404 });
        }
        if (ownName !== null && record.name.toLowerCase() !== ownName.toLowerCase()) {
          throw Object.assign(
            new Error("You can only submit a commitment for your own record"),
            { status: 403 }
          );
        }
        return { record, item };
      })
    );

    await prisma.$transaction(async (tx) => {
      for (const { record, item } of records) {
        const snapshot = {
          name: record.name,
          dateStart: record.dateStart,
          dateEnd: record.dateEnd,
          target: record.target,
          actualWorkDone: record.actualWorkDone,
          workNotDone: 100 - record.weeklyWorkDone,
          workNotDoneOnTime: 100 - record.weeklyWorkDoneOnTime,
          totalWorkDone: record.totalWorkDone,
          weekPending: record.weekPending,
          allPendingTillDate: record.allPendingTillDate,
          lastWeekPlannedNotDone: record.plannedWorkNotDone,
          lastWeekPlannedNotDoneOnTime: record.plannedWorkNotDoneOnTime,
          lastWeekCommitment: record.commitment,
          nextWeekPlannedNotDone: item.nextWeekPlannedNotDone ?? null,
          nextWeekPlannedNotDoneOnTime: item.nextWeekPlannedNotDoneOnTime ?? null,
          nextWeekCommitment: item.nextWeekCommitment ?? null,
        };

        await tx.misArchivedCommitment.upsert({
          where: { name_dateStart: { name: record.name, dateStart: record.dateStart } },
          create: snapshot,
          update: snapshot,
        });

        await tx.misRecord.update({
          where: { id: record.id },
          data: {
            nextWeekPlannedNotDone: item.nextWeekPlannedNotDone ?? null,
            nextWeekPlannedNotDoneOnTime: item.nextWeekPlannedNotDoneOnTime ?? null,
            nextWeekCommitment: item.nextWeekCommitment ?? null,
          },
        });
      }
    });

    return { count: records.length };
  },
};
