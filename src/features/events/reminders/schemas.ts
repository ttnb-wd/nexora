import { z } from "zod";
export const reminderMinutes = [15, 30, 60, 1440] as const;
export const reminderLabels = { 15: "15 minutes before", 30: "30 minutes before", 60: "1 hour before", 1440: "1 day before" } as const;
export const reminderMinutesSchema = z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(1440)]);
export type ReminderState = { eligible: boolean; enabled: boolean; reminderMinutes: number | null };
export const reminderOff: ReminderState = { eligible: false, enabled: false, reminderMinutes: null };
