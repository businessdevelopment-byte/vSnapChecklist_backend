// Fixed Monday–Sunday ISO week, plain Date/UTC math (this backend has no
// date-fns dependency — checked package.json). The single place week
// boundaries are computed, so every MIS calculator/service shares one
// definition of "a week."
export function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = day.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(day);
  weekStart.setUTCDate(day.getUTCDate() + diffToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

// "Today" is the server's local calendar date — the same convention the
// checklist uses (toUtcDay in checklist.service.ts). Taking the UTC date
// instead kept Monday 00:00–05:30 IST in the previous week, so plans saved
// then for "next week" landed two weeks ahead.
export function getCurrentWeekBounds(now: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  return getWeekBounds(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** "YYYY-MM-DD" — sent to the frontend instead of a timestamp, so a week's
 * Sunday can't be shifted into Monday by the browser's timezone. */
export function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}
