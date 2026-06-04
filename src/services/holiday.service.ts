import { prisma } from "../config/database";

export const holidayService = {
  async getAll() {
    return prisma.holiday.findMany({ orderBy: { date: "asc" } });
  },

  async create(date: string, name: string) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return prisma.holiday.upsert({
      where: { date: d },
      update: { name },
      create: { date: d, name },
    });
  },

  async remove(id: number) {
    const h = await prisma.holiday.findUnique({ where: { id } });
    if (!h) throw Object.assign(new Error("Holiday not found"), { status: 404 });
    await prisma.holiday.delete({ where: { id } });
    return { id };
  },

  async getWorkingDays(fromDate: string, toDate: string, skipSundays: boolean) {
    const holidays = await prisma.holiday.findMany({ select: { date: true, name: true } });
    const holidayMap = new Map(holidays.map((h) => [h.date.toISOString().split("T")[0], h.name]));

    const result: { date: string; type: "working" | "sunday" | "holiday"; holidayName?: string }[] = [];

    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end) {
      const key = cursor.toISOString().split("T")[0];
      const dow = cursor.getDay(); // 0=Sun

      if (skipSundays && dow === 0) {
        result.push({ date: key, type: "sunday" });
      } else if (holidayMap.has(key)) {
        result.push({ date: key, type: "holiday", holidayName: holidayMap.get(key) });
      } else {
        result.push({ date: key, type: "working" });
      }

      cursor.setDate(cursor.getDate() + 1);
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
