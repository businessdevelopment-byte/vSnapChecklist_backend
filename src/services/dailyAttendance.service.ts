import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  DailyAttendanceQueryInput,
  CreateDailyAttendanceInput,
  MyAttendanceQueryInput,
} from "../schemas/dailyAttendance.schemas";

// Matches MyAttendance.jsx's own working-hours/overtime parsing exactly:
// "H:MM" -> hours + minutes/60, with "0:00"/empty treated as 0.
function parseHours(value: string): number {
  if (!value || value === "0:00") return 0;
  const [h, m] = value.split(":").map(Number);
  return h + m / 60;
}

export const dailyAttendanceService = {
  // Matches AttendanceDaily.jsx's own filter exactly: name/empIdCode search
  // plus an inclusive start/end date range over `date` (AttendanceDaily.jsx:15-19).
  async list(query: DailyAttendanceQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.DailyAttendanceWhereInput = {};
    if (query.search) {
      where.employee = {
        OR: [
          { candidateName: { contains: query.search, mode: "insensitive" } },
          { joiningNo: { contains: query.search, mode: "insensitive" } },
        ],
      };
    }
    if (query.startDate || query.endDate) {
      where.date = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      prisma.dailyAttendance.findMany({
        where,
        skip,
        take,
        orderBy: { date: "desc" },
        include: { employee: true },
      }),
      prisma.dailyAttendance.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateDailyAttendanceInput) {
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) {
      throw Object.assign(new Error("Employee not found"), { status: 404 });
    }

    const date = new Date(input.date);
    const existing = await prisma.dailyAttendance.findUnique({
      where: { employeeId_date: { employeeId: input.employeeId, date } },
    });
    if (existing) {
      throw Object.assign(new Error("Attendance already recorded for this employee and date"), { status: 400 });
    }

    return prisma.dailyAttendance.create({
      data: { ...input, date } satisfies Prisma.DailyAttendanceUncheckedCreateInput,
      include: { employee: true },
    });
  },

  // Module #53 (My Attendance, self-service). Resolves "me" via
  // User.employeeId (Module #53's identity-link decision) — never trusts a
  // client-supplied employeeId for this endpoint. Matches MyAttendance.jsx's
  // own stat computation exactly (MyAttendance.jsx:15-29): Total/Present/
  // Absent day counts plus summed working/overtime hours, computed here
  // server-side over the real DailyAttendance rows instead of client-side
  // over a hardcoded 'EMP001' filter.
  async getForCurrentUser(userId: number, query: MyAttendanceQueryInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.employeeId) {
      throw Object.assign(
        new Error("Your account is not linked to an employee record. Contact an administrator."),
        { status: 400 }
      );
    }

    const records = await prisma.dailyAttendance.findMany({
      where: { employeeId: user.employeeId, month: query.month, year: query.year },
      orderBy: { date: "asc" },
    });

    const totalDays = records.length;
    const present = records.filter((r) => r.status === "Present").length;
    const absent = records.filter((r) => r.status === "Absent").length;
    const totalHours = Number(records.reduce((sum, r) => sum + parseHours(r.workingHours), 0).toFixed(1));
    const totalOvertime = Number(records.reduce((sum, r) => sum + parseHours(r.overtimeHours), 0).toFixed(1));

    return {
      stats: { totalDays, present, absent, totalHours, totalOvertime },
      records,
    };
  },
};
