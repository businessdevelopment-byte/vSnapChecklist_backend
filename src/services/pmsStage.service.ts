import { Prisma, PipelineType } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import { pmsStageSchemas, pmsStageTransitions, type PmsStageName } from "../schemas/pmsStage.schemas";
import type { PmsStageListQueryInput } from "../schemas/pmsStage.schemas";

export const pmsStageService = {
  async listPending(stage: PmsStageName, query: PmsStageListQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.PipelineJobWhereInput = { pipelineType: PipelineType.PMS, currentStage: stage };
    if (query.search) {
      where.OR = [
        { jobId: { contains: query.search, mode: "insensitive" } },
        { client: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.assignedMember) {
      where.assignedMember = { contains: query.assignedMember, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      prisma.pipelineJob.findMany({ 
        where, 
        skip, 
        take, 
        orderBy: { updatedAt: "desc" },
        include: {
          stageEvents: {
            where: { stage },
            orderBy: { id: "desc" },
            take: 1,
          },
        },
      }),
      prisma.pipelineJob.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async listHistory(stage: PmsStageName, query: PmsStageListQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const pipelineJobWhere: Prisma.PipelineJobWhereInput = { pipelineType: PipelineType.PMS };
    if (query.search) {
      pipelineJobWhere.OR = [
        { jobId: { contains: query.search, mode: "insensitive" } },
        { client: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.assignedMember) {
      pipelineJobWhere.assignedMember = { contains: query.assignedMember, mode: "insensitive" };
    }

    const where: Prisma.PipelineStageEventWhereInput = { stage, pipelineJob: pipelineJobWhere };

    const [events, total] = await Promise.all([
      prisma.pipelineStageEvent.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { pipelineJob: true },
      }),
      prisma.pipelineStageEvent.count({ where }),
    ]);

    const data = events.map((e) => ({
      id: e.id,
      stage: e.stage,
      data: e.data,
      createdAt: e.createdAt,
      job: e.pipelineJob,
    }));

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  // Feeds the "Assigned Member" filter dropdown on every PMS stage page.
  // Scoped to PMS jobs so the list only offers members who actually appear
  // here, rather than every member OTP has ever assigned.
  async listDistinctAssignedMembers(): Promise<string[]> {
    const rows = await prisma.pipelineJob.findMany({
      where: { pipelineType: PipelineType.PMS, assignedMember: { not: null } },
      distinct: ["assignedMember"],
      select: { assignedMember: true },
      orderBy: { assignedMember: "asc" },
    });
    return rows.map((r) => r.assignedMember!).filter((name) => name.trim().length > 0);
  },

  async advanceStage(jobId: number, rawData: Record<string, unknown>, actorUserId: number) {
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } });
    if (!job || job.pipelineType !== PipelineType.PMS) {
      throw Object.assign(new Error("Job not found"), { status: 404 });
    }

    const currentStage = job.currentStage as PmsStageName;
    const schema = pmsStageSchemas[currentStage];
    if (!schema) {
      throw Object.assign(
        new Error(`Stage "${currentStage}" has not been migrated yet — this job cannot be advanced further right now`),
        { status: 501 }
      );
    }
    const parsed = schema.parse(rawData);

    const next = pmsStageTransitions[currentStage](parsed);
    if (!next) {
      throw Object.assign(new Error("This job has already completed the final stage"), { status: 400 });
    }

    const [, updatedJob] = await prisma.$transaction([
      prisma.pipelineStageEvent.create({
        data: { pipelineJobId: job.id, stage: currentStage, data: parsed as Prisma.InputJsonValue, actorUserId },
      }),
      prisma.pipelineJob.update({ where: { id: job.id }, data: { currentStage: next } }),
    ]);

    return updatedJob;
  },
};
