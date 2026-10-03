"use client";
import { motion, useReducedMotion } from "motion/react";
import type { Event } from "../types";
import styles from "./event-detail.module.css";
export function EventAgenda({ event }: { event: Event }) {
  const reduced = useReducedMotion();
  return <ol className={styles.timeline}>{event.details.agenda.map((item, index) => <motion.li key={`${index}-${item.title}`} initial={false} whileInView={reduced === false ? { opacity: [0, 1], y: [12, 0] } : undefined} viewport={{ once: true, amount: .2 }} transition={{ duration: .4, delay: reduced ? 0 : index * .06 }}><time dateTime={item.startAt ?? `${event.date}T${item.time}:00+06:30`}>{item.time}</time><div className={styles.timelineCopy}><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{item.locationLabel && <p>{item.locationLabel}</p>}</div></motion.li>)}</ol>;
}
