import rateLimit from "express-rate-limit";
import { sendError } from "../utils/apiResponse";
import type { Request, Response } from "express";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Many staff can share one office/NAT IP (express-rate-limit keys by IP by
  // default) — a low ceiling here means one person's typos lock out
  // everyone else behind the same IP. Raised from 10 to give real shared-IP
  // usage headroom while still bounding brute-force attempts.
  max: 30,
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

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many refresh attempts, please try again later",
  standardHeaders: false,
  skip: (req: Request) => req.method !== "POST",
  handler: (_req: Request, res: Response) => {
    sendError(res, "Too many refresh attempts, please try again later", 429);
  },
});
