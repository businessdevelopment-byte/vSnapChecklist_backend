import { prisma } from "../config/database";
import { invalidateMaterializeCache } from "./checklist.service";

export const holidayService = {
  async getAll() {
    return prisma.holiday.findMany({ orderBy: { date: "asc" } });
  },

  async create(date: string, name: string) {
    // UTC midnight of the calendar day as written. The DATE column keeps the
    // UTC day, and local midnight on an IST server is 18:30 UTC the day
    // before — that saved every holiday one day early.
    const d = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
    const holiday = await prisma.holiday.upsert({
      where: { date: d },
      update: { name },
      create: { date: d, name },
    });
    // Today's checklist rows depend on the holiday list.
    invalidateMaterializeCache();
    return holiday;
  },

  async remove(id: number) {
    const h = await prisma.holiday.findUnique({ where: { id } });
    if (!h) throw Object.assign(new Error("Holiday not found"), { status: 404 });
    await prisma.holiday.delete({ where: { id } });
    invalidateMaterializeCache();
    return { id };
  },

  async getWorkingDays(fromDate: string, toDate: string, skipSundays: boolean) {
    const holidays = await prisma.holiday.findMany({ select: { date: true, name: true } });
    const holidayMap = new Map(holidays.map((h) => [h.date.toISOString().split("T")[0], h.name]));

    const result: { date: string; type: "working" | "sunday" | "holiday"; holidayName?: string }[] = [];

    const cursor = new Date(fromDate);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setUTCHours(0, 0, 0, 0);

    while (cursor <= end) {
      const key = cursor.toISOString().split("T")[0];
      const dow = cursor.getUTCDay(); // 0=Sun

      if (skipSundays && dow === 0) {
        result.push({ date: key, type: "sunday" });
      } else if (holidayMap.has(key)) {
        result.push({ date: key, type: "holiday", holidayName: holidayMap.get(key) });
      } else {
        result.push({ date: key, type: "working" });
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      days: result,
      summary: {
        total: result.length,
        working:  result.filter((d) => d.type === "working").length,
        sundays:  result.filter((d) => d.type === "sunday").length,
        holidays: result.filter((d) => d.type === "holiday").length,
      },
    };
  },
};
