/**
 * vsnapChecklist → Google Sheet mirror ("Sync Checklist & Delegation - Server").
 *
 * The backend (src/services/sheetSync) rebuilds the "Checklist" and
 * "Delegation" tabs from the app every night at 23:45 IST and on "Sync now".
 * This script only receives rows and writes them; it never sends data back.
 *
 * SETUP (once, by the sheet's owner):
 *   1. Open the sheet → Extensions → Apps Script. Replace everything in
 *      Code.gs with this file and press Save.
 *   2. Project Settings (gear icon) → Script properties → Add property:
 *        SYNC_SECRET = a long random value (at least 32 characters).
 *      Put the same value in the backend .env as SHEET_SYNC_SECRET.
 *   3. Deploy → New deployment → type "Web app":
 *        Execute as: Me      Who has access: Anyone
 *      Authorize when asked, then copy the Web app URL (…/exec) into the
 *      backend .env as SHEET_SYNC_URL, and restart the backend.
 *   4. Later changes to this file need Deploy → Manage deployments → Edit →
 *      Version: New version (the URL stays the same).
 *
 * PROTOCOL (JSON POST, every call carries `secret`, `runId`, `tab`):
 *   begin  {headers, types, totalRows} — checks the tab's header row, checks
 *          the 10M-cell limit, and makes this run the tab's owner.
 *   write  {offset, rows, types}       — writes rows at row 2 + offset, only
 *          in the managed columns. Same offset → same cells, so a retry
 *          never duplicates.
 *   finish {totalRows, types}          — clears managed cells below the last
 *          row (rows for deleted tasks disappear) and sets date formats.
 * Columns to the right of the managed ones are never touched.
 */

var MAX_TEXT = 50000;        // Google's per-cell character limit
var CELL_LIMIT = 10000000;   // Google's per-spreadsheet cell limit
var LOCK_WAIT_MS = 30000;

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, retryable: false, error: 'Request body is not JSON' });
  }

  var secret = PropertiesService.getScriptProperties().getProperty('SYNC_SECRET');
  if (!secret) {
    return reply_({ ok: false, retryable: false, error: 'SYNC_SECRET is not set in the script (Project Settings → Script properties)' });
  }
  if (body.secret !== secret) {
    return reply_({ ok: false, retryable: false, error: 'Wrong secret: SHEET_SYNC_SECRET in the backend .env must equal SYNC_SECRET in the script' });
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    return reply_({ ok: false, retryable: true, error: 'The sheet is busy with another request' });
  }
  try {
    if (body.action === 'begin') return reply_(begin_(body));
    if (body.action === 'write') return reply_(write_(body));
    if (body.action === 'finish') return reply_(finish_(body));
    return reply_({ ok: false, retryable: false, error: 'Unknown action: ' + body.action });
  } catch (err) {
    return reply_({ ok: false, retryable: !(err && err.fatal), error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

// Health check only (no data, no secret needed): opening the /exec URL in a
// browser should show {"ok":true,...}.
function doGet() {
  return reply_({ ok: true, service: 'vsnapChecklist sheet sync' });
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// An error a retry can't fix (wrong header, missing tab, another run took over).
function fatal_(message) {
  var err = new Error(message);
  err.fatal = true;
  return err;
}

function tab_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw fatal_('Tab "' + name + '" not found in the sheet. Nothing was written.');
  return sheet;
}

function colLetter_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function props_() {
  return PropertiesService.getDocumentProperties();
}

// Only the run that called `begin` last may write this tab, so two runs can
// never interleave their rows.
function checkRun_(body) {
  if (props_().getProperty('run:' + body.tab) !== body.runId) {
    throw fatal_('Another sync took over the "' + body.tab + '" tab; this run stopped.');
  }
}

function begin_(body) {
  var sheet = tab_(body.tab);
  var headers = body.headers;
  if (sheet.getMaxColumns() < headers.length) {
    throw fatal_('Tab "' + body.tab + '" has fewer columns than the ' + headers.length + ' expected headers. Nothing was written.');
  }

  var actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(actual[i]).trim() !== headers[i]) {
      throw fatal_('Header mismatch in "' + body.tab + '" column ' + colLetter_(i + 1) + ': expected "' + headers[i] +
        '", found "' + actual[i] + '". Restore the header row; nothing was written.');
    }
  }

  var cells = 0;
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (s) {
    var rows = s.getMaxRows();
    if (s.getSheetId() === sheet.getSheetId()) rows = Math.max(rows, body.totalRows + 1);
    cells += rows * s.getMaxColumns();
  });
  if (cells > CELL_LIMIT) {
    throw fatal_('The sheet would need ' + cells + ' cells, over Google\'s 10,000,000 limit. Nothing was written.');
  }

  props_().setProperty('run:' + body.tab, body.runId);
  props_().deleteProperty('done:' + body.tab);
  return { ok: true, projectedCells: cells };
}

function cell_(v, type, tz) {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'number') {
    var n = Number(v);
    return isNaN(n) ? '' : n;
  }
  if (type === 'date') return Utilities.parseDate(String(v), tz, 'yyyy-MM-dd');
  if (type === 'datetime') return new Date(String(v));
  var s = String(v);
  if (s.length > MAX_TEXT) s = s.slice(0, MAX_TEXT - 1) + '…';
  // The leading apostrophe keeps the value as plain text: "=…" can't run as a
  // formula, and "00123" or "1/2" can't turn into a number or a date.
  return "'" + s;
}

function write_(body) {
  checkRun_(body);
  var sheet = tab_(body.tab);
  var rows = body.rows || [];
  if (!rows.length) return { ok: true, written: 0 };

  var types = body.types;
  var cols = types.length;
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var values = rows.map(function (row) {
    var out = new Array(cols);
    for (var c = 0; c < cols; c++) out[c] = cell_(row[c], types[c], tz);
    return out;
  });

  var firstRow = 2 + body.offset;
  var needed = firstRow + rows.length - 1;
  var max = sheet.getMaxRows();
  if (needed > max) sheet.insertRowsAfter(max, needed - max);

  sheet.getRange(firstRow, 1, rows.length, cols).setValues(values);
  return { ok: true, written: rows.length };
}

function finish_(body) {
  // A retried finish whose first attempt already went through.
  if (props_().getProperty('done:' + body.tab) === body.runId) return { ok: true, cleared: 0 };
  checkRun_(body);

  var sheet = tab_(body.tab);
  var types = body.types;
  var cols = types.length;
  var total = body.totalRows;

  var lastRow = sheet.getLastRow();
  var cleared = 0;
  if (lastRow > total + 1) {
    cleared = lastRow - total - 1;
    sheet.getRange(total + 2, 1, cleared, cols).clearContent();
  }

  if (total > 0) {
    for (var i = 0; i < cols; i++) {
      if (types[i] === 'date') sheet.getRange(2, i + 1, total, 1).setNumberFormat('dd/MM/yyyy');
      else if (types[i] === 'datetime') sheet.getRange(2, i + 1, total, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    }
  }

  SpreadsheetApp.flush();
  props_().deleteProperty('run:' + body.tab);
  props_().setProperty('done:' + body.tab, body.runId);
  return { ok: true, cleared: cleared };
}
