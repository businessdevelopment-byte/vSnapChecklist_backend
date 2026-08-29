import { Response } from "express";
import { ZodError } from "zod";

// Turns a batch-import array schema's ZodError into one readable line per failing
// row (path[0] is the array index, path[1] the field name) instead of the raw
// issues array — used by /templates/import and /delegation/import.
export const formatZodRowErrors = (err: ZodError): string[] =>
  err.issues.map((issue) => {
    const rowIndex = typeof issue.path[0] === "number" ? issue.path[0] + 1 : "?";
    const field = issue.path[1];
    return `Row ${rowIndex}${field ? ` (${field})` : ""}: ${issue.message}`;
  });

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
