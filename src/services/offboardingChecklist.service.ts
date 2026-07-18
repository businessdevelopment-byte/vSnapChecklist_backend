import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  OffboardingChecklistQueryInput,
  CreateOffboardingChecklistInput,
} from "../schemas/offboardingChecklist.schemas";

export const offboardingChecklistService = {
  // Matches AfterLeavingWork.jsx's own (unconditional) Pending list of
  // LEAVING_EMPLOYEES, but excludes leaving records that already have a
  // persisted checklist — the source itself has no History view and no
  // persisted completion at all, so a "processed" employee would simply
  // vanish with no record of it ever having happened.
  async listPending(query: OffboardingChecklistQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.LeavingRecordWhereInput = { offboardingChecklist: { is: null } };
    if (query.search) {
      where.employee = {
        OR: [
          { candidateName: { contains: query.search, mode: "insensitive" } },
          { joiningNo: { contains: query.search, mode: "insensitive" } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      prisma.leavingRecord.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { employee: true },
      }),
      prisma.leavingRecord.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async listHistory(query: OffboardingChecklistQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.OffboardingChecklistWhereInput = {};
    if (query.search) {
      where.leavingRecord = {
        employee: {
          OR: [
            { candidateName: { contains: query.search, mode: "insensitive" } },
            { joiningNo: { contains: query.search, mode: "insensitive" } },
          ],
        },
      };
    }

    const [data, total] = await Promise.all([
      prisma.offboardingChecklist.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { leavingRecord: { include: { employee: true } } },
      }),
      prisma.offboardingChecklist.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateOffboardingChecklistInput) {
    const leavingRecord = await prisma.leavingRecord.findUnique({
      where: { id: input.leavingRecordId },
      include: { offboardingChecklist: true },
    });
    if (!leavingRecord) {
      throw Object.assign(new Error("Leaving record not found"), { status: 404 });
    }
    if (leavingRecord.offboardingChecklist) {
      throw Object.assign(new Error("Offboarding checklist already submitted for this employee"), { status: 400 });
    }

    return prisma.offboardingChecklist.create({
      data: {
        ...input,
        finalReleaseDate: input.finalReleaseDate ? new Date(input.finalReleaseDate) : undefined,
      } satisfies Prisma.OffboardingChecklistUncheckedCreateInput,
      include: { leavingRecord: { include: { employee: true } } },
    });
  },
};
