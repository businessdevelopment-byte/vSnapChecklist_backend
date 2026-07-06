import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { LeavingRecordQueryInput, CreateLeavingRecordInput } from "../schemas/leavingRecord.schemas";

export const leavingRecordService = {
  // Matches Leaving.jsx's own Pending tab (EMPLOYEES.filter(e => e.status ===
  // 'Active')). Independent of OnboardingChecklist's own Pending filter —
  // an employee can be mid-onboarding and also marked leaving.
  async listPending(query: LeavingRecordQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.EmployeeWhereInput = { status: "Active" };
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

  async listHistory(query: LeavingRecordQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.LeavingRecordWhereInput = {};
    if (query.search) {
      where.employee = {
        OR: [
          { candidateName: { contains: query.search, mode: "insensitive" } },
          { joiningNo: { contains: query.search, mode: "insensitive" } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      prisma.leavingRecord.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { employee: true },
      }),
      prisma.leavingRecord.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateLeavingRecordInput) {
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { leavingRecord: true },
    });
    if (!employee) {
      throw Object.assign(new Error("Employee not found"), { status: 404 });
    }
    if (employee.status !== "Active" || employee.leavingRecord) {
      throw Object.assign(new Error("Employee is not active"), { status: 400 });
    }

    const [, leavingRecord] = await prisma.$transaction([
      prisma.employee.update({ where: { id: input.employeeId }, data: { status: "Left" } }),
      prisma.leavingRecord.create({
        data: {
          employeeId: input.employeeId,
          dateOfLeaving: new Date(input.dateOfLeaving),
          mobileNumber: input.mobileNumber,
          reasonOfLeaving: input.reasonOfLeaving,
        } satisfies Prisma.LeavingRecordUncheckedCreateInput,
        include: { employee: true },
      }),
    ]);

    return leavingRecord;
  },
};
