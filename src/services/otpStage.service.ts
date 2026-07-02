import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import { otpStageSchemas, nextOtpStage, type OtpStageName } from "../schemas/otpStage.schemas";
import type { StageListQueryInput } from "../schemas/otpStage.schemas";

export const otpStageService = {
  async listPending(stage: OtpStageName, query: StageListQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.OtpJobWhereInput = { currentStage: stage };
    if (query.search) {
      where.OR = [
        { jobId: { contains: query.search, mode: "insensitive" } },
        { projectId: { contains: query.search, mode: "insensitive" } },
        { client: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.otpJob.findMany({ where, skip, take, orderBy: { updatedAt: "desc" } }),
      prisma.otpJob.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async listHistory(stage: OtpStageName, query: StageListQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.OtpStageEventWhereInput = { stage };
    if (query.search) {
      where.otpJob = {
        OR: [
          { jobId: { contains: query.search, mode: "insensitive" } },
          { client: { contains: query.search, mode: "insensitive" } },
        ],
      };
    }

    const [events, total] = await Promise.all([
      prisma.otpStageEvent.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { otpJob: true },
      }),
      prisma.otpStageEvent.count({ where }),
    ]);

    const data = events.map((e) => ({
      id: e.id,
      stage: e.stage,
      data: e.data,
      createdAt: e.createdAt,
      job: e.otpJob,
    }));

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async advanceStage(jobId: number, rawData: Record<string, unknown>) {
    const job = await prisma.otpJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const currentStage = job.currentStage as OtpStageName;
    const schema = otpStageSchemas[currentStage];
    const parsed = schema.parse(rawData);

    const next = nextOtpStage(currentStage);
    if (!next) {
      throw Object.assign(new Error("This order has already completed the final stage"), { status: 400 });
    }

    const [, updatedJob] = await prisma.$transaction([
      prisma.otpStageEvent.create({
        data: { otpJobId: job.id, stage: currentStage, data: parsed as Prisma.InputJsonValue },
      }),
      prisma.otpJob.update({ where: { id: job.id }, data: { currentStage: next } }),
    ]);

    return updatedJob;
  },
};
