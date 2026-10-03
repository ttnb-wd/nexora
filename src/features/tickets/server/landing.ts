import "server-only";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/features/auth/server/session";
import { eventAccessWhere } from "@/features/events/server/authorization-rules";
import { eventManagementPath } from "@/features/events/server/authorization";

/** Only public event context is read here. A QR credential never reaches this GET. */
export async function getTicketLandingContext(slug: unknown) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,128}$/.test(slug)) return null;
  const db = getDb();
  const event = await db.event.findFirst({ where: { slug, status: { in: ["PUBLISHED", "COMPLETED"] } }, select: { title: true, slug: true } });
  if (!event) return null;
  const user = await getCurrentUser();
  const managed = user ? await db.event.findFirst({ where: { slug, AND: [eventAccessWhere(user.id)] }, select: { id: true, organization: { select: { slug: true } } } }) : null;
  return { ...event, checkInPath: managed ? `${eventManagementPath(managed)}/check-in` : null };
}
