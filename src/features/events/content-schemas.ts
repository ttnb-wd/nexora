import { z } from "zod";
import { zonedDateTimeToUtc } from "./timezone";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
export const resourceTypes = ["SLIDES", "RECORDING", "LINK", "NOTES", "DOCUMENT", "OTHER"] as const;
export const resourceTypeLabels = { SLIDES: "Slides", RECORDING: "Recording", LINK: "Links", NOTES: "Notes", DOCUMENT: "Document", OTHER: "Other" } as const;
export const agendaItemSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200), description: optionalText(5000),
  startAt: z.date(), endAt: z.date().nullable(), locationLabel: optionalText(200),
}).refine((value) => !value.endAt || value.endAt > value.startAt, { path: ["endAt"], message: "End time must be after start time." });
export const eventSpeakerSchema = z.object({ name: z.string().trim().min(1, "Enter a name.").max(200), role: optionalText(200), company: optionalText(200), bio: optionalText(5000) });
export function isSafeResourceUrl(value: string) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
export const eventResourceSchema = z.object({ title: z.string().trim().min(1, "Enter a title.").max(200), type: z.enum(resourceTypes), url: z.string().trim().max(2048).refine(isSafeResourceUrl, "Use an http or https URL without embedded credentials."), description: optionalText(5000) });
export const contentTargetSchema = z.object({ eventId: z.string().min(1).max(128), scope: z.string().min(3).max(64).nullable(), itemId: z.string().min(1).max(128).optional() });
export type ContentKind = "agenda" | "speaker" | "resource";
export type ContentState = { ok?: boolean; message?: string; errors?: Record<string, string[] | undefined> };
export function contentEditable(status: string, kind: ContentKind) { return status === "DRAFT" || status === "PUBLISHED" || (status === "COMPLETED" && kind === "resource"); }
export function agendaInputFromForm(form: FormData, timezone: string) {
  const local = (name: string) => {
    const value = form.get(name);
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Enter a valid agenda date and time.");
    return zonedDateTimeToUtc(value.slice(0, 10), value.slice(11), timezone);
  };
  return { title: form.get("title"), description: form.get("description") ?? "", locationLabel: form.get("locationLabel") ?? "", startAt: local("startAt"), endAt: form.get("endAt") ? local("endAt") : null };
}
