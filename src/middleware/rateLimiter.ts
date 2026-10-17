import rateLimit from "express-rate-limit";
import { sendError } from "../utils/apiResponse";
import { hashRefreshToken } from "../utils/refreshToken";
import { normalizeUsername } from "../utils/username";
import type { Request, Response } from "express";

// Not keyed by IP: every request reaches this server through the Next.js
// /api rewrite proxy (plus IIS in production), so req.ip is the proxy's
// address for the whole company — an IP key made all staff share one bucket,
// and once it filled every login was refused. Keyed per account instead, and
// only failed attempts count, so password guessing on one account is still
// bounded without one person's typos locking out everyone else.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const raw = typeof req.body?.username === "string" ? req.body.username : "";
    return `login:${normalizeUsername(raw).toLowerCase()}`;
  },
  message: "Too many login attempts, please try again later",
  standardHeaders: false,
  skip: (req: Request) => req.method !== "POST",
  handler: (_req: Request, res: Response) => {
    sendError(res, "Too many login attempts, please try again later", 429);
  },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many registration attempts, please try again later",
  standardHeaders: false,
  skip: (req: Request) => req.method !== "POST",
  handler: (_req: Request, res: Response) => {
    sendError(res, "Too many registration attempts, please try again later", 429);
  },
});

// Per session (refresh token), not per IP — same shared-proxy-IP reason as
// loginLimiter; a shared bucket here logged random users out company-wide.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req: Request) => {
    const token = req.cookies?.refreshToken;
    return typeof token === "string" && token ? `refresh:${hashRefreshToken(token)}` : `refresh-ip:${req.ip}`;
  },
  message: "Too many refresh attempts, please try again later",
  standardHeaders: false,
  skip: (req: Request) => req.method !== "POST",
  handler: (_req: Request, res: Response) => {
    sendError(res, "Too many refresh attempts, please try again later", 429);
  },
});
