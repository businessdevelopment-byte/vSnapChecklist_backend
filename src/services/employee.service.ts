import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type {
  EmployeeQueryInput,
  CreateEmployeeInput,
  UpdateMyProfileEmployeeInput,
} from "../schemas/employee.schemas";

async function resolveOwnEmployeeId(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.employeeId) {
    throw Object.assign(
      new Error("Your account is not linked to an employee record. Contact an administrator."),
      { status: 400 }
    );
  }
  return user.employeeId;
}

export const employeeService = {
  async list(query: EmployeeQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.EmployeeWhereInput = {};
    if (query.search) {
      where.OR = [
        { candidateName: { contains: query.search, mode: "insensitive" } },
        { joiningNo: { contains: query.search, mode: "insensitive" } },
        { designation: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.employee.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.employee.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateEmployeeInput) {
    const sequence = (await prisma.employee.count()) + 1;
    const joiningNo = `EMP${String(sequence).padStart(3, "0")}`;

    return prisma.employee.create({
      data: {
        ...input,
        joiningNo,
        dateOfJoining: new Date(input.dateOfJoining),
        bodAsPerAadhar: input.bodAsPerAadhar ? new Date(input.bodAsPerAadhar) : undefined,
      } satisfies Prisma.EmployeeUncheckedCreateInput,
    });
  },

  // Module #56 (My Profile, self-service). Resolves "me" via
  // User.employeeId (Module #53's identity-link decision) — same pattern as
  // dailyAttendanceService.getForCurrentUser / payrollService.getForCurrentUser.
  async getMyProfile(userId: number) {
    const employeeId = await resolveOwnEmployeeId(userId);
    return prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  },

  // Matches MyProfile.jsx's own editable-field set exactly (MyProfile.jsx:14)
  // — only mobileNo/familyMobileNo/email/currentAddress can be changed;
  // every other Employee field is untouched by this endpoint. Unlike the
  // source (whose handleSave only updates local component state — never
  // actually persists), this writes through to the real Employee record.
  async updateMyProfile(userId: number, input: UpdateMyProfileEmployeeInput) {
    const employeeId = await resolveOwnEmployeeId(userId);
    return prisma.employee.update({ where: { id: employeeId }, data: input });
  },
};
