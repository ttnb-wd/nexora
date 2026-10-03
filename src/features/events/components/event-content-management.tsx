import type { EventAgendaItem, EventSpeaker, EventResource } from "@/generated/prisma/client";
import { contentEditable, resourceTypeLabels, type ContentKind } from "../content-schemas";
import { utcToLocalInputs, formatManagedEventDate } from "../timezone";
import * as actions from "../server/content-actions";
import { EventContentForm, EventContentControl, type ContentValues } from "./event-content-form";
import styles from "./event-management.module.css";

const handlers = {
  agenda: { create: actions.createAgendaItem, update: actions.updateAgendaItem, delete: actions.deleteAgendaItem, move: actions.moveAgendaItem },
  speaker: { create: actions.createSpeaker, update: actions.updateSpeaker, delete: actions.deleteSpeaker, move: actions.moveSpeaker },
  resource: { create: actions.createResource, update: actions.updateResource, delete: actions.deleteResource, move: actions.moveResource },
};
const local = (date: Date, timezone: string) => { const parts = utcToLocalInputs(date, timezone); return `${parts.date}T${parts.time}`; };
export function EventContentManagement({ event, scope, canManage }: { event: { id: string; status: string; timezone: string; agendaItems: EventAgendaItem[]; speakers: EventSpeaker[]; resources: EventResource[] }; scope: string | null; canManage: boolean }) {
  const sections: { kind: ContentKind; title: string; rows: (EventAgendaItem | EventSpeaker | EventResource)[] }[] = [{ kind: "agenda", title: "Agenda", rows: event.agendaItems }, { kind: "speaker", title: "Speakers", rows: event.speakers }, { kind: "resource", title: "Resources", rows: event.resources }];
  return <div className={styles.contentSections}>{sections.map(({ kind, title, rows }) => {
    const editable = canManage && contentEditable(event.status, kind);
    const handler = handlers[kind];
    const orderVersion = JSON.stringify(rows.map((row) => row.id));
    return <section key={kind} className={styles.card} aria-labelledby={`manage-${kind}`}><h2 id={`manage-${kind}`}>{title}</h2>{!editable && <p className={styles.hint}>This section is read-only.</p>}{!rows.length && <p className={styles.hint}>No {title.toLowerCase()} added yet.</p>}
      <ol className={styles.contentList}>{rows.map((row, index) => {
        const label = "name" in row ? row.name : row.title;
        const values: ContentValues = { itemId: row.id, version: row.updatedAt.toISOString() };
        if ("startAt" in row) Object.assign(values, { title: row.title, description: row.description ?? "", startAt: local(row.startAt, event.timezone), endAt: row.endAt ? local(row.endAt, event.timezone) : "", locationLabel: row.locationLabel ?? "" });
        else if ("name" in row) Object.assign(values, { name: row.name, role: row.role ?? "", company: row.company ?? "", bio: row.bio ?? "" });
        else Object.assign(values, { title: row.title, type: row.type, url: row.url, description: row.description ?? "" });
        return <li key={row.id} className={styles.contentItem}><h3>{label}</h3>{"startAt" in row ? <p className={styles.hint}>{formatManagedEventDate(row.startAt, event.timezone)}{row.endAt && ` – ${formatManagedEventDate(row.endAt, event.timezone)}`}{row.locationLabel && ` · ${row.locationLabel}`}</p> : "name" in row ? <><p className={styles.hint}>{[row.role, row.company].filter(Boolean).join(" · ")}</p><p className={styles.description}>{row.bio}</p></> : <><p className={styles.hint}>{resourceTypeLabels[row.type]} · <a href={row.url} target="_blank" rel="noopener noreferrer">{row.title}</a></p><p className={styles.description}>{row.description}</p></>}
          {"startAt" in row && row.description && <p className={styles.description}>{row.description}</p>}
          {editable && <><details className={styles.contentEdit}><summary>Edit {label}</summary><EventContentForm key={`${row.id}-${values.version}`} action={handler.update.bind(null, event.id, scope)} kind={kind} values={values} timezone={event.timezone} edit /></details><div className={styles.actions}><EventContentControl action={handler.move.bind(null, event.id, scope)} values={{ itemId: row.id, direction: "up", orderVersion }} label={`Move ${label} up`} disabled={index === 0} /><EventContentControl action={handler.move.bind(null, event.id, scope)} values={{ itemId: row.id, direction: "down", orderVersion }} label={`Move ${label} down`} disabled={index === rows.length - 1} /><EventContentControl action={handler.delete.bind(null, event.id, scope)} values={{ itemId: row.id, version: values.version }} label={`Remove ${label}`} confirm /></div></>}
        </li>;
      })}</ol>{editable && <details className={styles.contentEdit}><summary>Add {kind === "agenda" ? "agenda item" : kind}</summary><EventContentForm action={handler.create.bind(null, event.id, scope)} kind={kind} timezone={event.timezone} /></details>}
    </section>;
  })}</div>;
}
