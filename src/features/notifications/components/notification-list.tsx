"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "../server/actions";
import type { getUserNotifications } from "../server/queries";
import styles from "@/features/events/components/event-management.module.css";
import { buttonStyles } from "@/components/ui/button";
export function NotificationList({ notifications }: { notifications: Awaited<ReturnType<typeof getUserNotifications>> }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  function mark(id?: string) {
    startTransition(async () => {
      try {
        const result = await (id ? markNotificationRead(id) : markAllNotificationsRead());
        if (result.signIn) { router.push(result.signIn); return; }
        setMessage(result.message); router.refresh();
      } catch { setMessage("We could not update your notifications. Please try again."); }
    });
  }
  return <><button type="button" className={buttonStyles({ variant: "secondary" })} disabled={pending} onClick={() => mark()}>Mark all read</button>{message && <p role="status">{message}</p>}
    <div className={styles.grid}>{notifications.length ? notifications.map((item) => <article key={item.id} className={styles.card} aria-label={`${item.readAt ? "Read" : "Unread"}: ${item.title}`}>
      <p className={styles.eyebrow}>{item.readAt ? "READ" : "UNREAD"}</p><h2>{item.title}</h2><p>{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("en", { timeZone: "Asia/Yangon", dateStyle: "medium", timeStyle: "short" })} (Yangon)</time>
      {item.href && <p><Link href={item.href}>View details</Link></p>}{!item.readAt && <button type="button" className={buttonStyles({ variant: "secondary" })} disabled={pending} onClick={() => mark(item.id)}>Mark read</button>}
    </article>) : <section className={styles.card}><h2>You’re all caught up.</h2><p>New activity will appear here.</p></section>}</div></>;
}
