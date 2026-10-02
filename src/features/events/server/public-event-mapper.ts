import type { Prisma } from "@/generated/prisma/client";
import { eventCategories, type PublicEvent, type EventCategory, type EventType, type EventVisual } from "../types";

// This selection is the public data boundary. Never select email, account, member, or auth fields.
export const publicEventSelect = {
  id: true, slug: true, title: true, description: true, shortDescription: true,
  category: true, locationName: true, city: true, region: true, startAt: true,
  endAt: true, timezone: true, eventType: true, status: true,
  creator: { select: { name: true } },
  organization: { select: { name: true, slug: true, industry: true, city: true, region: true, visualTheme: true } },
} satisfies Prisma.EventSelect;

export type PublicEventRecord = Prisma.EventGetPayload<{ select: typeof publicEventSelect }>;

const tones: EventVisual[] = ["violet", "cyan", "coral", "orange", "warm", "pink", "mixed"];
const categoryTones: Record<EventCategory, EventVisual> = {
  Technology: "cyan", AI: "violet", Business: "orange", Design: "pink",
  Startup: "warm", Community: "coral", Career: "mixed", Other: "violet",
};

function dateInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function timeInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function previewText(value: string, max: number) {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function mapPublicEvent(record: PublicEventRecord, now = new Date()): PublicEvent {
  const category = eventCategories.find((value) => value === record.category) ?? "Other";
  const type: EventType = record.eventType === "IN_PERSON" ? "In person" : record.eventType === "ONLINE" ? "Online" : "Hybrid";
  const tone = tones.includes(record.organization?.visualTheme as EventVisual)
    ? record.organization!.visualTheme as EventVisual : categoryTones[category];
  const organizer = record.organization
    ? { name: record.organization.name, slug: record.organization.slug, industry: record.organization.industry ?? undefined, location: [record.organization.city, record.organization.region].filter(Boolean).join(", ") || undefined }
    : { name: record.creator.name };
  const city = record.eventType === "ONLINE" ? "Online" : record.city ?? record.region ?? "Location to be announced";
  const venue = record.eventType === "ONLINE" ? "Online event" : record.locationName ?? "Venue to be announced";
  const summary = record.shortDescription ?? record.description;
  const description = summary ? previewText(summary, 280) : undefined;
  const ended = record.status === "COMPLETED" || record.startAt < now;
  const about = record.description ? [record.description] : record.shortDescription ? [record.shortDescription] : [];
  const zoneLabel = new Intl.DateTimeFormat("en-US", { timeZone: record.timezone, timeZoneName: "short" }).formatToParts(record.startAt).find((part) => part.type === "timeZoneName")?.value ?? record.timezone;
  return {
    id: record.id, slug: record.slug, title: record.title, category,
    date: dateInZone(record.startAt, record.timezone),
    time: `${timeInZone(record.startAt, record.timezone)} – ${timeInZone(record.endAt, record.timezone)} · ${zoneLabel}`,
    startAt: record.startAt.toISOString(), timezone: record.timezone,
    location: { city, venue }, organizationId: "", organizer, source: "database", type,
    description, visual: { tone, headline: previewText(record.title, 32), caption: previewText(description ?? category, 80) },
    tags: record.category ? [record.category] : [],
    status: ended ? "completed" : "upcoming",
    details: { about, agenda: [], speakers: [], venue: { address: "", guidance: "" }, availability: ended ? "This event has ended" : "Event details available from the organizer", resources: [] },
  };
}
