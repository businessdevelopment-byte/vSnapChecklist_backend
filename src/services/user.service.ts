import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import type { CreateUserInput, ImportUsersInput } from "../schemas/user.schemas";

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  createdAt: true,
} as const;

export const userService = {
  async getAll() {
    return prisma.user.findMany({
      orderBy: { username: "asc" },
      select: USER_SELECT,
    });
  },

  async getById(id: number) {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return user;
  },

  async getMe(id: number) {
    return this.getById(id);
  },

  async create(input: CreateUserInput) {
    const exists = await prisma.user.findUnique({ where: { username: input.username } });
    if (exists) throw Object.assign(new Error("Username already taken"), { status: 409 });

    const passwordHash = await bcrypt.hash(input.password, 10);
    return prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        role: input.role,
        email: input.email ?? null,
        departmentId: input.departmentId ?? null,
        status: "ACTIVE",
      },
      select: USER_SELECT,
    });
  },

  async updateStatus(id: number, status: "ACTIVE" | "INACTIVE") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return prisma.user.update({ where: { id }, data: { status }, select: USER_SELECT });
  },

  async updateMe(id: number, data: { email?: string | null; departmentId?: number | null }) {
    return prisma.user.update({ where: { id }, data, select: USER_SELECT });
  },

  async updateRole(id: number, role: "ADMIN" | "USER") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return prisma.user.update({ where: { id }, data: { role }, select: USER_SELECT });
  },

  async updateDepartment(id: number, departmentId: number | null) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return prisma.user.update({ where: { id }, data: { departmentId }, select: USER_SELECT });
  },

  async importMany(input: ImportUsersInput) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const u of input) {
      try {
        const exists = await prisma.user.findUnique({ where: { username: u.username } });
        if (exists) { results.skipped++; continue; }

        const passwordHash = await bcrypt.hash(u.password, 10);
        await prisma.user.create({
          data: {
            username: u.username,
            passwordHash,
            role: u.role ?? "USER",
            email: u.email ?? null,
            departmentId: u.departmentId ?? null,
            status: "ACTIVE",
          },
        });
        results.created++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Email uniqueness — retry without email
        if (msg.includes("Unique constraint")) {
          try {
            const passwordHash = await bcrypt.hash(u.password, 10);
            await prisma.user.create({
              data: {
                username: u.username,
                passwordHash,
                role: u.role ?? "USER",
                email: null,
                departmentId: u.departmentId ?? null,
                status: "ACTIVE",
              },
            });
            results.created++;
          } catch {
            results.errors.push(u.username);
          }
        } else {
          results.errors.push(u.username);
        }
      }
    }

    return results;
  },
};
