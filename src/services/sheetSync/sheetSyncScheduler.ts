import { env } from "../../config/env";
import { isSheetSyncConfigured, isSheetSyncEnabled, sheetSyncService } from "./sheetSync.service";
import { lastScheduledAt, nextRunAt } from "./sheetSyncTime";

// In-process nightly timer (production runs a single PM2 instance). If the
// server was down or restarting at the scheduled time, a catch-up run starts
// shortly after startup.
const CATCH_UP_DELAY_MS = 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let catchUpTimer: NodeJS.Timeout | null = null;

function arm(): void {
  const at = nextRunAt(env.SHEET_SYNC_TIME);
  timer = setTimeout(async () => {
    try {
      await sheetSyncService.runAndWait("SCHEDULED");
    } catch (err) {
      console.error(`[sheetSync] scheduled run failed: ${(err as Error).message}`);
    } finally {
      arm();
    }
  }, at.getTime() - Date.now());
  timer.unref();
  console.log(`[sheetSync] next sync ${at.toISOString()} (${env.SHEET_SYNC_TIME} IST)`);
}

async function catchUpIfMissed(): Promise<void> {
  await sheetSyncService.markStaleRuns();
  const lastSuccess = await sheetSyncService.latestSuccessAt();
  const due = lastScheduledAt(env.SHEET_SYNC_TIME);
  if (lastSuccess && lastSuccess >= due) return;

  console.log("[sheetSync] no successful sync since the last scheduled time — catching up shortly");
  catchUpTimer = setTimeout(() => {
    sheetSyncService.runAndWait("CATCH_UP").catch((err: Error) => {
      console.error(`[sheetSync] catch-up run failed: ${err.message}`);
    });
  }, CATCH_UP_DELAY_MS);
  catchUpTimer.unref();
}

export const sheetSyncScheduler = {
  start(): void {
    if (!isSheetSyncConfigured()) {
      console.log("[sheetSync] disabled — SHEET_SYNC_URL / SHEET_SYNC_SECRET not set");
      return;
    }
    if (!isSheetSyncEnabled()) {
      console.log("[sheetSync] disabled — SHEET_SYNC_ENABLED=false");
      return;
    }
    arm();
    catchUpIfMissed().catch((err: Error) => {
      console.error(`[sheetSync] catch-up check failed: ${err.message}`);
    });
  },

  stop(): void {
    if (timer) clearTimeout(timer);
    if (catchUpTimer) clearTimeout(catchUpTimer);
    timer = null;
    catchUpTimer = null;
  },
};
