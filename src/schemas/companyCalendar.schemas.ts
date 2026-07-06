import { z } from "zod";

export const calendarEventTypeEnum = z.enum(["meeting", "holiday", "training", "review", "event"]);

export const createCompanyCalendarEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  location: z.string().optional(),
  type: calendarEventTypeEnum.default("event"),
  description: z.string().optional(),
});

export type CreateCompanyCalendarEventInput = z.infer<typeof createCompanyCalendarEventSchema>;
