"use client";
import { useRef } from "react";
import { Search, X } from "lucide-react";
import styles from "./explore.module.css";
export function EventSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <form role="search" aria-label="Search demo events" onSubmit={(event) => event.preventDefault()} className={styles.search}>
    <Search aria-hidden="true" size={21} />
    <label htmlFor="event-search" className="sr-only">Search events, organizers, or places</label>
    <input ref={input} id="event-search" type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Find your next idea, connection, or experience…" autoComplete="off" />
    {value && <button type="button" aria-label="Clear search" onClick={() => { onChange(""); input.current?.focus(); }}><X aria-hidden="true" size={18} /></button>}
  </form>;
}
