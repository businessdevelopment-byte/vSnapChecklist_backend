import { env } from "../config/env";
import { parseArrayLenient } from "../utils/externalApi";
import { externalRawDataQcSchema, type ExternalRawDataQc } from "../schemas/rawDataQc.schemas";

// Read-only, same shape as editorAllotment.service.ts — backs the "Creative
// team Feedback Rating (Avg)" auto-fill on Data Quality Check by
// cross-referencing local jobs against this feed by jobId (matching handled
// client-side, same as useEditorAllotmentMatches).
export const rawDataQcService = {
  async fetchCreatedBetween(fromDate: string, toDate: string): Promise<ExternalRawDataQc[]> {
    const url = new URL("/api/public/raw-data-qc", env.VSNAPU_JOB_MASTER_BASE_URL);
    url.searchParams.set("fromDate", fromDate);
    url.searchParams.set("toDate", toDate);
    url.searchParams.set("fromTime", "00:00");
    url.searchParams.set("toTime", "23:59");

    const response = await fetch(url);
    if (!response.ok) {
      throw Object.assign(
        new Error(`vsnapu Raw Data QC API returned ${response.status}`),
        { status: 502 }
      );
    }

    const raw: unknown = await response.json();
    return parseArrayLenient(externalRawDataQcSchema, raw, "Raw Data QC feed");
  },
};
