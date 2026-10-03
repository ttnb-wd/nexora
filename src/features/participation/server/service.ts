import "server-only";
import { getDb } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/features/auth/server/session";
import { requireEventAccess } from "@/features/events/server/authorization";
import { mapPublicEvent, publicEventSelect } from "@/features/events/server/public-event-mapper";
import { participationSlugSchema, eventSignInPath, registrationClosedReason, type ParticipationResult, type Availability } from "../rules";

const eligibilitySelect = { id: true, status: true, startAt: true, endAt: true, capacity: true, registrationDeadline: true } as const;
/** No client identity is accepted: every read/write derives identity from the session. */
export async function mutateParticipation(input: unknown, kind: "join" | "cancel" | "save" | "unsave"): Promise<ParticipationResult> {
  const parsed = participationSlugSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "This event is no longer available." };
  const slug = parsed.data;
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Please sign in to continue.", signIn: eventSignInPath(slug) };
    return await getDb().$transaction(async (tx) => {
      // Parameterized row lock serializes all participation writes for this event. Event
      // lifecycle/settings UPDATEs take the same row lock, so eligibility is read afterward.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "slug" = ${slug} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { slug }, select: eligibilitySelect });
      if (!event) return { ok: false, message: "This event is no longer available." };
      const where = { userId_eventId: { userId: user.id, eventId: event.id } };
      if (kind === "unsave") {
        await tx.eventBookmark.deleteMany({ where: { userId: user.id, eventId: event.id } });
        return { ok: true, message: "Event removed from saved events." };
      }
      if (kind === "cancel") {
        // Own rows only; cancellation remains possible when the organizer cancels/archives.
        await tx.eventRegistration.updateMany({ where: { userId: user.id, eventId: event.id, status: "REGISTERED" }, data: { status: "CANCELLED" } });
        return { ok: true, message: "Registration cancelled." };
      }
      if (kind === "save") {
        if (!["PUBLISHED", "COMPLETED"].includes(event.status)) return { ok: false, message: "This event is no longer available." };
        await tx.eventBookmark.upsert({ where, create: { userId: user.id, eventId: event.id }, update: {} });
        return { ok: true, message: "Event saved." };
      }
      const closedReason = registrationClosedReason(event);
      if (closedReason) return { ok: false, message: closedReason };
      const existing = await tx.eventRegistration.findUnique({ where, select: { status: true } });
      if (existing?.status === "REGISTERED") return { ok: true, message: "You are already registered for this event." };
      if (existing && existing.status !== "CANCELLED") return { ok: false, message: "This registration cannot be changed." };
      const count = await tx.eventRegistration.count({ where: { eventId: event.id, status: "REGISTERED" } });
      if (event.capacity !== null && count >= event.capacity) return { ok: false, message: "This event is full." };
      await tx.eventRegistration.upsert({ where, create: { userId: user.id, eventId: event.id, status: "REGISTERED" }, update: { status: "REGISTERED" } });
      return { ok: true, message: "You are registered for this event." };
    }, { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 15000 });
  } catch { return { ok: false, message: "We could not update your event. Please try again shortly." }; }
}
export async function getRegistrationForUser(slug: string) {
  const user = await getCurrentUser();
  if (!user || !participationSlugSchema.safeParse(slug).success) return null;
  const record = await getDb().eventRegistration.findFirst({ where: { userId: user.id, event: { slug } }, select: { status: true } });
  return record?.status ?? null;
}
export async function isEventSavedByUser(slug: string) {
  const user = await getCurrentUser();
  if (!user || !participationSlugSchema.safeParse(slug).success) return false;
  return Boolean(await getDb().eventBookmark.findFirst({ where: { userId: user.id, event: { slug } }, select: { createdAt: true } }));
}
export async function getBookmarkViewer() {
  const user = await getCurrentUser();
  if (!user) return { authenticated: false, savedSlugs: [] as string[], unavailable: false };
  const records = await getDb().eventBookmark.findMany({ where: { userId: user.id }, select: { event: { select: { slug: true } } } });
  return { authenticated: true, savedSlugs: records.map((record) => record.event.slug), unavailable: false };
}
export async function getEventParticipation(slug: string) {
  const user = await getCurrentUser();
  const event = await getDb().event.findFirst({ where: { slug, status: { in: ["PUBLISHED", "COMPLETED"] } }, select: { ...eligibilitySelect, _count: { select: { registrations: { where: { status: "REGISTERED" } } } } } });
  if (!event) throw new Error("Event unavailable");
  const [registration, saved] = await Promise.all([getRegistrationForUser(slug), isEventSavedByUser(slug)]);
  const spotsLeft = event.capacity === null ? null : Math.max(0, event.capacity - event._count.registrations);
  const availability: Availability = { closedReason: registrationClosedReason(event) ?? (spotsLeft === 0 ? "This event is full." : null), spotsLeft };
  return { viewer: { authenticated: Boolean(user), joined: registration === "REGISTERED", saved }, availability };
}
export async function getEventRegistrationCount(eventId: string, scope: string | null) {
  const { event } = await requireEventAccess(eventId, scope, false);
  return getDb().eventRegistration.count({ where: { eventId: event.id, status: "REGISTERED" } });
}
/** Personal collections never include other users' records or attendee identities. */
export async function getJoinedEvents() {
  const user = await requireUser();
  const now = new Date();
  const records = await getDb().eventRegistration.findMany({ where: { userId: user.id }, select: { status: true, event: { select: { ...publicEventSelect, status: true } } }, orderBy: { event: { startAt: "asc" } } });
  return records.map(({ status, event }) => ({ event: mapPublicEvent(event, now), registrationStatus: status, eventStatus: event.status, publicVisible: ["PUBLISHED", "COMPLETED"].includes(event.status) }));
}
export async function getSavedEvents() {
  const user = await requireUser();
  const records = await getDb().eventBookmark.findMany({ where: { userId: user.id }, select: { event: { select: publicEventSelect } }, orderBy: { createdAt: "desc" } });
  return records.map(({ event }) => ({ event: mapPublicEvent(event), eventStatus: event.status, publicVisible: ["PUBLISHED", "COMPLETED"].includes(event.status) }));
}
