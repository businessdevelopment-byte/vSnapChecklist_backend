import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  MisKpiKraQueryInput,
  CreateMisKpiKraInput,
  UpdateMisKpiKraInput,
} from "../schemas/misKpiKra.schemas";

export const misKpiKraService = {
  async list(query: MisKpiKraQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.MisKpiKraEntryWhereInput = {};
    if (query.search) {
      // Matches the source page's search fields: name, KPI, KRA (KpiKra.jsx:29-33)
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { kpi: { contains: query.search, mode: "insensitive" } },
        { kra: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.department) {
      where.department = query.department;
    }

    const [data, total] = await Promise.all([
      prisma.misKpiKraEntry.findMany({
        where,
        skip,
        take,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      prisma.misKpiKraEntry.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateMisKpiKraInput) {
    return prisma.misKpiKraEntry.create({
      data: input satisfies Prisma.MisKpiKraEntryUncheckedCreateInput,
    });
  },

  async update(id: number, input: UpdateMisKpiKraInput) {
    const existing = await prisma.misKpiKraEntry.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error("KPI/KRA entry not found"), { status: 404 });
    }
    return prisma.misKpiKraEntry.update({ where: { id }, data: input });
  },

  async remove(id: number) {
    const existing = await prisma.misKpiKraEntry.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error("KPI/KRA entry not found"), { status: 404 });
    }
    await prisma.misKpiKraEntry.delete({ where: { id } });
    return { id };
  },
};
