import "server-only";
import { getDb } from "@/lib/db";
import { getAuthEnvironment } from "@/lib/env";
import { participationSlugSchema } from "@/features/participation/rules";
import { buildGoogleCalendarUrl, type CalendarEvent } from "./calendar";
export const calendarSelect = { id: true, slug: true, title: true, description: true, shortDescription: true,
  locationName: true, city: true, region: true, eventType: true, startAt: true, endAt: true, timezone: true } as const;
export async function getCalendarEvent(slug: string) {
  if (!participationSlugSchema.safeParse(slug).success) return null;
  return getDb().event.findFirst({ where: { slug, status: { in: ["PUBLISHED", "COMPLETED"] } }, select: calendarSelect });
}
export function getCalendarLinks(event: CalendarEvent) {
  return { google: buildGoogleCalendarUrl(event, getAuthEnvironment().APP_URL), ics: `/events/${encodeURIComponent(event.slug)}/calendar.ics` };
}
