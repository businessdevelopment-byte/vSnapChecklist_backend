import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { parseCsv } from "../../utils/csv";
import { normalizeUsername } from "../../utils/username";

// The "For Records" tab of the legacy MIS Google Sheet ("New Mis Summary V.01"):
// this week's numbers per person, calculated inside the sheet from its Data tab
// (12 FMS systems, most of which this app doesn't track).
//
// READ-ONLY, from one of two sources:
//   1. The sheet's own Apps Script web app (MIS_APPS_SCRIPT_URL), with exactly
//      the request the old MIS dashboard makes on every load:
//      GET <url>?sheet=For Records → { success, data: any[][] }.
//   2. If that URL isn't set or the call fails: the tab's CSV export through
//      the sheet's "Anyone with the link can view" sharing.
// Nothing is ever written back and no other script action is called, so the
// sheet's formulas and its Apps Script keep working exactly as before. Only
// "For Records" is requested: never master1/Master, which hold passwords.

// Fixed A…V layout of the tab. Columns are read by position because two
// header labels change with the sheet's "Negative" setting (Report!H1/L1):
// "% Work Not Done" ↔ "Work Done %". The UI shows whatever label the sheet has.
// date / percentDecimals: how the sheet displays the column, used to turn the
// Apps Script's raw values into the same text the CSV export gives.
export const MIS_SHEET_COLUMNS = [
  { key: "dateStart", header: "Date Start", numeric: false, date: true },
  { key: "dateEnd", header: "Date End", numeric: false, date: true },
  { key: "name", header: "Name", numeric: false },
  { key: "planned", header: "Current Week Planned", numeric: true },
  { key: "actual", header: "Current Week Actual", numeric: true },
  { key: "actualPct", header: "Curent Week Actual %", numeric: true, percentDecimals: 1 },
  { key: "notDonePct", header: "% Work Not Done", numeric: true, percentDecimals: 1 },
  { key: "notDoneOnTimePct", header: "Work Not Done On Time %", numeric: true, percentDecimals: 2 },
  { key: "allPending", header: "All Pending Till Week End", numeric: true },
  { key: "notDone", header: "Work Not Done", numeric: true },
  { key: "doneOnTime", header: "Work Done On Time", numeric: true },
  { key: "notDoneOnTime", header: "Work Not Done On Time", numeric: true },
  { key: "nextWeekStart", header: "Start Date", numeric: false, date: true },
  { key: "nextWeekEnd", header: "End Date", numeric: false, date: true },
  { key: "lastWeekPlanned", header: "Last Week Planned", numeric: true },
  { key: "lastWeekActual", header: "Last Week Actual Done", numeric: true },
  { key: "commitment", header: "Week Commitment", numeric: false },
  { key: "nextWeekPlanned", header: "Next Week Planned", numeric: true },
  { key: "nextWeekActual", header: "Next Week Actual", numeric: true },
  { key: "nextCommitment", header: "Next Week Commitment", numeric: false },
  { key: "imageLink", header: "Image Link", numeric: false },
  { key: "gmail", header: "G-mail", numeric: false },
] as const;

type SheetColumnDef = (typeof MIS_SHEET_COLUMNS)[number] & { date?: boolean; percentDecimals?: number };

export type MisSheetColumnKey = (typeof MIS_SHEET_COLUMNS)[number]["key"];

export interface MisSheetColumn {
  key: MisSheetColumnKey;
  label: string;
  // Merged band over the column in row 1 ("Last Week Commitment" over O–Q,
  // "Next Week Commitment" over R–T); null elsewhere.
  group: string | null;
  numeric: boolean;
}

// Values exactly as the sheet displays them ("57.4%", "2-Nov-2026", "").
export type MisSheetRow = Record<MisSheetColumnKey, string>;

export type MisSheetSource = "apps-script" | "csv-export";

export interface MisSheetForRecords {
  title: string;
  columns: MisSheetColumn[];
  rows: MisSheetRow[];
  fetchedAt: string;
  source: MisSheetSource;
}

// A sheet row plus the app account whose username matches its Name (case and
// extra spaces ignored); null when none, or when two accounts would match.
export type MisSheetPersonRow = MisSheetRow & { userId: number | null };

export interface MisSheetForRecordsView extends Omit<MisSheetForRecords, "rows"> {
  rows: MisSheetPersonRow[];
  sheetUrl: string | null;
}

