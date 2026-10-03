"use client";
import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resourceTypes, resourceTypeLabels, type ContentKind, type ContentState } from "../content-schemas";
import styles from "./event-management.module.css";

type Action = (state: ContentState, form: FormData) => Promise<ContentState>;
export type ContentValues = Record<string, string>;
export function EventContentForm({ action, kind, values = {}, timezone, edit = false }: { action: Action; kind: ContentKind; values?: ContentValues; timezone: string; edit?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) { if (!edit) form.current?.reset(); router.refresh(); }
    else if (state.message) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state, edit, router]);
  const fields = kind === "agenda" ? [["title", "Title"], ["description", "Description"], ["startAt", "Start date and time"], ["endAt", "End date and time (optional)"], ["locationLabel", "Location label"]] : kind === "speaker" ? [["name", "Name"], ["role", "Role"], ["company", "Company"], ["bio", "Bio"]] : [["title", "Title"], ["type", "Type"], ["url", "URL"], ["description", "Description"]];
  return <form ref={form} action={formAction}>
    {values.itemId && <><input type="hidden" name="itemId" value={values.itemId} /><input type="hidden" name="version" value={values.version} /></>}
    {kind === "agenda" && <p className={styles.hint}>Dates and times use {timezone} and must fall within the event schedule.</p>}
    <fieldset className={styles.fields} disabled={pending}><legend className={styles.srOnly}>{edit ? "Edit" : "Add"} {kind}</legend>{fields.map(([name, label]) => {
      const errors = state.errors?.[name];
      const props = { id: `${id}-${name}`, name, defaultValue: values[name] ?? "", "aria-invalid": errors?.length ? true as const : undefined, "aria-describedby": errors?.length ? `${id}-${name}-error` : undefined, required: ["title", "name", "startAt", "type", "url"].includes(name) };
      return <div key={name} className={["description", "bio", "url"].includes(name) ? styles.full : undefined}><label htmlFor={props.id}>{label}</label>{name === "type" ? <select {...props} defaultValue={values.type ?? "LINK"}>{resourceTypes.map((type) => <option key={type} value={type}>{resourceTypeLabels[type]}</option>)}</select> : ["description", "bio"].includes(name) ? <textarea {...props} maxLength={5000} /> : <input {...props} type={["startAt", "endAt"].includes(name) ? "datetime-local" : name === "url" ? "url" : "text"} maxLength={name === "url" ? 2048 : 200} />}{errors?.length ? <p id={`${id}-${name}-error`} className={styles.error}>{errors.join(" ")}</p> : null}</div>;
    })}</fieldset>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? styles.hint : styles.error}>{state.message}</p>}
    <div className={styles.actions}><Button type="submit" disabled={pending}>{pending ? "Saving…" : edit ? "Save changes" : `Add ${kind === "agenda" ? "agenda item" : kind}`}</Button></div>
  </form>;
}
export function EventContentControl({ action, values, label, disabled = false, confirm = false }: { action: Action; values: ContentValues; label: string; disabled?: boolean; confirm?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);
  return <form action={formAction} onSubmit={(event) => { if (confirm && !window.confirm("Remove this item?")) event.preventDefault(); }}>{Object.entries(values).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<Button type="submit" variant={confirm ? "destructive" : "outline"} size="sm" disabled={pending || disabled}>{label}</Button>{state.message && !state.ok && <p role="alert" className={styles.error}>{state.message}</p>}</form>;
}
