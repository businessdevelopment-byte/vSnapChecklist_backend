import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { FollowUpQueryInput, CreateFollowUpInput } from "../schemas/followUp.schemas";

export const followUpService = {
  // Matches CallTracker.jsx's own "Pending" tab exactly — every Enquiry is
  // always callable again, unconditionally (no filter, unlike Find Enquiry's
  // Open-Indents-only Pending tab).
  async listCallableEnquiries(query: FollowUpQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.EnquiryWhereInput = {};
    if (query.search) {
      where.OR = [
        { candidateName: { contains: query.search, mode: "insensitive" } },
        { candidateEnquiryNo: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.enquiry.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.enquiry.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async listHistory(query: FollowUpQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.FollowUpWhereInput = {};
    if (query.search) {
      where.OR = [
        { enquiryNo: { contains: query.search, mode: "insensitive" } },
        { status: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.followUp.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.followUp.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateFollowUpInput) {
    const enquiry = await prisma.enquiry.findUnique({ where: { id: input.enquiryId } });
    if (!enquiry) {
      throw Object.assign(new Error("Enquiry not found"), { status: 404 });
    }

    return prisma.followUp.create({
      data: {
        ...input,
        enquiryNo: enquiry.candidateEnquiryNo,
        nextDate: input.nextDate ? new Date(input.nextDate) : undefined,
      } satisfies Prisma.FollowUpUncheckedCreateInput,
    });
  },
};
