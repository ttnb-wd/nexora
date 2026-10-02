import { MapPin, Video, Navigation } from "lucide-react";
import type { Event } from "../types";
import styles from "./event-detail.module.css";
export function EventVenue({ event }: { event: Event }) {
  const online = event.type === "Online";
  return <div className={styles.venue}><div className={styles.map} aria-hidden="true"><div className={styles.mapRoad} /><div className={styles.mapPark} /><span>{online ? <Video size={28} /> : <MapPin size={28} />}</span><small>{online ? "CONNECTION / ANYWHERE" : "A NEW POINT OF CONNECTION"}</small></div><div className={styles.venueCopy}><p className={styles.eyebrow}>{event.type} EXPERIENCE</p><h3>{event.location.venue}</h3><p className={styles.address}><Navigation size={16} aria-hidden="true" />{event.location.city}</p><p>{event.details.venue.address}</p><p>{event.details.venue.guidance}</p><small>{online ? "Online access preview · no meeting link" : "Abstract map preview · no live map or directions"}</small></div></div>;
}
