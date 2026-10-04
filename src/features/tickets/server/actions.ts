"use server";
import { getAuthorizedUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { getPublicAppUrl } from "@/lib/public-url-server";
import { getAuthEnvironment } from "@/lib/env";
import { revalidatePath } from "next/cache";
import { checkInByTicket, loadOwnTicket } from "./service";
import { displayTicket } from "./display";
import type { ScanState, TicketState } from "../types";

export async function issueEventTicket(slug: string, _previous: TicketState, _form: FormData): Promise<TicketState> {
  void _previous; void _form;
  try {
    const user = await getAuthorizedUser();
    if (!user) return { message: "Sign in to view your ticket." };
    const ticket = await loadOwnTicket(getDb(), user.id, slug, getAuthEnvironment().AUTH_SECRET, true);
    if (!ticket) return { message: "Ticket unavailable. You must be registered for a published event that has not ended. If you just tried several times, wait a minute." };
    return { ok: true, ticket: displayTicket(ticket) };
  } catch { return { message: "We couldn’t load your ticket. Please try again shortly." }; }
}
export async function scanEventTicket(eventId: string, scope: string | null, _previous: ScanState, form: FormData): Promise<ScanState> {
  try {
    const user = await getAuthorizedUser();
    if (!user) return { message: "Sign in to check in attendees." };
    const result = await checkInByTicket(getDb(), user.id, { eventId, scope, token: form.get("token") }, [getAuthEnvironment().APP_URL, getPublicAppUrl()]);
    if (result.ok) {
      const path = scope ? `/organizer/${scope}/events/${eventId}` : `/dashboard/events/${eventId}`;
      for (const value of [path, `${path}/attendees`, `${path}/check-in`, "/dashboard", "/dashboard/joined", "/dashboard/saved", `/events/${result.slug}`]) revalidatePath(value);
    }
    return { ok: result.ok, message: result.message, name: result.name };
  } catch { return { message: "We couldn’t check this ticket. Please try again shortly." }; }
}
