import { env } from "../config/env";
import { parseArrayLenient } from "../utils/externalApi";
import { externalEditingHoursPerJobSchema, type ExternalEditingHoursPerJob } from "../schemas/editingHoursPerJob.schemas";

// Read-only, same shape as editorAllotment.service.ts/rawDataQc.service.ts —
// backs the "QC Rating (Avg)" auto-fill on Editing QC by cross-referencing
// local jobs against this feed by jobId (matching handled client-side, same
// as useEditorAllotmentMatches/useRawDataQcMatches).
export const editingHoursPerJobService = {
  async fetchCreatedBetween(fromDate: string, toDate: string): Promise<ExternalEditingHoursPerJob[]> {
    const url = new URL("/api/public/editing-hours-per-job", env.VSNAPU_JOB_MASTER_BASE_URL);
    url.searchParams.set("fromDate", fromDate);
    url.searchParams.set("toDate", toDate);
    url.searchParams.set("fromTime", "00:00");
    url.searchParams.set("toTime", "23:59");

    const response = await fetch(url);
    if (!response.ok) {
      throw Object.assign(
        new Error(`vsnapu Editing Hours Per Job API returned ${response.status}`),
        { status: 502 }
      );
    }

    const raw: unknown = await response.json();
    return parseArrayLenient(externalEditingHoursPerJobSchema, raw, "Editing Hours Per Job feed");
  },
};
