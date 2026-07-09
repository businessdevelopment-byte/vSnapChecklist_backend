import { env } from "../config/env";
import { parseArrayLenient } from "../utils/externalApi";
import {
  externalPhotographerAllotmentSchema,
  type ExternalPhotographerAllotment,
} from "../schemas/photographerAllotment.schemas";

export const photographerAllotmentService = {
  async fetchCreatedBetween(fromDate: string, toDate: string): Promise<ExternalPhotographerAllotment[]> {
    const url = new URL("/api/public/photographer-allotments", env.VSNAPU_JOB_MASTER_BASE_URL);
    url.searchParams.set("fromDate", fromDate);
    url.searchParams.set("toDate", toDate);
    url.searchParams.set("fromTime", "00:00");
    url.searchParams.set("toTime", "23:59");

    const response = await fetch(url);
    if (!response.ok) {
      throw Object.assign(
        new Error(`vsnapu Photographer Allotments API returned ${response.status}`),
        { status: 502 }
      );
    }

    const raw: unknown = await response.json();
    return parseArrayLenient(externalPhotographerAllotmentSchema, raw, "Photographer Allotments feed");
  },
};
