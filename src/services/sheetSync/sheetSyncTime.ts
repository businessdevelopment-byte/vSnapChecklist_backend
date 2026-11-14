// India Standard Time is a fixed UTC+05:30 (no daylight saving), so the
// nightly time can be worked out without a time-zone library and regardless
// of the server's own zone.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseTime(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { hours: h, minutes: m };
}

// The run time on the IST calendar day of `istMidnightUtcMs`, as a UTC instant.
function runOnIstDay(istDayStartAsUtcMs: number, hhmm: string): number {
  const { hours, minutes } = parseTime(hhmm);
  return istDayStartAsUtcMs + (hours * 60 + minutes) * 60 * 1000 - IST_OFFSET_MS;
}

// Start of the current IST calendar day, expressed on the UTC clock.
function istDayStart(now: Date): number {
  const istNow = now.getTime() + IST_OFFSET_MS;
  return istNow - (istNow % DAY_MS);
}

// The next scheduled run strictly after `now`.
export function nextRunAt(hhmm: string, now = new Date()): Date {
  const today = runOnIstDay(istDayStart(now), hhmm);
  return new Date(today > now.getTime() ? today : today + DAY_MS);
}

// The most recent scheduled time at or before `now` — a run that hasn't
// succeeded since then was missed.
export function lastScheduledAt(hhmm: string, now = new Date()): Date {
  const today = runOnIstDay(istDayStart(now), hhmm);
  return new Date(today <= now.getTime() ? today : today - DAY_MS);
}

// Today's IST calendar day as UTC midnight — the form the checklist service
// uses for a day (materializeAllActive).
export function istToday(now = new Date()): Date {
  return new Date(istDayStart(now));
}
