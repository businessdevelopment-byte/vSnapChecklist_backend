import type { SheetTable } from "./sheetSyncRows";

// Talks to the Apps Script web app in the target sheet
// (scripts/sheet-sync/Code.gs). One table is pushed as:
//   begin  — checks the tab's header row and records this run's id
//   write  — rows at fixed positions (row 2 + offset), managed columns only
//   finish — clears everything below the last row, applies date formats
// Every call is idempotent, so a retried chunk can't duplicate rows.

export const CHUNK_ROWS = 2000;
const CALL_TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

export class SheetSyncError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

interface ScriptReply {
  ok: boolean;
  error?: string;
  retryable?: boolean;
  projectedCells?: number;
  written?: number;
  cleared?: number;
}

export interface PushResult {
  rows: number;
  projectedCells: number;
}

interface ClientConfig {
  url: string;
  secret: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOnce(config: ClientConfig, body: Record<string, unknown>): Promise<ScriptReply> {
  let response: Response;
  try {
    // Apps Script answers a POST with a redirect to its result; fetch follows
    // it with a GET, which is what Google expects.
    response = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, secret: config.secret }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (err) {
    throw new SheetSyncError(`Couldn't reach the sheet's Apps Script (${(err as Error).message})`, true);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/json")) {
    // A deployment that's gone or not shared as "Anyone" answers with an HTML page.
    const retryable = response.status >= 500 || response.status === 429;
    throw new SheetSyncError(
      `The sheet's Apps Script answered ${response.status} ${contentType || "(no content type)"} — check SHEET_SYNC_URL and that the web app is deployed for "Anyone".`,
      retryable
    );
  }

  const reply = (await response.json()) as ScriptReply;
  if (!reply.ok) {
    throw new SheetSyncError(reply.error ?? "The sheet's Apps Script reported an error", reply.retryable === true);
  }
  return reply;
}

async function call(config: ClientConfig, body: Record<string, unknown>): Promise<ScriptReply> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callOnce(config, body);
    } catch (err) {
      const retryable = err instanceof SheetSyncError && err.retryable;
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

// Replaces the tab's data rows with `table.rows`.
export async function pushTable(config: ClientConfig, runId: string, table: SheetTable): Promise<PushResult> {
  const base = { runId, tab: table.tab, headers: table.headers, types: table.types };
  const totalRows = table.rows.length;

  const begun = await call(config, { ...base, action: "begin", totalRows });

  for (let offset = 0; offset < totalRows; offset += CHUNK_ROWS) {
    await call(config, { ...base, action: "write", offset, rows: table.rows.slice(offset, offset + CHUNK_ROWS) });
  }

  await call(config, { ...base, action: "finish", totalRows });
  return { rows: totalRows, projectedCells: begun.projectedCells ?? 0 };
}
