"use client";
import { motion, useReducedMotion } from "motion/react";
import { Asterisk } from "lucide-react";
import type { EventSpeaker } from "../types";
import { cn } from "@/lib/utils";
import art from "./event-artwork.module.css";
import styles from "./event-detail.module.css";
export function EventSpeakers({ speakers }: { speakers: EventSpeaker[] }) {
  const reduced = useReducedMotion();
  return <><p className={styles.sectionNote}>Meet the perspectives behind the conversation.</p><div className={styles.speakerGrid}>{speakers.map((speaker, index) => <motion.article key={`${index}-${speaker.name}`} className={styles.speaker} initial={false} whileInView={reduced === false ? { opacity: [0, 1], y: [14, 0] } : undefined} viewport={{ once: true, amount: .2 }} transition={{ duration: .4, delay: reduced ? 0 : index * .07 }}><div className={cn(styles.avatar, art[speaker.tone])} aria-hidden="true"><span>{speaker.name.split(" ").map((name) => name[0]).slice(0, 2).join("")}</span><Asterisk strokeWidth={1} /></div><div className={styles.speakerCopy}><h3>{speaker.name}</h3><p className={styles.speakerRole}>{speaker.role}{speaker.organizationName && <><br />{speaker.organizationName}</>}</p><p>{speaker.bio}</p></div></motion.article>)}</div></>;
}
