import { requireUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { getAuthEnvironment } from "@/lib/env";
import { loadOwnTicket } from "@/features/tickets/server/service";
import { displayTicket } from "@/features/tickets/server/display";
import { TicketView } from "@/features/tickets/components/ticket-view";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your event ticket", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const ticket = await loadOwnTicket(getDb(), user.id, slug, getAuthEnvironment().AUTH_SECRET);
  return <TicketView slug={slug} initial={ticket ? { ticket: displayTicket(ticket) } : {}} />;
}
