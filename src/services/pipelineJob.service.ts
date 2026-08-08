import { Prisma, PipelineType, type OtpJob } from "@prisma/client";
import { prisma } from "../config/database";
import type { CreateJobCardsBatchInput } from "../schemas/pipelineJob.schemas";

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
        assignedMember: otpJob.assignedMember,
        currentStage: "REPORTING_CHECK",
      } satisfies Prisma.PipelineJobUncheckedCreateInput,
    });
  },

  // Job Cards is Political's own intake stage, entered via "News Picking":
  // one submission picks 1-10 news topics for an existing PoliticalProjectOrder
  // (many Job Cards can share one Project Order — see PoliticalProjectOrder
  // model), creating one bare Job Card per topic, each sitting PENDING at
  // JOB_CARD_PLANNING with its topic pre-filled onto `ideaDetails`. The
  // remaining planning fields (contentType, plannedDate, editorName) are
  // filled in afterward via the existing, unchanged Job Card Planning form +
  // advanceStage() flow, exactly like every other stage in this pipeline
  // (create -> Pending -> open -> submit -> advance), not skipped straight
  // to History. Political has no "client" concept in the source (it tracks
  // content projects, not client jobs) — `client` is set to the parent
  // Project Order's `projectName` so every pipelineType still has one
  // consistent "what is this row" display field — see docs/migration/DECISIONS.md.
  async createJobCardsBatch(input: CreateJobCardsBatchInput, actorUserId: number) {
    const projectOrder = await prisma.politicalProjectOrder.findUnique({
      where: { id: input.politicalProjectOrderId },
    });
    if (!projectOrder) {
      throw Object.assign(new Error("Project Order not found"), { status: 404 });
    }

    return prisma.$transaction(async (tx) => {
      const created = [];
      for (const topic of input.topics) {
        const sequence = (await tx.pipelineJob.count({ where: { pipelineType: PipelineType.POLITICAL } })) + 1;
        const jobId = `JCD-${String(sequence).padStart(5, "0")}`;

        const job = await tx.pipelineJob.create({
          data: {
            pipelineType: PipelineType.POLITICAL,
            jobId,
            client: projectOrder.projectName,
            projectName: projectOrder.projectName,
            politicalProjectOrderId: input.politicalProjectOrderId,
            ideaDetails: topic,
            currentStage: "JOB_CARD_PLANNING",
          } satisfies Prisma.PipelineJobUncheckedCreateInput,
        });

        // News Picking is real, attributable user work (unlike OTP/PMS's
        // feed-driven intake), but it lands the job straight at
        // JOB_CARD_PLANNING without going through advanceStage() — so
        // without this, whoever did the News Picking gets zero MIS credit
        // for it. "JOB_CARDS_CREATED" is a synthetic stage name (not a real
        // PoliticalStageName) used only for MIS attribution — it's never
        // queried by politicalStageService's Pending/History views (those
        // filter by real stage names), so it can't leak into the pipeline UI.
        await tx.pipelineStageEvent.create({
          data: { pipelineJobId: job.id, stage: "JOB_CARDS_CREATED", data: { topic }, actorUserId },
        });

        created.push(job);
      }
      return created;
    });
  },
};
