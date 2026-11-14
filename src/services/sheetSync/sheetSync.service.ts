import { randomUUID } from "crypto";
import type { SheetSyncTrigger } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { checklistService } from "../checklist.service";
import { buildChecklistTable, buildDelegationTable } from "./sheetSyncRows";
import { pushTable, SheetSyncError } from "./sheetSyncClient";
import { istToday, nextRunAt } from "./sheetSyncTime";

// Nightly mirror of Checklist & Delegation into the Google Sheet. Every run
// rebuilds both tabs from the current DB (see DECISIONS.md, 2026-11-14), so
// edits, deletes and transfers show up without change-tracking and no row can
// ever be duplicated. The sheet is output only — nothing is read back.

export const SHEET_CELL_LIMIT = 10_000_000;
export const SHEET_CELL_WARN_RATIO = 0.8;
// A run still RUNNING after this long was cut off by a restart or crash.
const STALE_RUN_MS = 30 * 60 * 1000;
// Any constant unique to this job; Postgres advisory locks are keyed by number.
const ADVISORY_LOCK_KEY = 7_421_001;
// Holds the lock's transaction open for the whole run.
const RUN_TIMEOUT_MS = 30 * 60 * 1000;
const ERROR_MAX_LENGTH = 1000;

export function isSheetSyncConfigured(): boolean {
  return Boolean(env.SHEET_SYNC_URL && env.SHEET_SYNC_SECRET);
}

export function isSheetSyncEnabled(): boolean {
  return isSheetSyncConfigured() && env.SHEET_SYNC_ENABLED;
}

