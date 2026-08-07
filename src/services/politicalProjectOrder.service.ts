import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { CreatePoliticalProjectOrderInput, PoliticalProjectOrderListQueryInput } from "../schemas/politicalProjectOrder.schemas";

export const politicalProjectOrderService = {
  async create(input: CreatePoliticalProjectOrderInput, actorUserId: number) {
    const sequence = (await prisma.politicalProjectOrder.count()) + 1;
    const projectOrderId = `PRJ-${String(sequence).padStart(5, "0")}`;

    return prisma.politicalProjectOrder.create({
      data: {
        ...input,
        projectOrderId,
        createdByUserId: actorUserId,
      },
    });
  },

  async list(query: PoliticalProjectOrderListQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where = query.search
      ? {
          OR: [
            { projectOrderId: { contains: query.search, mode: "insensitive" as const } },
            { projectName: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.politicalProjectOrder.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.politicalProjectOrder.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: number) {
    return prisma.politicalProjectOrder.findUnique({
      where: { id },
      include: { jobCards: { orderBy: { createdAt: "desc" } } },
    });
  },
};
