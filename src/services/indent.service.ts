import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { IndentQueryInput, CreateIndentInput } from "../schemas/indent.schemas";

export const indentService = {
  async list(query: IndentQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.IndentWhereInput = {};
    if (query.search) {
      where.OR = [
        { indentNumber: { contains: query.search, mode: "insensitive" } },
        { post: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.indent.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.indent.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateIndentInput, createdByUserId: number) {
    const sequence = (await prisma.indent.count()) + 1;
    const indentNumber = `IND${String(sequence).padStart(3, "0")}`;

    return prisma.indent.create({
      data: {
        ...input,
        indentNumber,
        completionDate: new Date(input.completionDate),
        status: "Open",
        createdByUserId,
      } satisfies Prisma.IndentUncheckedCreateInput,
    });
  },
};
