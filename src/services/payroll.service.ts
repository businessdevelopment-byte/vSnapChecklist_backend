import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { PayrollQueryInput, CreatePayrollEntryInput, MySalaryQueryInput } from "../schemas/payroll.schemas";

export const payrollService = {
  async list(query: PayrollQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.PayrollEntryWhereInput = {};
    if (query.month) {
      where.month = query.month;
    }
    if (query.search) {
      where.employee = {
        OR: [
          { candidateName: { contains: query.search, mode: "insensitive" } },
          { joiningNo: { contains: query.search, mode: "insensitive" } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      prisma.payrollEntry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { employee: true },
      }),
      prisma.payrollEntry.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  // Matches Payroll.jsx's own gross/net formula exactly (Payroll.jsx:24-26):
  // gross = basic + lta + bonus + otherAllowances + overtime;
  // totalDeductions = pf + loan + otherDeductions; net = gross - totalDeductions.
  async create(input: CreatePayrollEntryInput) {
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) {
      throw Object.assign(new Error("Employee not found"), { status: 404 });
    }

    const existing = await prisma.payrollEntry.findUnique({
      where: { employeeId_year_month: { employeeId: input.employeeId, year: input.year, month: input.month } },
    });
    if (existing) {
      throw Object.assign(new Error("Payroll already recorded for this employee and month"), { status: 400 });
    }

    const gross = input.basicSalary + input.lta + input.bonus + input.otherAllowances + input.overtime;
    const totalDeductions = input.pf + input.loan + input.otherDeductions;
    const netSalary = gross - totalDeductions;

    return prisma.payrollEntry.create({
      data: {
        employeeId: input.employeeId,
        year: input.year,
        month: input.month,
        basicSalary: input.basicSalary,
        lta: input.lta,
        bonus: input.bonus,
        otherAllowances: input.otherAllowances,
        overtime: input.overtime,
        gross,
        pf: input.pf,
        loan: input.loan,
        otherDeductions: input.otherDeductions,
        totalDeductions,
        netSalary,
        status: input.status,
        payDate: input.payDate ? new Date(input.payDate) : undefined,
      } satisfies Prisma.PayrollEntryUncheckedCreateInput,
      include: { employee: true },
    });
  },

  // Module #55 (My Salary, self-service). Resolves "me" via User.employeeId
  // (Module #53's identity-link decision) — same pattern as
  // dailyAttendanceService.getForCurrentUser, never trusts a client-supplied
  // employeeId. Matches MySalary.jsx's own stat computation exactly
  // (MySalary.jsx:16-19): totalEarnings = sum(gross), avgSalary =
  // round(totalEarnings / count), totalDeductions = sum(totalDeductions),
  // totalOvertime = sum(overtime) — all scoped to the selected year.
  // "Allowances" (lta + bonus + otherAllowances) is computed per record,
  // matching every "Allowances" column/breakdown-card in the source exactly
  // (MySalary.jsx:51,75).
  async getForCurrentUser(userId: number, query: MySalaryQueryInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.employeeId) {
      throw Object.assign(
        new Error("Your account is not linked to an employee record. Contact an administrator."),
        { status: 400 }
      );
    }

    const entries = await prisma.payrollEntry.findMany({
      where: { employeeId: user.employeeId, year: query.year },
      orderBy: { createdAt: "desc" },
    });

    const toRecord = (e: (typeof entries)[number]) => ({
      id: e.id,
      month: e.month,
      year: e.year,
      basicSalary: e.basicSalary,
      allowances: Number(e.lta) + Number(e.bonus) + Number(e.otherAllowances),
      overtime: e.overtime,
      totalDeductions: e.totalDeductions,
      netSalary: e.netSalary,
      status: e.status,
      payDate: e.payDate,
    });

    const totalEarnings = entries.reduce((sum, e) => sum + Number(e.gross), 0);
    const avgSalary = entries.length > 0 ? Math.round(totalEarnings / entries.length) : 0;
    const totalDeductions = entries.reduce((sum, e) => sum + Number(e.totalDeductions), 0);
    const totalOvertime = entries.reduce((sum, e) => sum + Number(e.overtime), 0);

    return {
      stats: { totalEarnings, avgSalary, totalDeductions, totalOvertime },
      latest: entries[0] ? toRecord(entries[0]) : null,
      records: entries.map(toRecord),
    };
  },
};