const nameKey = (name: string) => normalizeUsername(name).toLowerCase();

// Done per request rather than cached with the sheet, so a new or renamed
// account is matched straight away.
async function withAppUsers(rows: MisSheetRow[]): Promise<MisSheetPersonRow[]> {
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const idByName = new Map<string, number | null>();
  for (const user of users) {
    const key = nameKey(user.username);
    idByName.set(key, idByName.has(key) ? null : user.id);
  }
  return rows.map((row) => ({ ...row, userId: idByName.get(nameKey(row.name)) ?? null }));
}

// Header cells sit in these columns; checked so a re-arranged tab fails loudly
// instead of putting numbers under the wrong headings.
const LAYOUT_CHECKS: [number, string][] = [
  [0, "date start"],
  [1, "date end"],
  [2, "name"],
  [3, "current week planned"],
];

// Row 1 bands: each covers 3 columns, as merged in the sheet.
const GROUP_SPAN = 3;

const CACHE_TTL_MS = 5 * 60 * 1000;
// A forced refresh within this window reuses the copy just fetched.
const MIN_REFRESH_GAP_MS = 10 * 1000;
const CSV_TIMEOUT_MS = 20 * 1000;
// The Apps Script typically answers in ~4–5 s.
const APPS_SCRIPT_TIMEOUT_MS = 30 * 1000;
const FOR_RECORDS_TAB = "For Records";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

let cache: { data: MisSheetForRecords; fetchedAtMs: number } | null = null;
let inFlight: Promise<MisSheetForRecords> | null = null;

const clean = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

function sheetError(message: string): Error {
  return Object.assign(new Error(message), { status: 502 });
}

function exportUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(env.MIS_SHEET_ID)}/export?format=csv&gid=${env.MIS_SHEET_FOR_RECORDS_GID}`;
}

// A sheet date arrives as the UTC instant of midnight in the sheet's time
// zone ("2026-11-01T18:30:00.000Z" = 2 Nov in IST). Adding 12 h lands inside
// that calendar day for any zone between UTC−12 and UTC+12, so no zone needs
// to be configured. Output matches the sheet's "2-Nov-2026".
function formatSheetDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 12 * 60 * 60 * 1000);
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

// Apps Script getValues() gives raw cells (numbers, fractions for %, ISO
// timestamps for dates); turn each into the text the sheet displays.
function toDisplayText(value: unknown, colIndex: number): string {
  if (value === null || value === undefined) return "";
  const col = MIS_SHEET_COLUMNS[colIndex] as SheetColumnDef | undefined;
  if (typeof value === "number") {
    if (col?.percentDecimals !== undefined) return `${(value * 100).toFixed(col.percentDecimals)}%`;
    return String(value);
  }
  const text = String(value);
  if (col?.date && ISO_TIMESTAMP.test(text)) return formatSheetDate(text);
  return text;
}

export function parseForRecordsGrid(
  grid: string[][],
  fetchedAt: Date,
  source: MisSheetSource
): MisSheetForRecords {
  const headerIndex = grid
    .slice(0, 6)
    .findIndex((r) => LAYOUT_CHECKS.every(([col, label]) => clean(r[col]).toLowerCase() === label));
  if (headerIndex === -1) {
    // Kept under 120 characters so the frontend shows it in full.
    throw sheetError("The sheet's \"For Records\" tab changed layout (expected Date Start, Date End, Name in columns A–C).");
  }

  const header = grid[headerIndex];
  const bandRow = headerIndex > 0 ? grid[headerIndex - 1] : [];

  const groups: (string | null)[] = MIS_SHEET_COLUMNS.map(() => null);
  bandRow.forEach((cell, i) => {
    const label = clean(cell);
    // Column A of the band row is the "Report From … To …" title, not a band.
    if (i === 0 || !label) return;
    for (let j = i; j < Math.min(i + GROUP_SPAN, groups.length); j++) groups[j] = label;
  });

  const columns: MisSheetColumn[] = MIS_SHEET_COLUMNS.map((col, i) => ({
    key: col.key,
    label: clean(header[i]) || col.header,
    group: groups[i],
    numeric: col.numeric,
  }));

  const rows: MisSheetRow[] = grid
    .slice(headerIndex + 1)
    // The tab pre-fills % columns far below the last person; a row counts only
    // when it has a name.
    .filter((r) => clean(r[2]) !== "")
    .map((r) => {
      const row = {} as MisSheetRow;
      MIS_SHEET_COLUMNS.forEach((col, i) => {
        row[col.key] = clean(r[i]);
      });
      return row;
    });

  return {
    title: clean(bandRow[0]),
    columns,
    rows,
    fetchedAt: fetchedAt.toISOString(),
    source,
  };
}

export function parseForRecordsCsv(text: string, fetchedAt: Date): MisSheetForRecords {
  return parseForRecordsGrid(parseCsv(text), fetchedAt, "csv-export");
}

export function parseForRecordsAppsScript(body: unknown, fetchedAt: Date): MisSheetForRecords {
  const payload = body as { success?: unknown; data?: unknown } | null;
  if (!payload || payload.success !== true || !Array.isArray(payload.data)) {
    throw sheetError("The MIS Apps Script didn't return the For Records data.");
  }
  const grid = payload.data.map((row) =>
    Array.isArray(row) ? row.map((cell, i) => toDisplayText(cell, i)) : []
  );
  return parseForRecordsGrid(grid, fetchedAt, "apps-script");
}

async function downloadFromAppsScript(scriptUrl: string): Promise<MisSheetForRecords> {
  const url = new URL(scriptUrl);
  url.searchParams.set("sheet", FOR_RECORDS_TAB);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(APPS_SCRIPT_TIMEOUT_MS) });
  } catch {
    throw sheetError("Couldn't reach the MIS Apps Script.");
  }
  // A script that isn't deployed for "Anyone" answers with a Google sign-in
  // page (HTML), not an error status.
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/json")) {
    throw sheetError(`The MIS Apps Script answered ${response.status} ${contentType || "(no content type)"}.`);
  }
  return parseForRecordsAppsScript(await response.json(), new Date());
}

async function downloadCsv(): Promise<MisSheetForRecords> {
  let response: Response;
  try {
    response = await fetch(exportUrl(), { signal: AbortSignal.timeout(CSV_TIMEOUT_MS) });
  } catch {
    throw sheetError("Couldn't reach Google Sheets to read the MIS sheet. Try Refresh in a moment.");
  }
  // A sheet that is no longer link-shared answers with Google's sign-in page
  // (HTML, often 200), not an error status.
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("text/csv")) {
    throw sheetError(
      "Couldn't read the MIS Google Sheet. It must stay shared as \"Anyone with the link can view\"."
    );
  }
  return parseForRecordsCsv(await response.text(), new Date());
}

async function download(): Promise<MisSheetForRecords> {
  if (env.MIS_APPS_SCRIPT_URL) {
    try {
      return await downloadFromAppsScript(env.MIS_APPS_SCRIPT_URL);
    } catch (err) {
      // The CSV export reads the same tab, so a script outage or redeploy
      // doesn't take the page down.
      console.warn(`[misSheet] Apps Script failed, using the CSV export instead: ${(err as Error).message}`);
    }
  }
  return downloadCsv();
}

export const misSheetService = {
  async getForRecords(opts: { refresh?: boolean } = {}): Promise<MisSheetForRecords> {
    const now = Date.now();
    if (cache) {
      const age = now - cache.fetchedAtMs;
      if (age < CACHE_TTL_MS && (!opts.refresh || age < MIN_REFRESH_GAP_MS)) return cache.data;
    }
    if (!inFlight) {
      inFlight = download()
        .then((data) => {
          cache = { data, fetchedAtMs: Date.now() };
          return data;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  },

  // Every row carries its matched app account (userId). Admins get every row
  // plus a link to open the sheet. Staff get only their own row (the one
  // matched to their account), the same "own row only" rule as the MIS
  // dashboard, and no sheet link: the sheet also has tabs with passwords.
  async forViewer(data: MisSheetForRecords, user: { userId: number; role: string }): Promise<MisSheetForRecordsView> {
    const rows = await withAppUsers(data.rows);
    if (user.role === "ADMIN") {
      return {
        ...data,
        rows,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${encodeURIComponent(env.MIS_SHEET_ID)}/edit#gid=${env.MIS_SHEET_FOR_RECORDS_GID}`,
      };
    }
    return { ...data, rows: rows.filter((r) => r.userId === user.userId), sheetUrl: null };
  },
};
