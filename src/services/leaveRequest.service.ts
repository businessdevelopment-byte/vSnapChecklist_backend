import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  LeaveRequestQueryInput,
  LeaveBalanceQueryInput,
  CreateLeaveRequestInput,
  LeaveManagementQueryInput,
  UpdateLeaveRequestStatusInput,
} from "../schemas/leaveRequest.schemas";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Master's own annual allotments (LeaveRequest.jsx's `balances` array) —
// hardcoded there too, no admin-configurable source exists.
const LEAVE_TYPE_TOTALS: Record<string, number> = {
  "Casual Leave": 12,
  "Earned Leave": 21,
  "Sick Leave": 7,
};

// Matches LeaveRequest.jsx's own inclusive day-count formula exactly:
// (to - from) / 1 day in ms + 1, clamped to 0 for an invalid/reversed range.
function calculateDays(fromDate: Date, toDate: Date): number {
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return days > 0 ? days : 0;
}

export const leaveRequestService = {
  async listByEmployee(query: LeaveRequestQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.LeaveRequestWhereInput = { employeeId: query.employeeId };

    // Month-only filter (year-agnostic, matching source's own
    // `new Date(l.startDate).getMonth() === months.indexOf(monthFilter)`
    // check) can't be expressed as a Prisma where-clause — filtered in
    // application code below instead.
    const [rawData, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    const filtered = query.month
      ? rawData.filter((l) => l.fromDate.getUTCMonth() === MONTH_NAMES.indexOf(query.month!))
      : rawData;

    const data = filtered.slice(skip, skip + take);

    return {
      data,
      pagination: buildPaginationMeta(query.month ? filtered.length : total, page, limit),
    };
  },

  async getBalances(query: LeaveBalanceQueryInput) {
    const approved = await prisma.leaveRequest.findMany({
      where: { employeeId: query.employeeId, status: "Approved" },
    });

    return Object.entries(LEAVE_TYPE_TOTALS).map(([type, total]) => {
      const used = approved.filter((l) => l.leaveType === type).reduce((sum, l) => sum + l.days, 0);
      return { leaveType: type, used, total, remaining: Math.max(total - used, 0) };
    });
  },

  async create(input: CreateLeaveRequestInput) {
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) {
      throw Object.assign(new Error("Employee not found"), { status: 404 });
    }

    const sequence = (await prisma.leaveRequest.count()) + 1;
    const serialNo = `LV${String(sequence).padStart(3, "0")}`;
    const fromDate = new Date(input.fromDate);
    const toDate = new Date(input.toDate);

    return prisma.leaveRequest.create({
      data: {
        serialNo,
        employeeId: input.employeeId,
        leaveType: input.leaveType,
        fromDate,
        toDate,
        days: calculateDays(fromDate, toDate),
        reason: input.reason,
        status: "Pending",
      } satisfies Prisma.LeaveRequestUncheckedCreateInput,
    });
  },

  // Matches LeaveManagement.jsx's own three-tab admin view — every
  // LeaveRequest across all employees, filtered by status (unlike
  // listByEmployee, which is scoped to one employee for the self-service
  // page). Joins the employee for display, since the admin table needs
  // employee identity fields that leaveRequestService.listByEmployee's own
  // single-employee context doesn't need to fetch redundantly.
  async listAll(query: LeaveManagementQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.LeaveRequestWhereInput = { status: query.status };
    if (query.search) {
      where.employee = {
        OR: [
          { candidateName: { contains: query.search, mode: "insensitive" } },
          { joiningNo: { contains: query.search, mode: "insensitive" } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { employee: true },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async updateStatus(id: number, input: UpdateLeaveRequestStatusInput) {
    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leaveRequest) {
      throw Object.assign(new Error("Leave request not found"), { status: 404 });
    }
    if (leaveRequest.status !== "Pending") {
      throw Object.assign(new Error("Only pending leave requests can be approved or rejected"), { status: 400 });
    }

    return prisma.leaveRequest.update({
      where: { id },
      data: { status: input.status },
      include: { employee: true },
    });
  },
};
