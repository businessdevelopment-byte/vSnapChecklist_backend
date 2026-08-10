import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { signAccessToken } from "../utils/jwt";
import { generateRefreshToken, hashRefreshToken } from "../utils/refreshToken";
import { env } from "../config/env";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas";
import crypto from "crypto";

// A refresh token presented again shortly after it was rotated is almost
// always a second browser tab racing to refresh with the same (now-stale)
// cookie — not real token theft. This app has many sections open across
// several tabs at once by design (see DashboardLayout's sidebar), so this
// race is routine, not an edge case. Reuse *outside* this window (or of a
// token revoked for a reason other than rotation, e.g. logout) is still
// treated as a real attack. See docs/migration/DECISIONS.md.
const REUSE_GRACE_PERIOD_MS = 30 * 1000;

const refreshTokenWithUserArgs = Prisma.validator<Prisma.RefreshTokenDefaultArgs>()({
  include: { user: { include: { department: { select: { id: true, name: true } } } } },
});
type RefreshTokenWithUser = Prisma.RefreshTokenGetPayload<typeof refreshTokenWithUserArgs>;

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

    // Bootstrap: if the system has zero admins, the next signup becomes one
    // regardless of what was requested — guarantees a fresh system always
    // gets an admin even if the caller forgets to ask for one. Once any
    // admin exists, the client-requested role (input.role, defaults to
    // "USER" — see registerSchema) is honored as-is.
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    const role = adminCount === 0 ? "ADMIN" : input.role;

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        email: input.email ?? null,
        departmentId: input.departmentId ?? null,
        role,
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
      // Only a token revoked *by being rotated* (replacedByTokenId set) is
      // eligible for the grace-period carve-out below — a token revoked for
      // any other reason (explicit logout, or a prior real reuse-detection
      // event sweeping the whole family) must fail immediately, same as
      // before.
      const isRotationReuse =
        refreshTokenRow.replacedByTokenId != null &&
        Date.now() - refreshTokenRow.revokedAt.getTime() < REUSE_GRACE_PERIOD_MS;

      if (isRotationReuse) {
        const current = await this.walkToChainTip(refreshTokenRow.replacedByTokenId!);
        if (current && !current.revokedAt && current.expiresAt > new Date() && current.user.status !== "INACTIVE") {
          return this.rotateFrom(current, ipAddress, userAgent);
        }
      }

      await prisma.refreshToken.updateMany({
        where: { family: refreshTokenRow.family },
        data: { revokedAt: new Date() },
      });
      throw Object.assign(new Error("Refresh token revoked (token family revoked due to reuse detection)"), { status: 401 });
    }

    if (refreshTokenRow.expiresAt < new Date()) {
      throw Object.assign(new Error("Refresh token expired"), { status: 401 });
    }

    const user = refreshTokenRow.user;
    if (user.status === "INACTIVE") {
      throw Object.assign(new Error("User is inactive"), { status: 401 });
    }

    return this.rotateFrom(refreshTokenRow, ipAddress, userAgent);
  },

  // Follows replacedByTokenId pointers to the current tip of a rotation
  // chain, bounded to guard against a pathological/corrupt chain — normal
  // multi-tab racing only ever needs 1-2 hops.
  async walkToChainTip(startId: number): Promise<RefreshTokenWithUser | null> {
    let current = await prisma.refreshToken.findUnique({
      where: { id: startId },
      ...refreshTokenWithUserArgs,
    });
    for (let hops = 0; current?.replacedByTokenId != null && hops < 5; hops++) {
      current = await prisma.refreshToken.findUnique({
        where: { id: current.replacedByTokenId },
        ...refreshTokenWithUserArgs,
      });
    }
    return current;
  },

  // Rotates a still-valid token row into a fresh one. Shared by the normal
  // refresh path and the grace-period path (a 2nd tab racing to refresh with
  // an already-rotated cookie, which rotates forward from the chain's
  // current tip instead of duplicating this logic).
  async rotateFrom(tokenRow: RefreshTokenWithUser, ipAddress?: string, userAgent?: string) {
    const { token: newRawRefreshToken, tokenHash: newTokenHash } = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    const newRefreshTokenRow = await prisma.refreshToken.create({
      data: {
        userId: tokenRow.user.id,
        tokenHash: newTokenHash,
        family: tokenRow.family,
        expiresAt: newExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    await prisma.refreshToken.update({
      where: { id: tokenRow.id },
      data: {
        replacedByTokenId: newRefreshTokenRow.id,
        revokedAt: new Date(),
      },
    });

    const accessToken = signAccessToken({
      userId: tokenRow.user.id,
      username: tokenRow.user.username,
      role: tokenRow.user.role,
    });

    const { passwordHash: _, ...safeUser } = tokenRow.user;
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
