import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { OtpJobQueryInput, CreateOtpJobInput } from "../schemas/otpJob.schemas";

const GST_RATE = 0.18;

export const otpJobService = {
  async list(query: OtpJobQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.OtpJobWhereInput = {};

    if (query.jobGenre) where.jobGenre = query.jobGenre;
    if (query.salesExecutive) where.salesExecutive = query.salesExecutive;
    if (query.jobCity) where.jobCity = query.jobCity;

    if (query.startDate || query.endDate) {
      where.jobDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    if (query.search) {
      where.OR = [
        { jobId: { contains: query.search, mode: "insensitive" } },
        { projectId: { contains: query.search, mode: "insensitive" } },
        { client: { contains: query.search, mode: "insensitive" } },
        { pocName: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.otpJob.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.otpJob.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateOtpJobInput) {
    const taxableAmount = input.taxableAmount;
    const gst = Math.round(taxableAmount * GST_RATE * 100) / 100;
    const packageAmountWithTax = Math.round(taxableAmount * (1 + GST_RATE) * 100) / 100;

    const sequence = (await prisma.otpJob.count()) + 1;
    const jobId = `ORD${String(sequence).padStart(5, "0")}`;
    const projectId = `PRJ${String(sequence).padStart(5, "0")}`;

    return prisma.otpJob.create({
      data: {
        ...input,
        jobId,
        projectId,
        jobDate: new Date(input.jobDate),
        deliveryDate: new Date(input.deliveryDate),
        gst,
        packageAmountWithTax,
        // Order Received has no form/dialog in the source (a flat log, not a
        // pending queue — see otpJob.service.ts's `list()`, unfiltered by
        // stage). The first *actionable* stage is Assign Member, so new jobs
        // start their pipeline there, not at the ORDER_RECEIVED enum default.
        currentStage: "ASSIGN_MEMBER",
      },
    });
  },
};
