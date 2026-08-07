// One-off backfill: assignedMember used to live only inside each job's
// ASSIGN_MEMBER stage-event JSON. It's now a real column on OtpJob (and is
// carried to PipelineJob at the OTP -> PMS hand-off), so existing rows need
// the value lifted out of their event payload — otherwise every job created
// before this change is invisible to the new filter.
//
// Safe to re-run: only ever fills a value in, never clears or overwrites one.
//
//   npx tsx scripts/backfillAssignedMember.ts
import { prisma } from "../src/config/database";

async function main() {
  const events = await prisma.otpStageEvent.findMany({
    where: { stage: "ASSIGN_MEMBER" },
    orderBy: { id: "asc" },
    select: { otpJobId: true, data: true },
  });

  // Later events win — a job can be re-assigned.
  const memberByJobId = new Map<number, string>();
  for (const event of events) {
    const value = (event.data as Record<string, unknown> | null)?.assignedMember;
    if (typeof value === "string" && value.trim()) {
      memberByJobId.set(event.otpJobId, value.trim());
    }
  }

  let otpUpdated = 0;
  for (const [otpJobId, assignedMember] of memberByJobId) {
    const result = await prisma.otpJob.updateMany({
      where: { id: otpJobId, assignedMember: null },
      data: { assignedMember },
    });
    otpUpdated += result.count;
  }

  // Propagate to PMS by the jobId the hand-off deliberately reuses.
  const assignedOtpJobs = await prisma.otpJob.findMany({
    where: { assignedMember: { not: null } },
    select: { jobId: true, assignedMember: true },
  });

  let pipelineUpdated = 0;
  for (const job of assignedOtpJobs) {
    const result = await prisma.pipelineJob.updateMany({
      where: { jobId: job.jobId, assignedMember: null },
      data: { assignedMember: job.assignedMember },
    });
    pipelineUpdated += result.count;
  }

  console.log(
    `ASSIGN_MEMBER events scanned: ${events.length}\n` +
      `Jobs with a member recorded: ${memberByJobId.size}\n` +
      `OtpJob rows backfilled:      ${otpUpdated}\n` +
      `PipelineJob rows backfilled: ${pipelineUpdated}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
