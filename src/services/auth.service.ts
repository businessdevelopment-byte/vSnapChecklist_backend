import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import { signToken } from "../utils/jwt";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas";

export const authService = {
  async login(input: LoginInput, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { username: input.username },
      include: { department: { select: { id: true, name: true } } },
    });

    if (!user || user.status === "INACTIVE") {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }

    // Log attendance (fire and forget — don't block login on failure)
    prisma.attendanceLog
      .create({ data: { userId: user.id, ipAddress } })
      .catch(() => {});

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const { passwordHash: _, ...safeUser } = user;
    return { token, user: safeUser };
  },

  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { username: input.username },
    });
    if (existing) {
      throw Object.assign(new Error("Username already taken"), { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        email: input.email ?? null,
        departmentId: input.departmentId ?? null,
        role: input.role ?? "USER",
        status: "ACTIVE",
      },
      include: { department: { select: { id: true, name: true } } },
    });

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const { passwordHash: _, ...safeUser } = user;
    return { token, user: safeUser };
  },
};
