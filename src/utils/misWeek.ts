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

export function getCurrentWeekBounds(): { weekStart: Date; weekEnd: Date } {
  return getWeekBounds(new Date());
}
