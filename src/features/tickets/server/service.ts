import type { PrismaClient } from "@/generated/prisma/client";
import { eventWhere, transitionAttendance } from "../../attendees/server/service";
import { attendeeTargetSchema } from "../../attendees/schemas";
import { hashTicketToken, newTicket, parseTicketToken, ticketEligible, tokenFromNonce } from "../token";
import { allowTicketRequest } from "./rate-limit";
import type { ScanState } from "../types";

const ownerSelect = {
  id: true, status: true, ticketNonce: true, ticketTokenHash: true, ticketIssuedAt: true,
  user: { select: { name: true } },
  event: { select: { title: true, slug: true, status: true, startAt: true, endAt: true, timezone: true, locationName: true, city: true, eventType: true } },
} as const;

/** Identity is supplied only by the authenticated server boundary; never by a form. */
export async function loadOwnTicket(db: PrismaClient, userId: string, slug: string, secret: string, issue = false) {
  if (!/^[a-z0-9-]{1,128}$/.test(slug)) return null;
  if (issue && !await allowTicketRequest(db, userId, "issue")) return null;
  return db.$transaction(async tx => {
    if (issue) await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "slug" = ${slug} FOR UPDATE`;
    const row = await tx.eventRegistration.findFirst({ where: { userId, event: { slug } }, select: ownerSelect });
    if (!row) return null;
    // An attended viewer can revisit an existing ticket, but never issue a new one.
    if (row.status === "ATTENDED") {
      if (!["PUBLISHED", "COMPLETED"].includes(row.event.status) || !row.ticketNonce || !row.ticketTokenHash || !row.ticketIssuedAt) return null;
      const token = tokenFromNonce(row.ticketNonce, secret);
      return hashTicketToken(token) === row.ticketTokenHash ? { token, name: row.user.name, status: row.status, event: row.event } : null;
    }
    if (!ticketEligible(row.event, row.status)) return null;
    let token: string;
    if (!row.ticketNonce || !row.ticketTokenHash) {
      if (!issue) return null;
      const ticket = newTicket(secret);
      await tx.eventRegistration.update({ where: { id: row.id }, data: { ticketNonce: ticket.ticketNonce, ticketTokenHash: ticket.ticketTokenHash, ticketIssuedAt: ticket.ticketIssuedAt } });
      token = ticket.token;
    } else {
      token = tokenFromNonce(row.ticketNonce, secret);
      // Server-secret rotation fails closed; explicit ticket view issues a replacement.
      if (hashTicketToken(token) !== row.ticketTokenHash) {
        if (!issue) return null;
        const ticket = newTicket(secret);
        await tx.eventRegistration.update({ where: { id: row.id }, data: { ticketNonce: ticket.ticketNonce, ticketTokenHash: ticket.ticketTokenHash, ticketIssuedAt: ticket.ticketIssuedAt } });
        token = ticket.token;
      }
    }
    return { token, name: row.user.name, status: row.status, event: row.event };
  }, { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 15000 });
}

export async function checkInByTicket(db: PrismaClient, actorId: string, input: { eventId: string; scope: string | null; token: unknown }, appUrl: string | string[]): Promise<ScanState & { slug?: string }> {
  const target = attendeeTargetSchema.omit({ registrationId: true }).safeParse(input);
  if (!target.success) return { message: "This check-in request is invalid." };
  try {
    if (!await allowTicketRequest(db, actorId, "scan")) return { message: "Too many ticket attempts. Wait a minute and try again." };
    return await db.$transaction(async tx => {
      const { eventId, scope } = target.data;
      const where = eventWhere(actorId, eventId, scope);
      if (!await tx.event.findFirst({ where, select: { id: true } })) return { message: "You do not have permission to check in attendees for this event." };
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findFirst({ where, select: { id: true, slug: true, status: true, endAt: true } });
      if (!event) return { message: "Your event access changed. Reload the check-in page." };
      const token = parseTicketToken(input.token, appUrl);
      if (!token) return { message: "Ticket is invalid or unavailable." };
      const row = await tx.eventRegistration.findUnique({ where: { ticketTokenHash: hashTicketToken(token) }, select: { id: true, eventId: true, status: true, ticketIssuedAt: true } });
      if (!row) return { message: "Ticket is invalid or unavailable." };
      if (row.eventId !== event.id) return { message: "This ticket is for a different event." };
      if (!row.ticketIssuedAt || !["REGISTERED", "ATTENDED"].includes(row.status)) return { message: "Ticket is invalid or unavailable." };
      if (event.status !== "PUBLISHED" || event.endAt <= new Date()) return { message: "Ticket check-in is unavailable for this event." };
      const result = await transitionAttendance(tx, actorId, event, row, "check-in");
      if (!result.ok) return result;
      // Identity is fetched only after actor, event and ticket validation.
      const attendee = await tx.eventRegistration.findUnique({ where: { id: row.id }, select: { user: { select: { name: true } } } });
      return { ...result, name: attendee?.user.name };
    }, { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 15000 });
  } catch { return { message: "We couldn’t check this ticket. Please try again shortly." }; }
}
