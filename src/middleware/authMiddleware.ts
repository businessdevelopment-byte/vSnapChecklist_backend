import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyToken } from "../utils/jwt";
import { sendError } from "../utils/apiResponse";

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

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(res, "Access token expired", 401, { code: "TOKEN_EXPIRED" });
    } else {
      sendError(res, "Unauthorized — invalid token", 401);
    }
  }
};
