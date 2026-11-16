import { Prisma } from "@prisma/client";

// True when the write hit a unique constraint. Used where the database, not
// application code, decides a race (e.g. one video attached to two tasks).
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
