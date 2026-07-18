import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { EnquiryQueryInput, CreateEnquiryInput } from "../schemas/enquiry.schemas";

export const enquiryService = {
  // Matches FindEnquiry.jsx's own "Pending" tab exactly — it lists Open
  // Indents (the actionable "add an enquiry against this" opportunities),
  // not draft Enquiry rows.
  async listOpenIndents(query: EnquiryQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.IndentWhereInput = { status: "Open" };
    if (query.search) {
      where.OR = [
        { post: { contains: query.search, mode: "insensitive" } },
        { indentNumber: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.indent.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.indent.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async listHistory(query: EnquiryQueryInput) {
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

  async create(input: CreateEnquiryInput, createdByUserId: number) {
    const indent = await prisma.indent.findUnique({ where: { id: input.indentId } });
    if (!indent) {
      throw Object.assign(new Error("Indent not found"), { status: 404 });
    }
    if (indent.status !== "Open") {
      throw Object.assign(new Error("Cannot add an enquiry against a closed indent"), { status: 400 });
    }

    const sequence = (await prisma.enquiry.count()) + 1;
    const candidateEnquiryNo = `ENQ${String(sequence).padStart(3, "0")}`;

    return prisma.enquiry.create({
      data: {
        ...input,
        candidateEnquiryNo,
        indentNo: indent.indentNumber,
        applyingForPost: indent.post,
        candidateDOB: input.candidateDOB ? new Date(input.candidateDOB) : undefined,
        createdByUserId,
      } satisfies Prisma.EnquiryUncheckedCreateInput,
    });
  },
};
