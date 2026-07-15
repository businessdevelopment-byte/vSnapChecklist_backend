import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

export const signAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};

// Legacy exports for backwards compatibility
export const signToken = signAccessToken;
export const verifyToken = verifyAccessToken;
