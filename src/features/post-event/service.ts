import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { eventWhere } from "../attendees/server/service";
import { eventSlugSchema } from "../events/management-schemas";
import { feedbackSchema, feedbackOff, type ViewerFeedback } from "./schemas";
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128;
const validTarget = (actorId: string, eventId: string, scope: string | null) => validId(actorId) && validId(eventId) && (scope === null || /^[a-z0-9-]{3,64}$/.test(scope));
const options = { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 15000 } as const;

/** Actor is supplied only by a trusted authenticated server boundary. All event
 * participation/content writes use this same parent-event lock. */
export async function completeManagedEvent(db: PrismaClient, actorId: string, eventId: string, scope: string | null, confirmed: boolean) {
  if (!validTarget(actorId, eventId, scope) || !confirmed) return { ok: false, message: "Confirm that you want to mark this event as completed." };
  try {
    return await db.$transaction(async tx => {
      const where = eventWhere(actorId, eventId, scope);
      if (!await tx.event.findFirst({ where, select: { id: true } })) return { ok: false, message: "You do not have permission to complete this event." };
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findFirst({ where, select: { id: true, status: true, endAt: true, slug: true } });
      if (!event) return { ok: false, message: "Your event access changed. Reload before continuing." };
      if (event.status === "COMPLETED") return { ok: true, message: "This event is already completed.", slug: event.slug };
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
      if (event.status !== "PUBLISHED" || event.endAt > now) return { ok: false, message: "Only published events that have ended can be completed." };
      // Preserve any legacy recorded check-in whose status was not normalized.
      await tx.eventRegistration.updateMany({ where: { eventId, status: "REGISTERED", checkedInAt: { not: null } }, data: { status: "ATTENDED" } });
      await tx.eventRegistration.updateMany({ where: { eventId, status: "REGISTERED", checkedInAt: null }, data: { status: "NO_SHOW", ticketTokenHash: null, ticketNonce: null, ticketIssuedAt: null } });
      await tx.eventReminderPreference.updateMany({ where: { eventId, enabled: true }, data: { enabled: false } });
      // Recheck authorization in the actual update predicate too (role removal).
      const changed = await tx.event.updateMany({ where: { AND: [where, { status: "PUBLISHED" }] }, data: { status: "COMPLETED" } });
      if (!changed.count) throw new Error("Completion authorization changed");
      return { ok: true, message: "Event completed. Attendance is finalized.", slug: event.slug };
    }, options);
  } catch { return { ok: false, message: "We could not complete this event. Please try again." }; }
}

export async function saveFeedback(db: PrismaClient, actorId: string | null, slug: unknown, input: unknown) {
  const target = eventSlugSchema.safeParse(slug), value = feedbackSchema.safeParse(input);
  if (!actorId || !validId(actorId)) return { ok: false, message: "Please sign in to share feedback." };
  if (!target.success || !value.success) return { ok: false, message: "Choose a rating from 1 to 5 and an optional comment of up to 1000 characters. Comments cannot contain only whitespace." };
  try {
    return await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "slug" = ${target.data} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { slug: target.data }, select: { id: true, status: true } });
      if (!event || event.status !== "COMPLETED") return { ok: false, message: "Feedback is available after the organizer completes this event." };
      const where = { eventId_userId: { eventId: event.id, userId: actorId } };
      const registration = await tx.eventRegistration.findUnique({ where: { userId_eventId: { userId: actorId, eventId: event.id } }, select: { status: true } });
      if (registration?.status !== "ATTENDED") return { ok: false, message: "Only checked-in attendees can share feedback." };
      const data = { rating: value.data.rating, comment: value.data.comment || null };
      await tx.eventFeedback.upsert({ where, create: { eventId: event.id, userId: actorId, ...data }, update: data });
      return { ok: true, message: "Thanks for your feedback. You can update it below." };
    }, options);
  } catch { return { ok: false, message: "We could not save your feedback. Please try again." }; }
}

export async function loadViewerFeedback(db: PrismaClient, actorId: string | null, slug: string): Promise<ViewerFeedback> {
  if (!actorId || !eventSlugSchema.safeParse(slug).success) return feedbackOff;
  return db.$transaction(async tx => {
    const event = await tx.event.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (event?.status !== "COMPLETED") return feedbackOff;
    const registration = await tx.eventRegistration.findUnique({ where: { userId_eventId: { userId: actorId, eventId: event.id } }, select: { status: true } });
    if (registration?.status !== "ATTENDED") return { ...feedbackOff, noShow: registration?.status === "NO_SHOW" };
    const feedback = await tx.eventFeedback.findUnique({ where: { eventId_userId: { eventId: event.id, userId: actorId } }, select: { rating: true, comment: true } });
    return { eligible: true, noShow: false, feedback };
  }, { isolationLevel: "RepeatableRead", maxWait: 10000, timeout: 15000 });
}

export async function loadFeedbackInsights(db: PrismaClient, actorId: string, eventId: string, scope: string | null, requestedPage: unknown = 1) {
  if (!validTarget(actorId, eventId, scope)) return null;
  const numericPage = Number(requestedPage);
  const requested = Number.isInteger(numericPage) && numericPage >= 1 && numericPage <= 10000 ? numericPage : 1;
  return db.$transaction(async tx => {
    const event = await tx.event.findFirst({ where: eventWhere(actorId, eventId, scope), select: { title: true, slug: true, status: true } });
    if (!event) return null;
    const [aggregate, groups, attended, commentCount] = await Promise.all([
      tx.eventFeedback.aggregate({ where: { eventId }, _count: { _all: true }, _avg: { rating: true } }),
      tx.eventFeedback.groupBy({ by: ["rating"], where: { eventId }, _count: { _all: true } }),
      tx.eventRegistration.count({ where: { eventId, status: "ATTENDED" } }),
      tx.eventFeedback.count({ where: { eventId, comment: { not: null } } }),
    ]);
    const pageCount = Math.max(1, Math.ceil(commentCount / 20)), page = Math.min(requested, pageCount);
    const comments = await tx.eventFeedback.findMany({ where: { eventId, comment: { not: null } }, select: { rating: true, comment: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, skip: (page - 1) * 20 });
    return { event, responses: aggregate._count._all, averageRating: aggregate._avg.rating, attended,
      responseRate: attended ? aggregate._count._all / attended * 100 : null,
      distribution: [1,2,3,4,5].map(rating => ({ rating, count: groups.find(group => group.rating === rating)?._count._all ?? 0 })),
      comments, page, pageCount };
  }, { isolationLevel: "RepeatableRead", maxWait: 10000, timeout: 15000 });
}
