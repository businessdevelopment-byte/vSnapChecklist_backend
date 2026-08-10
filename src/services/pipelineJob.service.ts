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

  // Job Cards is Political's own intake stage, entered via "Add Job Card":
  // the 5 batch-level fields (plannedDate/contentType/voiceover/editorName/
  // projectCoordinatorName) are the card's real content, filled in up front.
  // Job Cards sit PENDING at JOB_CARD_PLANNING; `ideaDetails`/topic itself is
  // still filled in afterward via the existing, unchanged Job Card Planning
  // form + advanceStage() flow, exactly like every other stage in this
  // pipeline (create -> Pending -> open -> submit -> advance), not skipped
  // straight to History. `topics` is a legacy, optional escape hatch — when
  // empty (the normal case now), exactly one bare Job Card is created with
  // `ideaDetails` left blank; when given, one Job Card is created per topic
  // instead (up to 2), each getting the same batch-level fields. Political
  // has no "client" concept in the source (it tracks content projects, not
  // client jobs) — `client` is set to the parent Project Order's
  // `projectName` so every pipelineType still has one consistent "what is
  // this row" display field — see docs/migration/DECISIONS.md.
  async createJobCardsBatch(input: CreateJobCardsBatchInput, actorUserId: number) {
    const projectOrder = await prisma.politicalProjectOrder.findUnique({
      where: { id: input.politicalProjectOrderId },
    });
    if (!projectOrder) {
      throw Object.assign(new Error("Project Order not found"), { status: 404 });
    }

    const topicsToCreate: (string | undefined)[] = input.topics.length > 0 ? input.topics : [undefined];

    return prisma.$transaction(async (tx) => {
      const created = [];
      for (const topic of topicsToCreate) {
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
            // Shared across the whole batch (see createJobCardsBatchSchema) —
            // pre-fills what Job Card Planning's own form asks for per-card;
            // still editable there individually afterward.
            plannedDate: input.plannedDate ? new Date(input.plannedDate) : undefined,
            type: input.contentType,
            voiceover: input.voiceover,
            editorName: input.editorName,
            projectCoordinatorName: input.projectCoordinatorName,
            currentStage: "JOB_CARD_PLANNING",
          } satisfies Prisma.PipelineJobUncheckedCreateInput,
        });

        // Adding a Job Card is real, attributable user work (unlike OTP/PMS's
        // feed-driven intake), but it lands the job straight at
        // JOB_CARD_PLANNING without going through advanceStage() — so
        // without this, whoever created it gets zero MIS credit for it.
        // "JOB_CARDS_CREATED" is a synthetic stage name (not a real
        // PoliticalStageName) used only for MIS attribution — it's never
        // queried by politicalStageService's Pending/History views (those
        // filter by real stage names), so it can't leak into the pipeline UI.
        await tx.pipelineStageEvent.create({
          data: {
            pipelineJobId: job.id,
            stage: "JOB_CARDS_CREATED",
            data: topic ? { topic } : {},
            actorUserId,
          },
        });

        created.push(job);
      }
      return created;
    });
  },
};
