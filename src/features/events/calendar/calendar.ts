import { createHash } from "node:crypto";

/** Public event data only: meeting credentials and attendee identities never enter exports. */
export interface CalendarEvent {
  id: string; slug: string; title: string; description: string | null;
  shortDescription: string | null; locationName: string | null;
  city: string | null; region: string | null; eventType: string;
  startAt: Date; endAt: Date; timezone: string;
}
export function calendarTimestamp(value: Date) {
  if (!Number.isFinite(value.getTime())) throw new Error("Invalid calendar time");
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
export function calendarEventUrl(event: Pick<CalendarEvent, "slug">, origin: string) {
  return new URL(`/events/${encodeURIComponent(event.slug)}`, origin).href;
}
export function formatCalendarDescription(event: CalendarEvent, origin: string) {
  return [event.description || event.shortDescription, `Event timezone: ${event.timezone}`, calendarEventUrl(event, origin)].filter(Boolean).join("\n\n");
}
export function buildCalendarLocation(event: CalendarEvent) {
  if (event.eventType === "ONLINE") return "Online event";
  return [event.locationName, event.city, event.region, event.eventType === "HYBRID" ? "Also online" : null].filter(Boolean).join(", ");
}
export function escapeIcsText(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
/** RFC 5545: CRLF folds at 75 UTF-8 octets, never inside a code point. */
export function foldIcsLine(value: string) {
  let output = "", bytes = 0;
  for (const character of value) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) { output += "\r\n "; bytes = 1; }
    output += character; bytes += size;
  }
  return output;
}
export function buildIcsEvent(event: CalendarEvent, origin: string, stamp = new Date()) {
  if (event.endAt <= event.startAt) throw new Error("Invalid calendar interval");
  // Hash the internal identity; stable across edits/slug changes without exposing a database ID.
  const uid = `${createHash("sha256").update(event.id).digest("hex")}@${new URL(origin).hostname}`;
  const location = buildCalendarLocation(event);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nexora//Event Calendar//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${uid}`, `DTSTAMP:${calendarTimestamp(stamp)}`, `DTSTART:${calendarTimestamp(event.startAt)}`, `DTEND:${calendarTimestamp(event.endAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`, `DESCRIPTION:${escapeIcsText(formatCalendarDescription(event, origin))}`,
    ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []), `URL:${calendarEventUrl(event, origin)}`, "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR"];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
export function buildGoogleCalendarUrl(event: CalendarEvent, origin: string) {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.search = new URLSearchParams({ action: "TEMPLATE", text: event.title,
    dates: `${calendarTimestamp(event.startAt)}/${calendarTimestamp(event.endAt)}`, ctz: event.timezone,
    details: formatCalendarDescription(event, origin), location: buildCalendarLocation(event) }).toString();
  return url.href;
}
