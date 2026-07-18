import { z } from "zod";

// External vsnapu feeds occasionally include records with blank required-ish
// fields (see docs/migration/DECISIONS.md). A single malformed record
// shouldn't fail the whole batch — skip it and log instead.
export function parseArrayLenient<T>(schema: z.ZodType<T>, raw: unknown, label: string): T[] {
  if (!Array.isArray(raw)) {
    throw Object.assign(new Error(`${label}: expected an array from external API`), { status: 502 });
  }

  const parsed: T[] = [];
  let skipped = 0;
  for (const item of raw) {
    const result = schema.safeParse(item);
    if (result.success) {
      parsed.push(result.data);
    } else {
      skipped++;
    }
  }

  if (skipped > 0) {
    console.warn(`${label}: skipped ${skipped}/${raw.length} malformed record(s)`);
  }

  return parsed;
}
