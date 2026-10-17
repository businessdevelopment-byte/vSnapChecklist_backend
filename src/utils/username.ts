import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database";

// Usernames are real names ("Devraj Sahu") imported from spreadsheets, so
// they carry spaces. NFKC turns look-alike characters such as non-breaking
// spaces into plain ones, then any run of whitespace collapses to one space.
export function normalizeUsername(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

// Exact match first; otherwise a case-insensitive match, used only when it
// is unambiguous (two accounts differing only by case resolve to neither).
export async function findUserByUsername<T extends Prisma.UserSelect>(
  raw: string,
  select: T
) {
  const username = normalizeUsername(raw);
  if (!username) return null;

  const exact = await prisma.user.findUnique({ where: { username }, select });
  if (exact) return exact;

  const matches = await prisma.user.findMany({
    where: { username: { equals: username, mode: "insensitive" } },
    select,
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
}
