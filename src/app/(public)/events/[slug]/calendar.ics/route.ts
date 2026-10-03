import { getCalendarEvent } from "@/features/events/calendar/server";
import { buildIcsEvent } from "@/features/events/calendar/calendar";
import { getPublicAppUrl } from "@/lib/public-url-server";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await getCalendarEvent(slug);
  if (!event) return new Response("Event not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(buildIcsEvent(event, getPublicAppUrl()), { headers: {
    "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
