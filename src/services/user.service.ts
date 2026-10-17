import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import type { CreateUserInput, ImportUsersInput, UpdateUserDeptsInput } from "../schemas/user.schemas";
import { findUserByUsername, normalizeUsername } from "../utils/username";

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  departments: { select: { department: { select: { id: true, name: true } } } },
  employeeId: true,
  employee: { select: { id: true, joiningNo: true, candidateName: true, designation: true } },
  createdAt: true,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flatten(u: any) {
  return { ...u, departments: (u.departments ?? []).map((d: any) => d.department) };
}

export const userService = {
  async getAll(statusFilter?: "ACTIVE" | "INACTIVE") {
    const users = await prisma.user.findMany({
      orderBy: { username: "asc" },
      select: USER_SELECT,
      ...(statusFilter ? { where: { status: statusFilter } } : {}),
    });
    return users.map(flatten);
  },

  async getById(id: number) {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return flatten(user);
  },

  async getMe(id: number) {
    return this.getById(id);
  },

  async create(input: CreateUserInput) {
    const exists = await prisma.user.findUnique({ where: { username: input.username } });
    if (exists) throw Object.assign(new Error("Username already taken"), { status: 409 });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        role: input.role,
        email: input.email ?? null,
        departmentId: input.departmentId ?? null,
        status: "ACTIVE",
        ...(input.departmentId ? {
          departments: { create: { departmentId: input.departmentId } },
        } : {}),
      },
      select: USER_SELECT,
    });
    return flatten(user);
  },

  async updateStatus(id: number, status: "ACTIVE" | "INACTIVE") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return flatten(await prisma.user.update({ where: { id }, data: { status }, select: USER_SELECT }));
  },

  async updateMe(id: number, data: { email?: string | null; departmentId?: number | null }) {
    return flatten(await prisma.user.update({ where: { id }, data, select: USER_SELECT }));
  },

  async updateRole(id: number, role: "ADMIN" | "USER") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return flatten(await prisma.user.update({ where: { id }, data: { role }, select: USER_SELECT }));
  },

  async updateDepartment(id: number, departmentId: number | null) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return flatten(await prisma.user.update({ where: { id }, data: { departmentId }, select: USER_SELECT }));
  },

  // Admin-only link between a login account and its HR roster record —
  // see the User.employeeId schema comment (Module #53) for why this exists.
  async updateEmployeeLink(id: number, employeeId: number | null) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    if (employeeId !== null) {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });

      const alreadyLinked = await prisma.user.findUnique({ where: { employeeId } });
      if (alreadyLinked && alreadyLinked.id !== id) {
        throw Object.assign(new Error("This employee is already linked to another user account"), { status: 400 });
      }
    }

    return flatten(await prisma.user.update({ where: { id }, data: { employeeId }, select: USER_SELECT }));
  },

  async updateDepartments(id: number, input: UpdateUserDeptsInput) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    const { departmentIds } = input;
    await prisma.$transaction([
      prisma.userDepartment.deleteMany({ where: { userId: id } }),
      ...(departmentIds.length > 0
        ? [prisma.userDepartment.createMany({
            data: departmentIds.map(departmentId => ({ userId: id, departmentId })),
            skipDuplicates: true,
          })]
        : []),
      prisma.user.update({ where: { id }, data: { departmentId: departmentIds[0] ?? null } }),
    ]);
    return this.getById(id);
  },

  // A username already in the system is UPDATED from the CSV (password, role,
  // department, email) instead of skipped — otherwise anyone who already had
  // an account silently kept their old password and the CSV login failed.
  // Their tasks/history are untouched, and status is left as is (an INACTIVE
  // user stays inactive and is reported so the admin knows they can't log in).
  async importMany(input: ImportUsersInput, requesterId: number) {
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      updatedUsernames: [] as string[],
      skippedUsernames: [] as string[],
      inactiveUsernames: [] as string[],
    };

    // Several staff share one mailbox in the source sheets, and email is
    // unique — the first row keeps it, the rest are saved without one.
    const emailFreeFor = async (email: string | null | undefined, userId?: number) => {
      if (!email) return null;
      const owner = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });
      return !owner || owner.id === userId ? email : null;
    };

    for (const u of input) {
      const username = normalizeUsername(u.username);
      try {
        const existing = await findUserByUsername(username, { id: true, username: true, status: true });
        const passwordHash = await bcrypt.hash(u.password, 10);

        if (existing) {
          // The importing admin's own row would let a sheet change their
          // password or demote them mid-session.
          if (existing.id === requesterId) {
            results.skipped++;
            results.skippedUsernames.push(`${existing.username} (your own account)`);
            continue;
          }
          const email = await emailFreeFor(u.email, existing.id);
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              passwordHash,
              role: u.role ?? "USER",
              ...(email ? { email } : {}),
              ...(u.departmentId ? { departmentId: u.departmentId } : {}),
            },
          });
          if (u.departmentId) {
            await prisma.userDepartment.upsert({
              where: { userId_departmentId: { userId: existing.id, departmentId: u.departmentId } },
              create: { userId: existing.id, departmentId: u.departmentId },
              update: {},
            });
          }
          results.updated++;
          results.updatedUsernames.push(existing.username);
          if (existing.status === "INACTIVE") results.inactiveUsernames.push(existing.username);
          continue;
        }

        await prisma.user.create({
          data: {
            username,
            passwordHash,
            role: u.role ?? "USER",
            email: await emailFreeFor(u.email),
            departmentId: u.departmentId ?? null,
            status: "ACTIVE",
            ...(u.departmentId ? {
              departments: { create: { departmentId: u.departmentId } },
            } : {}),
          },
        });
        results.created++;
      } catch {
        results.errors.push(username);
      }
    }

    return results;
  },
};
