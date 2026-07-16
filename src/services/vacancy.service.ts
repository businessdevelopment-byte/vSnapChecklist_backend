import crypto from "crypto";
import { prisma } from "../config/database";
import type { CreateVacancyInput, UpdateVacancyInput, VacancyApprovalInput } from "../schemas/vacancy.schemas";

export const vacancyService = {
  async list(filters?: { status?: string; approvalStatus?: string }) {
    return prisma.vacancy.findMany({
      where: {
        status: filters?.status as any,
        approvalStatus: filters?.approvalStatus as any,
      },
      include: { designation: { include: { department: true } }, jobApplications: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(id: number) {
    return prisma.vacancy.findUnique({
      where: { id },
      include: { designation: { include: { department: true } }, jobApplications: true },
    });
  },

  async getByNumber(vacancyNumber: string) {
    return prisma.vacancy.findUnique({
      where: { vacancyNumber },
      include: { designation: { include: { department: true } }, jobApplications: true },
    });
  },

  async create(input: CreateVacancyInput) {
    const vacancy = await prisma.vacancy.create({
      data: {
        vacancyName: input.vacancyName,
        designationId: input.designationId,
        gender: input.gender,
        numberOfPosts: input.numberOfPosts,
        completionDate: input.completionDate,
        salaryCriteria: input.salaryCriteria,
        jobDescription: input.jobDescription,
        preferredQualification: input.preferredQualification,
        preferredLocation: input.preferredLocation,
        preferredExperience: input.preferredExperience,
        experienceRequired: input.experienceRequired,
        socialPlatforms: input.socialPlatforms,
        postingLinks: input.postingLinks as any,
        priority: input.priority,
        remarks: input.remarks,
        vacancyNumber: "", // placeholder, will be updated
        shareToken: "", // placeholder, will be updated
      },
      include: { designation: true },
    });

    // Generate vacancyNumber = VAC-{id padStart 3} and shareToken
    const vacancyNumber = `VAC-${vacancy.id.toString().padStart(3, "0")}`;
    const shareToken = crypto.randomBytes(8).toString("hex");

    const updated = await prisma.vacancy.update({
      where: { id: vacancy.id },
      data: { vacancyNumber, shareToken },
      include: { designation: { include: { department: true } } },
    });

    return updated;
  },

  async update(id: number, input: UpdateVacancyInput) {
    const data: any = {};
    if (input.vacancyName !== undefined) data.vacancyName = input.vacancyName;
    if (input.gender !== undefined) data.gender = input.gender;
    if (input.numberOfPosts !== undefined) data.numberOfPosts = input.numberOfPosts;
    if (input.completionDate !== undefined) data.completionDate = input.completionDate;
    if (input.salaryCriteria !== undefined) data.salaryCriteria = input.salaryCriteria;
    if (input.jobDescription !== undefined) data.jobDescription = input.jobDescription;
    if (input.preferredQualification !== undefined) data.preferredQualification = input.preferredQualification;
    if (input.preferredLocation !== undefined) data.preferredLocation = input.preferredLocation;
    if (input.preferredExperience !== undefined) data.preferredExperience = input.preferredExperience;
    if (input.experienceRequired !== undefined) data.experienceRequired = input.experienceRequired;
    if (input.socialPlatforms !== undefined) data.socialPlatforms = input.socialPlatforms;
    if (input.postingLinks !== undefined) data.postingLinks = input.postingLinks;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.remarks !== undefined) data.remarks = input.remarks;

    return prisma.vacancy.update({
      where: { id },
      data,
      include: { designation: { include: { department: true } } },
    });
  },

  async updateByNumber(vacancyNumber: string, input: UpdateVacancyInput) {
    const data: any = {};
    if (input.vacancyName !== undefined) data.vacancyName = input.vacancyName;
    if (input.gender !== undefined) data.gender = input.gender;
    if (input.numberOfPosts !== undefined) data.numberOfPosts = input.numberOfPosts;
    if (input.completionDate !== undefined) data.completionDate = input.completionDate;
    if (input.salaryCriteria !== undefined) data.salaryCriteria = input.salaryCriteria;
    if (input.jobDescription !== undefined) data.jobDescription = input.jobDescription;
    if (input.preferredQualification !== undefined) data.preferredQualification = input.preferredQualification;
    if (input.preferredLocation !== undefined) data.preferredLocation = input.preferredLocation;
    if (input.preferredExperience !== undefined) data.preferredExperience = input.preferredExperience;
    if (input.experienceRequired !== undefined) data.experienceRequired = input.experienceRequired;
    if (input.socialPlatforms !== undefined) data.socialPlatforms = input.socialPlatforms;
    if (input.postingLinks !== undefined) data.postingLinks = input.postingLinks;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.remarks !== undefined) data.remarks = input.remarks;

    return prisma.vacancy.update({
      where: { vacancyNumber },
      data,
      include: { designation: { include: { department: true } } },
    });
  },

  async updateApproval(vacancyNumber: string, input: VacancyApprovalInput) {
    return prisma.vacancy.update({
      where: { vacancyNumber },
      data: {
        approvalStatus: input.approvalStatus as any,
        rejectionRemark: input.rejectionRemark,
      },
      include: { designation: { include: { department: true } } },
    });
  },

  async delete(id: number) {
    return prisma.vacancy.delete({
      where: { id },
    });
  },

  async deleteByNumber(vacancyNumber: string) {
    return prisma.vacancy.delete({
      where: { vacancyNumber },
    });
  },
};
