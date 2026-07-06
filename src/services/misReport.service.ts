import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { MisReportQueryInput, CreateMisReportEntryInput } from "../schemas/misReport.schemas";

export const misReportService = {
  // Matches MisReport.jsx's own filter exactly: name/department substring
  // search, case-insensitive (MisReport.jsx:14-17).
  async list(query: MisReportQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.MisReportEntryWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { department: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.misReportEntry.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.misReportEntry.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateMisReportEntryInput) {
    return prisma.misReportEntry.create({
      data: {
        ...input,
        dateStart: new Date(input.dateStart),
        dateEnd: new Date(input.dateEnd),
      } satisfies Prisma.MisReportEntryUncheckedCreateInput,
    });
  },
};
