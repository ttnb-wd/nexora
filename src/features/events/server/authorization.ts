import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";

export const eventManagerRoles = ["OWNER", "ADMIN", "EDITOR"] as const;
/** Individual ownership and organization membership are separate authorization branches. */
export function eventAccessWhere(userId: string, manage = true): Prisma.EventWhereInput {
  return { OR: [
    { organizationId: null, creatorId: userId },
    { organization: { members: { some: { userId, ...(manage ? { role: { in: [...eventManagerRoles] } } : {}) } } } },
  ] };
}
export async function requireEventAccess(eventId: string, scope: string | null, manage = true) {
  const user = await requireUser();
  if (!z.object({ eventId: z.string().min(1).max(128), scope: z.string().min(3).max(64).nullable() }).safeParse({ eventId, scope }).success) notFound();
  const event = await getDb().event.findFirst({
    where: { id: eventId, ...(scope === null ? { organizationId: null } : { organization: { slug: scope } }), AND: [eventAccessWhere(user.id, manage)] },
    include: { organization: { select: { id: true, slug: true, name: true, members: { where: { userId: user.id }, select: { role: true } } } } },
  });
  if (!event) notFound();
  return { user, event };
}
export function eventManagementPath(event: { id: string; organization: { slug: string } | null }) {
  return event.organization ? `/organizer/${event.organization.slug}/events/${event.id}` : `/dashboard/events/${event.id}`;
}
