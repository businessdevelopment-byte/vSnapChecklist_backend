import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import type { CreateCompanyCalendarEventInput } from "../schemas/companyCalendar.schemas";

export const companyCalendarService = {
  // Matches CompanyCalendar.jsx's own data-loading exactly: all events
  // loaded once, every view (month grid, upcoming list, selected-date
  // panel) filters this same set client-side (CompanyCalendar.jsx:25,38-51).
  async list() {
    return prisma.companyCalendarEvent.findMany({ orderBy: { date: "asc" } });
  },

  async create(input: CreateCompanyCalendarEventInput) {
    return prisma.companyCalendarEvent.create({
      data: {
        ...input,
        date: new Date(input.date),
      } satisfies Prisma.CompanyCalendarEventUncheckedCreateInput,
    });
  },
};
