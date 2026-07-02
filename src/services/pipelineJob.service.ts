import { Prisma, PipelineType } from "@prisma/client";
import { prisma } from "../config/database";
import type { CreatePmsJobInput } from "../schemas/pipelineJob.schemas";

// Sales Team is PMS's own intake stage (it has a real form, unlike OTP's
// read-only Order Received) — creating a job places it directly into
// SALES_TEAM's pending queue, matching Master's source where the dummy
// SalesTeam data IS the pending queue itself, with no separate log stage.
export const pipelineJobService = {
  async createPmsJob(input: CreatePmsJobInput) {
    const sequence = (await prisma.pipelineJob.count({ where: { pipelineType: PipelineType.PMS } })) + 1;
    const jobId = `PMS-JOB-${String(sequence).padStart(4, "0")}`;

    return prisma.pipelineJob.create({
      data: {
        ...input,
        pipelineType: PipelineType.PMS,
        jobId,
        jobDate: input.jobDate ? new Date(input.jobDate) : undefined,
        deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
        currentStage: "SALES_TEAM",
      } satisfies Prisma.PipelineJobUncheckedCreateInput,
    });
  },
};
