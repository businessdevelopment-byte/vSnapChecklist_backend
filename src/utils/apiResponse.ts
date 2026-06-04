import { Response } from "express";

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = "Success",
  status = 200
): void => {
  res.status(status).json({ success: true, data, message });
};

export const sendPaginated = (
  res: Response,
  result: Record<string, unknown>,
  message = "Success"
): void => {
  res.status(200).json({ success: true, ...result, message });
};

export const sendError = (
  res: Response,
  message: string,
  status = 400,
  errors?: unknown
): void => {
  res.status(status).json({ success: false, message, errors });
};
