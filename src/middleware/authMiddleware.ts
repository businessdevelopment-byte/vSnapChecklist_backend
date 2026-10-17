import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
import { verifyToken } from "../utils/jwt";
import { sendError } from "../utils/apiResponse";
import { clearAuthCookies } from "../utils/authCookies";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        username: string;
        role: string;
      };
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  // Browser requests carry the access token as an httpOnly cookie; a Bearer
  // header (non-browser API client) takes precedence if both are present.
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : req.cookies?.accessToken;

  if (!token) {
    sendError(res, "Unauthorized — missing token", 401);
    return;
  }

  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(res, "Access token expired", 401, { code: "TOKEN_EXPIRED" });
    } else {
      sendError(res, "Unauthorized — invalid token", 401);
    }
    return;
  }

  // A valid JWT alone isn't enough: a user deleted or deactivated from
  // Settings → Manage Users must lose access on their very next request, not
  // when the token expires (up to JWT_ACCESS_EXPIRES_IN later). Role comes
  // from the DB for the same reason — a demotion applies immediately.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { username: true, role: true, status: true },
  });
  if (!user || user.status === "INACTIVE") {
    clearAuthCookies(res);
    sendError(res, "Your account has been removed or deactivated", 401, { code: "ACCOUNT_REMOVED" });
    return;
  }

  req.user = { userId: payload.userId, username: user.username, role: user.role };
  next();
};
