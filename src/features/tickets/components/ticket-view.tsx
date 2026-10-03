"use client";
import { useActionState } from "react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { issueEventTicket } from "../server/actions";
import type { TicketState } from "../types";
import styles from "./ticket.module.css";

export function TicketView({ slug, initial }: { slug: string; initial: TicketState }) {
  const [state, action, pending] = useActionState(issueEventTicket.bind(null, slug), initial);
  const ticket = state.ticket;
  return <main id="main-content" tabIndex={-1} className={styles.page}>
    <Link href="/dashboard/joined">← Joined events</Link>
    <article className={styles.card}>
      {ticket ? <>
        <p>NEXORA · EVENT TICKET</p><h1>{ticket.title}</h1>
        <p>{ticket.date}</p><p>{ticket.location} · {ticket.type}</p>
        <p>Attendee: <strong>{ticket.name}</strong></p><p>Status: Registered</p>
        {/* Local data URI; no remote image service receives ticket credentials. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ticket.qr} alt="Secure event ticket QR code. The full ticket token is also available below." className={styles.qr} width={320} height={320} />
        <p>Present this QR at check-in, or give the organizer this full ticket token:</p>
        <code className={styles.token}>{ticket.token}</code>
        <p>Keep your ticket private. A cancelled registration invalidates this ticket.</p>
        <div className={styles.controls}><button type="button" className={buttonStyles({ variant: "secondary" })} onClick={() => window.print()}>Print ticket</button><Link href={`/events/${ticket.slug}`}>Event details</Link></div>
      </> : <><h1>Your event ticket</h1><p>A ticket is available for your registered place while the published event has not ended.</p><form action={action}><button className={buttonStyles()} disabled={pending}>{pending ? "Loading ticket…" : "View ticket"}</button></form></>}
      {state.message && <p role="status">{state.message}</p>}
    </article>
  </main>;
}
