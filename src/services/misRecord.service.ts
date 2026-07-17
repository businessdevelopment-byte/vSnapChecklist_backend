import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  MisRecordQueryInput,
  CreateMisRecordInput,
  UpdateMisRecordInput,
} from "../schemas/misRecord.schemas";

// Source role model was admin/superadmin (all rows) / hod (self + reportees) /
// user (self only). This backend has only ADMIN/USER, so ADMIN keeps
// see-all and USER keeps self-only, scoped via the assignedUserId FK.
export const misRecordService = {
  async list(query: MisRecordQueryInput, requester: { userId: number; role: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const conditions: Prisma.MisRecordWhereInput[] = [];
    if (query.search) {
      conditions.push({ name: { contains: query.search, mode: "insensitive" } });
    }
    if (query.designation) {
      conditions.push({ designation: query.designation });
    }
    if (requester.role !== "ADMIN") {
      conditions.push({ assignedUserId: requester.userId });
    }
    const where: Prisma.MisRecordWhereInput = conditions.length ? { AND: conditions } : {};

    const [data, total] = await Promise.all([
      prisma.misRecord.findMany({
        where,
        skip,
        take,
        orderBy: [{ dateStart: "desc" }, { name: "asc" }],
      }),
      prisma.misRecord.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateMisRecordInput) {
    return prisma.misRecord.create({
      data: {
        ...input,
        dateStart: new Date(input.dateStart),
        dateEnd: new Date(input.dateEnd),
      } satisfies Prisma.MisRecordUncheckedCreateInput,
    });
  },

  async update(id: number, input: UpdateMisRecordInput) {
    const existing = await prisma.misRecord.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error("MIS record not found"), { status: 404 });
    }
    const { dateStart, dateEnd, ...rest } = input;
    return prisma.misRecord.update({
      where: { id },
      data: {
        ...rest,
        ...(dateStart ? { dateStart: new Date(dateStart) } : {}),
        ...(dateEnd ? { dateEnd: new Date(dateEnd) } : {}),
      },
    });
  },

  async remove(id: number) {
    const existing = await prisma.misRecord.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error("MIS record not found"), { status: 404 });
    }
    await prisma.misRecord.delete({ where: { id } });
    return { id };
  },
};
