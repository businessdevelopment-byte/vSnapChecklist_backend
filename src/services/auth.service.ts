import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import { signAccessToken } from "../utils/jwt";
import { generateRefreshToken, hashRefreshToken } from "../utils/refreshToken";
import { env } from "../config/env";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas";
import crypto from "crypto";

export const authService = {
  async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
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

    prisma.attendanceLog
      .create({ data: { userId: user.id, ipAddress } })
      .catch(() => {});

    const { token: rawRefreshToken, tokenHash } = generateRefreshToken();
    const family = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    const accessToken = signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const { passwordHash: _, ...safeUser } = user;
    return { accessToken, refreshToken: rawRefreshToken, user: safeUser };
  },

  async register(input: RegisterInput, ipAddress?: string, userAgent?: string) {
    const existing = await prisma.user.findUnique({
      where: { username: input.username },
    });
    if (existing) {
      throw Object.assign(new Error("Username already taken"), { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        email: input.email ?? null,
        departmentId: input.departmentId ?? null,
        role: "USER",
        status: "ACTIVE",
      },
      include: { department: { select: { id: true, name: true } } },
    });

    const { token: rawRefreshToken, tokenHash } = generateRefreshToken();
    const family = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    const accessToken = signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const { passwordHash: _, ...safeUser } = user;
    return { accessToken, refreshToken: rawRefreshToken, user: safeUser };
  },

  async refreshAccessToken(rawToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = hashRefreshToken(rawToken);

    const refreshTokenRow = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { department: { select: { id: true, name: true } } } } },
    });

    if (!refreshTokenRow) {
      throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
    }

    if (refreshTokenRow.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { family: refreshTokenRow.family },
        data: { revokedAt: new Date() },
      });
      throw Object.assign(new Error("Refresh token revoked (token family revoked due to reuse detection)"), { status: 401 });
    }

    if (refreshTokenRow.replacedByTokenId) {
      await prisma.refreshToken.updateMany({
        where: { family: refreshTokenRow.family },
        data: { revokedAt: new Date() },
      });
      throw Object.assign(new Error("Refresh token already used"), { status: 401 });
    }

    if (refreshTokenRow.expiresAt < new Date()) {
      throw Object.assign(new Error("Refresh token expired"), { status: 401 });
    }

    const user = refreshTokenRow.user;
    if (user.status === "INACTIVE") {
      throw Object.assign(new Error("User is inactive"), { status: 401 });
    }

    const { token: newRawRefreshToken, tokenHash: newTokenHash } = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    const newRefreshTokenRow = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        family: refreshTokenRow.family,
        expiresAt: newExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    await prisma.refreshToken.update({
      where: { id: refreshTokenRow.id },
      data: {
        replacedByTokenId: newRefreshTokenRow.id,
        revokedAt: new Date(),
      },
    });

    const accessToken = signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const { passwordHash: _, ...safeUser } = user;
    return { accessToken, refreshToken: newRawRefreshToken, user: safeUser };
  },

  async logout(rawToken?: string) {
    if (!rawToken) {
      return;
    }

    const tokenHash = hashRefreshToken(rawToken);
    const refreshTokenRow = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!refreshTokenRow) {
      return;
    }

    await prisma.refreshToken.updateMany({
      where: { family: refreshTokenRow.family },
      data: { revokedAt: new Date() },
    });
  },
};