export function sheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(env.SHEET_SYNC_SPREADSHEET_ID)}/edit`;
}

function conflict(message: string): Error {
  return Object.assign(new Error(message), { status: 409 });
}

// In this process; the advisory lock covers other processes.
let currentRun: Promise<void> | null = null;

async function markStaleRuns(): Promise<void> {
  await prisma.sheetSyncRun.updateMany({
    where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    data: { status: "FAILED", finishedAt: new Date(), error: "Interrupted (the server restarted or crashed during the sync)" },
  });
}

async function syncTables(runId: number): Promise<void> {
  const config = { url: env.SHEET_SYNC_URL!, secret: env.SHEET_SYNC_SECRET! };
  const scriptRunId = `${runId}-${randomUUID()}`;

  // Bring the DB up to date for today first: rows are only generated when the
  // app is read, and a nightly sync must include today's tasks for everyone
  // even if nobody opened the app (it also refills missed days, 30 back).
  await checklistService.reconcileExpiredTransfers();
  await checklistService.materializeAllActive(istToday());

  const errors: string[] = [];
  const result: { checklistRows?: number; delegationRows?: number; sheetCells?: number } = {};

  // The tabs are independent: one failing doesn't stop the other.
  try {
    const table = await buildChecklistTable(env.SHEET_SYNC_CHECKLIST_TAB);
    const pushed = await pushTable(config, scriptRunId, table);
    result.checklistRows = pushed.rows;
    result.sheetCells = pushed.projectedCells;
  } catch (err) {
    errors.push(`Checklist: ${(err as Error).message}`);
  }

  try {
    const table = await buildDelegationTable(env.SHEET_SYNC_DELEGATION_TAB);
    const pushed = await pushTable(config, scriptRunId, table);
    result.delegationRows = pushed.rows;
    result.sheetCells = Math.max(result.sheetCells ?? 0, pushed.projectedCells);
  } catch (err) {
    errors.push(`Delegation: ${(err as Error).message}`);
  }

  await prisma.sheetSyncRun.update({
    where: { id: runId },
    data: {
      ...result,
      status: errors.length ? "FAILED" : "SUCCESS",
      finishedAt: new Date(),
      error: errors.length ? errors.join(" | ").slice(0, ERROR_MAX_LENGTH) : null,
    },
  });
}

export const sheetSyncService = {
  // Starts a run and resolves with its id once it has the lock; the run itself
  // carries on in the background. Rejects (409) when one is already going.
  async startRun(trigger: SheetSyncTrigger, triggeredByUserId?: number): Promise<number> {
    if (!isSheetSyncConfigured()) {
      throw Object.assign(new Error("Google Sheet sync isn't set up: SHEET_SYNC_URL and SHEET_SYNC_SECRET are missing in the backend .env"), { status: 400 });
    }
    // Registered synchronously, before any await, so two clicks at the same
    // moment can't both get past this check.
    if (currentRun) throw conflict("A sync is already running");

    let resolveStarted!: (id: number) => void;
    let rejectStarted!: (err: Error) => void;
    const started = new Promise<number>((resolve, reject) => {
      resolveStarted = resolve;
      rejectStarted = reject;
    });

    const run = (async () => {
      await markStaleRuns();
      await prisma.$transaction(
        async (tx) => {
          // A transaction-scoped lock is released however the run ends, even on
          // a pooled connection, and keeps a second server out too.
          const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS locked`;
          if (!locked) throw conflict("A sync is already running");

          const row = await prisma.sheetSyncRun.create({
            data: { trigger, triggeredByUserId: triggeredByUserId ?? null },
            select: { id: true },
          });
          resolveStarted(row.id);

          try {
            await syncTables(row.id);
          } catch (err) {
            await prisma.sheetSyncRun.update({
              where: { id: row.id },
              data: { status: "FAILED", finishedAt: new Date(), error: (err as Error).message.slice(0, ERROR_MAX_LENGTH) },
            });
          }
        },
        { timeout: RUN_TIMEOUT_MS, maxWait: 10_000 }
      );
    })()
      .catch((err: Error) => {
        // Only reached before the run row exists (lock taken, DB down).
        rejectStarted(err);
        if ((err as { status?: number }).status !== 409) {
          console.error(`[sheetSync] ${trigger} run failed to start: ${err.message}`);
        }
      })
      .finally(() => {
        currentRun = null;
      });

    currentRun = run;
    return started;
  },

  // Runs to completion — for the scheduler, which has nobody to report to.
  async runAndWait(trigger: SheetSyncTrigger): Promise<void> {
    try {
      await this.startRun(trigger);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        console.warn(`[sheetSync] ${trigger} run skipped: another sync is running`);
        return;
      }
      throw err;
    }
    await currentRun;
  },

  async latestSuccessAt(): Promise<Date | null> {
    const last = await prisma.sheetSyncRun.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });
    return last?.startedAt ?? null;
  },

  markStaleRuns,

  async getStatus() {
    await markStaleRuns();
    const runs = await prisma.sheetSyncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        trigger: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        checklistRows: true,
        delegationRows: true,
        sheetCells: true,
        error: true,
        triggeredBy: { select: { username: true } },
      },
    });
    const lastCells = runs.find((r) => r.sheetCells != null)?.sheetCells ?? null;

    return {
      configured: isSheetSyncConfigured(),
      enabled: isSheetSyncEnabled(),
      scheduleTime: env.SHEET_SYNC_TIME,
      timeZone: "Asia/Kolkata",
      nextRunAt: isSheetSyncEnabled() ? nextRunAt(env.SHEET_SYNC_TIME).toISOString() : null,
      isRunning: currentRun !== null || runs.some((r) => r.status === "RUNNING"),
      sheetUrl: sheetUrl(),
      checklistTab: env.SHEET_SYNC_CHECKLIST_TAB,
      delegationTab: env.SHEET_SYNC_DELEGATION_TAB,
      sheetCells: lastCells,
      cellLimit: SHEET_CELL_LIMIT,
      nearCellLimit: lastCells != null && lastCells >= SHEET_CELL_LIMIT * SHEET_CELL_WARN_RATIO,
      runs: runs.map((r) => ({
        id: r.id,
        trigger: r.trigger,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        checklistRows: r.checklistRows,
        delegationRows: r.delegationRows,
        error: r.error,
        triggeredBy: r.triggeredBy?.username ?? null,
      })),
    };
  },
};

export { SheetSyncError };
