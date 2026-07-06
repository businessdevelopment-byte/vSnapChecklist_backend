import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { OnboardingChecklistQueryInput, CreateOnboardingChecklistInput } from "../schemas/onboardingChecklist.schemas";

export const onboardingChecklistService = {
  // Matches AfterJoiningWork.jsx's own Pending tab (EMPLOYEES.filter(e => e.status
  // === 'Active')), but additionally excludes employees who already have a
  // persisted checklist — fixing the source's bug where a completed employee
  // would reappear in Pending after a page refresh.
  async listPending(query: OnboardingChecklistQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.EmployeeWhereInput = {
      status: "Active",
      onboardingChecklist: { is: null },
    };
    if (query.search) {
      where.OR = [
        { candidateName: { contains: query.search, mode: "insensitive" } },
        { joiningNo: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.employee.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.employee.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async listHistory(query: OnboardingChecklistQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.OnboardingChecklistWhereInput = {};
    if (query.search) {
      where.employee = {
        OR: [
          { candidateName: { contains: query.search, mode: "insensitive" } },
          { joiningNo: { contains: query.search, mode: "insensitive" } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      prisma.onboardingChecklist.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { employee: true },
      }),
      prisma.onboardingChecklist.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateOnboardingChecklistInput) {
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { onboardingChecklist: true },
    });
    if (!employee) {
      throw Object.assign(new Error("Employee not found"), { status: 404 });
    }
    if (employee.onboardingChecklist) {
      throw Object.assign(new Error("Onboarding checklist already submitted for this employee"), { status: 400 });
    }

    return prisma.onboardingChecklist.create({
      data: { ...input } satisfies Prisma.OnboardingChecklistUncheckedCreateInput,
      include: { employee: true },
    });
  },
};
