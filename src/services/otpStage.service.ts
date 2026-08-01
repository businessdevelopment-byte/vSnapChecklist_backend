import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import { otpStageSchemas, otpStageTransitions, type OtpStageName } from "../schemas/otpStage.schemas";
import type { StageListQueryInput } from "../schemas/otpStage.schemas";
import { pipelineJobService } from "./pipelineJob.service";

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
    if (query.client) where.client = query.client;
    if (query.jobId) where.jobId = { contains: query.jobId, mode: "insensitive" };
    if (query.projectId) where.projectId = { contains: query.projectId, mode: "insensitive" };
    if (query.poc) where.pocName = { contains: query.poc, mode: "insensitive" };

    const [data, total] = await Promise.all([
      prisma.otpJob.findMany({ where, skip, take, orderBy: { updatedAt: "desc" } }),
      prisma.otpJob.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async listHistory(stage: OtpStageName, query: StageListQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.OtpStageEventWhereInput = { stage };
    const otpJobWhere: Prisma.OtpJobWhereInput = {};
    if (query.search) {
      otpJobWhere.OR = [
        { jobId: { contains: query.search, mode: "insensitive" } },
        { client: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.client) otpJobWhere.client = query.client;
    if (query.jobId) otpJobWhere.jobId = { contains: query.jobId, mode: "insensitive" };
    if (query.projectId) otpJobWhere.projectId = { contains: query.projectId, mode: "insensitive" };
    if (query.poc) otpJobWhere.pocName = { contains: query.poc, mode: "insensitive" };
    if (Object.keys(otpJobWhere).length > 0) where.otpJob = otpJobWhere;

    // assignedMember only exists inside ASSIGN_MEMBER's own event data (see
    // listDistinctAssignedMembers below) — filtering by it on any other
    // stage's history would silently match nothing, so it's scoped here
    // rather than accepted everywhere.
    if (query.assignedMember && stage === "ASSIGN_MEMBER") {
      where.data = { path: ["assignedMember"], string_contains: query.assignedMember, mode: "insensitive" };
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

  // Distinct assignedMember values recorded across every ASSIGN_MEMBER stage
  // event — feeds that page's own "Assigned Member" filter dropdown. Can't
  // use Prisma's `distinct` (that only works on real columns, not JSON path
  // values), so this fetches the (bounded-by-total-jobs-ever-assigned) set of
  // event payloads and dedupes the field in JS instead.
  async listDistinctAssignedMembers(): Promise<string[]> {
    const events = await prisma.otpStageEvent.findMany({
      where: { stage: "ASSIGN_MEMBER" },
      select: { data: true },
    });
    const names = new Set<string>();
    for (const event of events) {
      const value = (event.data as Record<string, unknown>)?.assignedMember;
      if (typeof value === "string" && value.trim()) names.add(value.trim());
    }
    return Array.from(names).sort();
  },

  async advanceStage(jobId: number, rawData: Record<string, unknown>, actorUserId: number) {
    const job = await prisma.otpJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const currentStage = job.currentStage as OtpStageName;
    const schema = otpStageSchemas[currentStage];
    const parsed = schema.parse(rawData);

    const next = otpStageTransitions[currentStage](parsed);
    if (!next) {
      throw Object.assign(new Error("This order has already completed the final stage"), { status: 400 });
    }

    const stageEventCreate = prisma.otpStageEvent.create({
      data: { otpJobId: job.id, stage: currentStage, data: parsed as Prisma.InputJsonValue, actorUserId },
    });
    const jobUpdate = prisma.otpJob.update({ where: { id: job.id }, data: { currentStage: next } });

    // Hand off to PMS the moment an order finishes the entire OTP pipeline —
    // creates the PipelineJob that PMS's Reporting Check pending queue reads.
    const results =
      next === "COMPLETED"
        ? await prisma.$transaction([stageEventCreate, jobUpdate, pipelineJobService.createFromOtpJob(job)])
        : await prisma.$transaction([stageEventCreate, jobUpdate]);

    return results[1];
  },
};
