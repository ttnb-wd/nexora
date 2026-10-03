import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { eventAccessWhere } from "../../events/server/authorization-rules";
import { attendeeTargetSchema, attendeeQuerySchema, attendeePageSize, attendanceEditable, type AttendeeQuery, type AttendeeActionState } from "../schemas";

function eventWhere(userId: string, eventId: string, scope: string | null): Prisma.EventWhereInput {
  return { id: eventId, ...(scope === null ? { organizationId: null } : { organization: { slug: scope } }), AND: [eventAccessWhere(userId)] };
}
export const attendeeSelect = { id: true, status: true, createdAt: true, checkedInAt: true, user: { select: { name: true } } } satisfies Prisma.EventRegistrationSelect;
const eventSelect = { id: true, title: true, slug: true, timezone: true, status: true, capacity: true, organization: { select: { slug: true } } } satisfies Prisma.EventSelect;
async function readSummary(tx: Prisma.TransactionClient, eventId: string, capacity: number | null) {
  const groups = await tx.eventRegistration.groupBy({ by: ["status"], where: { eventId }, _count: { _all: true } });
  const counts = { REGISTERED: 0, ATTENDED: 0, CANCELLED: 0, WAITLISTED: 0, NO_SHOW: 0 };
  for (const group of groups) counts[group.status] = group._count._all;
  const occupied = counts.REGISTERED + counts.ATTENDED;
  return { counts, occupied, remaining: capacity === null ? null : Math.max(0, capacity - occupied) };
}
export async function loadManagedAttendeeSummary(db: PrismaClient, userId: string, eventId: string, scope: string | null) {
  if (!attendeeTargetSchema.omit({ registrationId: true }).safeParse({ eventId, scope }).success) return null;
  return db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: eventWhere(userId, eventId, scope), select: eventSelect });
    return event ? readSummary(tx, event.id, event.capacity) : null;
  }, { isolationLevel: "RepeatableRead", maxWait: 10000, timeout: 15000 });
}

/** Private, event-scoped query. The registration selection never includes email/auth fields. */
export async function loadManagedAttendees(db: PrismaClient, userId: string, eventId: string, scope: string | null, query: AttendeeQuery) {
  if (!attendeeTargetSchema.omit({ registrationId: true }).safeParse({ eventId, scope }).success) return null;
  const parsed = attendeeQuerySchema.safeParse(query);
  if (!parsed.success) return null;
  return db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: eventWhere(userId, eventId, scope), select: eventSelect });
    if (!event) return null;
    const summary = await readSummary(tx, event.id, event.capacity);
    const filter: Prisma.EventRegistrationWhereInput = { eventId: event.id, ...(parsed.data.status === "ALL" ? {} : { status: parsed.data.status }), ...(parsed.data.q ? { user: { name: { contains: parsed.data.q, mode: "insensitive" } } } : {}) };
    const total = await tx.eventRegistration.count({ where: filter });
    const pageCount = Math.max(1, Math.ceil(total / attendeePageSize));
    const page = Math.min(parsed.data.page, pageCount);
    const records = await tx.eventRegistration.findMany({ where: filter, select: attendeeSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * attendeePageSize, take: attendeePageSize });
    return { event, ...summary, records, total, page, pageCount };
  }, { isolationLevel: "RepeatableRead", maxWait: 10000, timeout: 15000 });
}

/** Uses the same parent-event lock as user participation to serialize cancellation/check-in races. */
export async function mutateAttendance(db: PrismaClient, userId: string, input: unknown, operation: "check-in" | "undo"): Promise<AttendeeActionState & { slug?: string }> {
  const target = attendeeTargetSchema.safeParse(input);
  if (!target.success) return { message: "This request is invalid. Reload the attendee list." };
  const { eventId, scope, registrationId } = target.data;
  try {
    return await db.$transaction(async (tx) => {
      const where = eventWhere(userId, eventId, scope);
      if (!await tx.event.findFirst({ where, select: { id: true } })) return { message: "You do not have permission to manage attendees for this event." };
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findFirst({ where, select: { id: true, slug: true, status: true } });
      if (!event) return { message: "Your event access changed. Reload the attendee list." };
      const registration = await tx.eventRegistration.findFirst({ where: { id: registrationId, eventId: event.id }, select: { id: true, status: true } });
      if (!registration) return { message: "This registration is unavailable for this event. Reload the attendee list." };
      if (!attendanceEditable(event.status)) return { message: "Attendance is read-only for this event’s current status." };
      const expected = operation === "check-in" ? "REGISTERED" : "ATTENDED";
      const next = operation === "check-in" ? "ATTENDED" : "REGISTERED";
      if (registration.status === next) return { ok: true, message: operation === "check-in" ? "This attendee is already checked in." : "This attendee is already registered.", slug: event.slug };
      if (registration.status !== expected) return { message: operation === "check-in" ? "Only registered attendees can be checked in." : "Only attended registrations can have check-in undone." };
      const updated = await tx.eventRegistration.updateMany({ where: { id: registration.id, eventId: event.id, status: expected }, data: { status: next, checkedInAt: operation === "check-in" ? new Date() : null, checkedInById: operation === "check-in" ? userId : null } });
      if (!updated.count) return { message: "This registration changed. Reload the attendee list." };
      return { ok: true, message: operation === "check-in" ? "Attendee checked in." : "Check-in undone. The attendee is registered again.", slug: event.slug };
    }, { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 15000 });
  } catch { return { message: "We couldn’t update attendance. Please try again shortly." }; }
}
