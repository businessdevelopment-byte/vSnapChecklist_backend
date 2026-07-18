import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  MonthlyAttendanceQueryInput,
  CreateMonthlyAttendanceInput,
} from "../schemas/monthlyAttendance.schemas";

export const monthlyAttendanceService = {
  async list(query: MonthlyAttendanceQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.MonthlyAttendanceWhereInput = {};
    if (query.search) {
      where.employee = {
        OR: [
          { candidateName: { contains: query.search, mode: "insensitive" } },
          { joiningNo: { contains: query.search, mode: "insensitive" } },
          { designation: { contains: query.search, mode: "insensitive" } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      prisma.monthlyAttendance.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { employee: true },
      }),
      prisma.monthlyAttendance.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateMonthlyAttendanceInput) {
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) {
      throw Object.assign(new Error("Employee not found"), { status: 404 });
    }

    const existing = await prisma.monthlyAttendance.findUnique({
      where: { employeeId_year_month: { employeeId: input.employeeId, year: input.year, month: input.month } },
    });
    if (existing) {
      throw Object.assign(new Error("Monthly attendance already recorded for this employee and month"), { status: 400 });
    }

    return prisma.monthlyAttendance.create({
      data: { ...input } satisfies Prisma.MonthlyAttendanceUncheckedCreateInput,
      include: { employee: true },
    });
  },
};
