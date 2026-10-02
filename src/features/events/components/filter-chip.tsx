import { X } from "lucide-react";
import styles from "./explore.module.css";
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <button className={styles.chip} type="button" onClick={onRemove} aria-label={`Remove filter: ${label}`}><span>{label}</span><X size={14} aria-hidden="true" /></button>;
}
