import { prisma } from "../config/database";
import type { CreateJobApplicationInput, ListJobApplicationInput } from "../schemas/jobApplication.schemas";

export const jobApplicationService = {
  async create(input: CreateJobApplicationInput, createdByUserId: number) {
    // Validate vacancy exists and is approved
    const vacancy = await prisma.vacancy.findUnique({
      where: { id: input.vacancyId },
    });

    if (!vacancy) {
      throw Object.assign(new Error("Vacancy not found"), { status: 404 });
    }

    if (vacancy.approvalStatus !== "APPROVED") {
      throw Object.assign(new Error("Vacancy must be approved for applications"), { status: 400 });
    }

    // Check experienceRequired rule
    if (vacancy.experienceRequired && !input.jobExperience) {
      throw Object.assign(new Error("Job experience is required for this vacancy"), { status: 400 });
    }

    // Create application with stage = APPLIED
    const application = await prisma.jobApplication.create({
      data: {
        ...input,
        applicationNumber: "", // placeholder
        stage: "APPLIED",
        createdByUserId,
      },
      include: { vacancy: { include: { designation: true } } },
    });

    // Generate applicationNumber = APP-{id padStart 3}
    const applicationNumber = `APP-${application.id.toString().padStart(3, "0")}`;

    const updated = await prisma.jobApplication.update({
      where: { id: application.id },
      data: { applicationNumber },
      include: { vacancy: { include: { designation: true } } },
    });

    return updated;
  },

  async list(filters?: ListJobApplicationInput) {
    const where: any = {};

    if (filters?.vacancyId) where.vacancyId = filters.vacancyId;
    if (filters?.source) where.source = filters.source as any;
    if (filters?.stage) {
      const stages = filters.stage.split(",").map(s => s.trim());
      where.stage = { in: stages as any };
    }
    if (filters?.search) {
      where.OR = [
        { applicationNumber: { contains: filters.search, mode: "insensitive" } },
        { candidateName: { contains: filters.search, mode: "insensitive" } },
        { candidatePhone: { contains: filters.search, mode: "insensitive" } },
        { candidateEmail: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return prisma.jobApplication.findMany({
      where,
      include: { vacancy: { include: { designation: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(id: number) {
    return prisma.jobApplication.findUnique({
      where: { id },
      include: { vacancy: { include: { designation: true } } },
    });
  },
};
