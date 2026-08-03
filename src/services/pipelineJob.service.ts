import { Prisma, PipelineType, type OtpJob } from "@prisma/client";
import { prisma } from "../config/database";
import type { CreatePoliticalJobInput } from "../schemas/pipelineJob.schemas";

// PMS's own job-creation intake (formerly Sales Team) was removed per
// explicit direction — PMS jobs arrive instead via the hand-off below,
// triggered when an OtpJob completes the entire OTP pipeline (see
// otpStageService.advanceStage). Reuses the OTP job's own jobId so the same
// job is traceable by one id across both pipelines — OTP's vsnapu-style ids
// and PMS's own historical `PMS-JOB-XXXX` ids never collide.
export const pipelineJobService = {
  createFromOtpJob(otpJob: OtpJob) {
    return prisma.pipelineJob.create({
      data: {
        pipelineType: PipelineType.PMS,
        jobId: otpJob.jobId,
        projectId: otpJob.projectId,
        client: otpJob.client,
        jobGenre: otpJob.jobGenre,
        customIdName: otpJob.customIdName,
        customId: otpJob.customId,
        salesExecutive: otpJob.salesExecutive,
        jobDate: otpJob.jobDate,
        deliveryDate: otpJob.deliveryDate,
        jobTime: otpJob.jobTime,
        pocName: otpJob.pocName,
        pocContact: otpJob.pocContact,
        pocWhatsapp: otpJob.pocWhatsapp,
        pocEmail: otpJob.pocEmail,
        poc2ndEmail: otpJob.poc2ndEmail,
        jobCity: otpJob.jobCity,
        jobShootAddress: otpJob.jobShootAddress,
        jobSpecification: otpJob.jobSpecification,
        deliverables: otpJob.deliverables,
        currentStage: "REPORTING_CHECK",
      } satisfies Prisma.PipelineJobUncheckedCreateInput,
    });
  },

  // Job Cards is Political's own intake stage. Political has no "client" concept in the source (it tracks content
  // projects, not client jobs) — `client` is set to `projectName`'s value so
  // every pipelineType still has one consistent "what is this row" display
  // field, satisfying the column's NOT NULL constraint without inventing a
  // new business concept — see docs/migration/DECISIONS.md.
  async createPoliticalJob(input: CreatePoliticalJobInput, actorUserId: number) {
    const sequence = (await prisma.pipelineJob.count({ where: { pipelineType: PipelineType.POLITICAL } })) + 1;
    const jobId = `JCD-${String(sequence).padStart(5, "0")}`;

    const [job] = await prisma.$transaction([
      prisma.pipelineJob.create({
        data: {
          pipelineType: PipelineType.POLITICAL,
          jobId,
          client: input.projectName,
          currentStage: "JOB_CARD_PLANNING",
        } satisfies Prisma.PipelineJobUncheckedCreateInput,
      }),
    ]);

    await prisma.pipelineStageEvent.create({
      data: {
        pipelineJobId: job.id,
        stage: "PROJECT_ORDER",
        data: input as Prisma.InputJsonValue,
        actorUserId,
      },
    });

    return job;
  },
};
