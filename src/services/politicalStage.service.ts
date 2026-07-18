import { Prisma, PipelineType } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import { politicalStageSchemas, politicalStageTransitions, type PoliticalStageName } from "../schemas/politicalStage.schemas";
import type { PoliticalStageListQueryInput } from "../schemas/politicalStage.schemas";

export const politicalStageService = {
  async listPending(stage: PoliticalStageName, query: PoliticalStageListQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.PipelineJobWhereInput = { pipelineType: PipelineType.POLITICAL, currentStage: stage };
    if (query.search) {
      where.OR = [
        { jobId: { contains: query.search, mode: "insensitive" } },
        { client: { contains: query.search, mode: "insensitive" } },
      ];
    }

    // Filter by track: INFLUENCER_* stages and INHOUSE_* stages are completely separate
    // Shared stages (PROJECT_ORDER, JOB_CARD_PLANNING, DELIVERY_POSTING, DOCUMENT_OF_POST) serve both tracks
    const isInfluencerStage = stage.includes("INFLUENCER");
    const isInhouseStage = stage.includes("INHOUSE");
    const isSharedStage = !isInfluencerStage && !isInhouseStage;

    let data, total;

    if (isSharedStage) {
      // Shared stages show all jobs (no filtering)
      [data, total] = await Promise.all([
        prisma.pipelineJob.findMany({ where, skip, take, orderBy: { updatedAt: "desc" } }),
        prisma.pipelineJob.count({ where }),
      ]);
    } else {
      // Track-specific stages: filter by contentType from JOB_CARD_PLANNING event
      const jobs = await prisma.pipelineJob.findMany({ where, orderBy: { updatedAt: "desc" } });

      const filteredJobs = await Promise.all(
        jobs.map(async (job) => {
          const jobCardEvent = await prisma.pipelineStageEvent.findFirst({
            where: { pipelineJobId: job.id, stage: "JOB_CARD_PLANNING" },
          });
          const contentType = (jobCardEvent?.data as any)?.contentType;

          if (isInfluencerStage && contentType === "Influencer") return job;
          if (isInhouseStage && contentType === "Inhouse/Non-Face") return job;
          return null;
        })
      );

      data = filteredJobs.filter(Boolean).slice(skip, skip + take);
      total = filteredJobs.filter(Boolean).length;
    }

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async listHistory(stage: PoliticalStageName, query: PoliticalStageListQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.PipelineStageEventWhereInput = {
      stage,
      pipelineJob: { pipelineType: PipelineType.POLITICAL },
    };
    if (query.search) {
      where.pipelineJob = {
        pipelineType: PipelineType.POLITICAL,
        OR: [
          { jobId: { contains: query.search, mode: "insensitive" } },
          { client: { contains: query.search, mode: "insensitive" } },
        ],
      };
    }

    // Filter by track: INFLUENCER_* stages and INHOUSE_* stages are completely separate
    const isInfluencerStage = stage.includes("INFLUENCER");
    const isInhouseStage = stage.includes("INHOUSE");
    const isSharedStage = !isInfluencerStage && !isInhouseStage;

    let events, total;

    if (isSharedStage) {
      // Shared stages show all events (no filtering)
      [events, total] = await Promise.all([
        prisma.pipelineStageEvent.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: { pipelineJob: true },
        }),
        prisma.pipelineStageEvent.count({ where }),
      ]);
    } else {
      // Track-specific stages: filter by contentType from JOB_CARD_PLANNING event
      const allEvents = await prisma.pipelineStageEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { pipelineJob: true },
      });

      const filteredEvents = await Promise.all(
        allEvents.map(async (event) => {
          const jobCardEvent = await prisma.pipelineStageEvent.findFirst({
            where: { pipelineJobId: event.pipelineJobId, stage: "JOB_CARD_PLANNING" },
          });
          const contentType = (jobCardEvent?.data as any)?.contentType;

          if (isInfluencerStage && contentType === "Influencer") return event;
          if (isInhouseStage && contentType === "Inhouse/Non-Face") return event;
          return null;
        })
      );

      events = filteredEvents.filter((e): e is NonNullable<typeof e> => e !== null).slice(skip, skip + take);
      total = filteredEvents.filter((e): e is NonNullable<typeof e> => e !== null).length;
    }

    const data = (events as any[]).map((e) => ({
      id: e.id,
      stage: e.stage,
      data: e.data,
      createdAt: e.createdAt,
      job: e.pipelineJob,
    }));

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async advanceStage(jobId: number, rawData: Record<string, unknown>, actorUserId: number) {
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } });
    if (!job || job.pipelineType !== PipelineType.POLITICAL) {
      throw Object.assign(new Error("Job not found"), { status: 404 });
    }

    const currentStage = job.currentStage as PoliticalStageName;
    const schema = politicalStageSchemas[currentStage];
    if (!schema) {
      throw Object.assign(
        new Error(`Stage "${currentStage}" has not been migrated yet — this job cannot be advanced further right now`),
        { status: 501 }
      );
    }
    const parsed = schema.parse(rawData);

    const next = politicalStageTransitions[currentStage](parsed);
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
