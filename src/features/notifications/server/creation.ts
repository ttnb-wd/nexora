import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
/** Called only inside the mutation's transaction. No client recipient/type inputs. */
export async function notifyEventPublished(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { id: true, title: true, slug: true, organization: { select: { name: true, followers: { select: { userId: true } } } } } });
  if (!event.organization) return;
  const data = event.organization.followers.map(({ userId }) => ({ userId, type: "EVENT_PUBLISHED" as const, title: `New event from ${event.organization!.name}`, message: `${event.title} is now open.`, href: `/events/${event.slug}`, dedupeKey: `event:${event.id}:published:${userId}` }));
  if (data.length) await tx.notification.createMany({ data, skipDuplicates: true });
}
export async function notifyEventCancelled(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { id: true, title: true, registrations: { where: { status: "REGISTERED" }, select: { userId: true } } } });
  const data = event.registrations.map(({ userId }) => ({ userId, type: "EVENT_CANCELLED" as const, title: "Event cancelled", message: `${event.title} has been cancelled by the organizer.`, href: "/dashboard/joined", dedupeKey: `event:${event.id}:cancelled:${userId}` }));
  if (data.length) await tx.notification.createMany({ data, skipDuplicates: true });
}
/** Only call after an actual state change under the event row lock. Replay sees
 * persisted registration status and returns before this point. A new occurrence
 * key permits a real rejoin/cancel cycle to notify again, without replay spam. */
export async function notifyRegistration(tx: Prisma.TransactionClient, event: { id: string; title: string; slug: string }, userId: string, registered: boolean) {
  await tx.notification.create({ data: { userId, type: registered ? "REGISTRATION_CONFIRMED" : "REGISTRATION_CANCELLED", title: registered ? "Registration confirmed" : "Registration cancelled", message: registered ? `You are registered for ${event.title}.` : `Your registration for ${event.title} was cancelled.`, href: registered ? `/events/${event.slug}` : "/dashboard/joined", dedupeKey: `registration:${event.id}:${userId}:${randomUUID()}` } });
}
