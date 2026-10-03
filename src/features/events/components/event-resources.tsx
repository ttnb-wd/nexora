import { BookOpen, FileText, Link2, Play, ArrowDownRight, Sparkles } from "lucide-react";
import type { Event } from "../types";
import styles from "./event-detail.module.css";
const resourceIcons = { Slides: FileText, Recording: Play, Links: Link2, Notes: BookOpen, Document: FileText, Other: Link2 };
export function EventResources({ event }: { event: Event }) {
  if (event.status === "upcoming" && !event.details.resources.length) return <div className={styles.resourcesSoon}><Sparkles aria-hidden="true" /><div><h3>The conversation doesn’t end here.</h3><p>Slides, recordings, and useful notes will find a home here after the event.</p><small>Post-event resources preview · nothing published yet</small></div></div>;
  if (!event.details.resources.length) return <p className={styles.sectionNote}>No resources published yet.</p>;
  return <>{event.source !== "database" && <p className={styles.sectionNote}>Revisit the ideas. These are resource previews; files and playback are not connected.</p>}<div className={styles.resourceGrid}>{event.details.resources.map((resource, index) => { const Icon = resourceIcons[resource.type]; return <details key={`${index}-${resource.title}`} className={styles.resource}><summary><Icon size={20} aria-hidden="true" /><span><small>{resource.type}</small><strong>{resource.title}</strong></span><ArrowDownRight size={17} aria-hidden="true" /></summary>{resource.description && <p>{resource.description}</p>}{resource.url && <p><a href={resource.url} target="_blank" rel="noopener noreferrer">Open {resource.title}</a></p>}</details>; })}</div></>;
}
