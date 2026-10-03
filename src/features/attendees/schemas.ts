import { z } from "zod";
export const attendeeStatuses = ["ALL", "REGISTERED", "ATTENDED", "CANCELLED", "WAITLISTED", "NO_SHOW"] as const;
export const registrationStatusLabels = { REGISTERED: "Registered", ATTENDED: "Attended", CANCELLED: "Cancelled", WAITLISTED: "Waitlisted", NO_SHOW: "No-show" } as const;
export const attendeeTargetSchema = z.object({ eventId: z.string().min(1).max(128), scope: z.string().min(3).max(64).nullable(), registrationId: z.string().min(1).max(128) });
export const attendeeQuerySchema = z.object({ q: z.string().trim().max(200).default(""), status: z.enum(attendeeStatuses).default("ALL"), page: z.coerce.number().int().min(1).max(1000000).default(1) });
export const attendeePageSize = 50;
export function attendanceEditable(status: string) { return status === "PUBLISHED" || status === "COMPLETED"; }
export type AttendeeActionState = { ok?: boolean; message?: string };
export type AttendeeQuery = z.infer<typeof attendeeQuerySchema>;
