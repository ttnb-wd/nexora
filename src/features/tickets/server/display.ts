import "server-only";
import qrcode from "qrcode-generator";
import { getAuthEnvironment } from "@/lib/env";
import { formatManagedEventDate } from "@/features/events/timezone";
import { ticketUrl } from "../token";
import type { loadOwnTicket } from "./service";
import type { TicketDisplay } from "../types";

export function displayTicket(ticket: NonNullable<Awaited<ReturnType<typeof loadOwnTicket>>>): TicketDisplay {
  const qr = qrcode(0, "M");
  qr.addData(ticketUrl(ticket.token, getAuthEnvironment().APP_URL));
  qr.make();
  return {
    token: ticket.token, name: ticket.name, status: ticket.status,
    title: ticket.event.title, slug: ticket.event.slug,
    date: `${formatManagedEventDate(ticket.event.startAt, ticket.event.timezone)} – ${formatManagedEventDate(ticket.event.endAt, ticket.event.timezone)} (${ticket.event.timezone})`,
    location: [ticket.event.locationName, ticket.event.city].filter(Boolean).join(", ") || "Online",
    type: ticket.event.eventType.replaceAll("_", " "),
    qr: `data:image/svg+xml;base64,${Buffer.from(qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true })).toString("base64")}`,
  };
}
