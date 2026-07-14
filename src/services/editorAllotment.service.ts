import { env } from "../config/env";
import { parseArrayLenient } from "../utils/externalApi";
import { externalEditorAllotmentSchema, type ExternalEditorAllotment } from "../schemas/editorAllotment.schemas";

// Read-only, unlike photographerAllotment.service.ts's fetch+apply pair —
// Editing isn't a Yes/No routing stage, it's a plain form-fill, so there's no
// auto-advance to drive here. This just backs the "Editor Assigned" auto-fill
// on the Editing form by cross-referencing local jobs against this feed by
// jobId (matching handled client-side, same as usePhotographerAllotmentMatches).
export const editorAllotmentService = {
  async fetchCreatedBetween(fromDate: string, toDate: string): Promise<ExternalEditorAllotment[]> {
    const url = new URL("/api/public/editor-allotments", env.VSNAPU_JOB_MASTER_BASE_URL);
    url.searchParams.set("fromDate", fromDate);
    url.searchParams.set("toDate", toDate);
    url.searchParams.set("fromTime", "00:00");
    url.searchParams.set("toTime", "23:59");

    const response = await fetch(url);
    if (!response.ok) {
      throw Object.assign(
        new Error(`vsnapu Editor Allotments API returned ${response.status}`),
        { status: 502 }
      );
    }

    const raw: unknown = await response.json();
    return parseArrayLenient(externalEditorAllotmentSchema, raw, "Editor Allotments feed");
  },
};
