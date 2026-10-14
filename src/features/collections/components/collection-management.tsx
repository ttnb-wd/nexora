"use client";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCollection, renameCollection, deleteCollection } from "../server/actions";
import type { CollectionResult } from "../schemas";
import styles from "./collections.module.css";

export function CollectionManagement({ collection, count = 0 }: { collection?: { id: string; name: string }; count?: number }) {
  const label = useId(), dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), router = useRouter();
  const [pending, startTransition] = useTransition(), [result, setResult] = useState<CollectionResult | null>(null);
  function remove() {
    if (!collection) return;
    startTransition(async () => {
      try {
        const response = await deleteCollection({ id: collection.id, confirm: true }); setResult(response);
        if (response.ok) { dialog.current?.close(); router.push("/dashboard/saved?view=collections"); router.refresh(); }
      } catch { setResult({ ok: false, message: "We could not delete your collection. Please try again." }); }
    });
  }
  return <div className={styles.management}>
    <form className={styles.form} onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget, name = new FormData(form).get("name");
      startTransition(async () => {
        try {
          const response = await (collection ? renameCollection({ id: collection.id, name }) : createCollection({ name })); setResult(response);
          if (response.signIn) { router.push(response.signIn); return; }
          if (response.ok) { if (!collection) form.reset(); router.refresh(); }
        } catch { setResult({ ok: false, message: "We could not update your collection. Please try again." }); }
      });
    }}><label htmlFor={label}>{collection ? "Collection name" : "Create a collection"}</label><div className={styles.inline}><input id={label} name="name" defaultValue={collection?.name} placeholder="e.g. Weekend" maxLength={60} required disabled={pending || (!collection && count >= 50)} /><button className={styles.primary} disabled={pending || (!collection && count >= 50)}>{pending ? "Updating…" : collection ? "Rename collection" : "Create collection"}</button></div>{!collection && <p className={styles.hint}>{count} of 50 collections · Names can be up to 60 characters.</p>}</form>
    {collection && <><button ref={trigger} type="button" className={styles.secondary} aria-haspopup="dialog" onClick={() => { setResult(null); dialog.current?.showModal(); }} disabled={pending}>Delete collection</button><dialog ref={dialog} aria-labelledby={`${label}-delete`} className={styles.dialog} onClose={() => trigger.current?.focus()}><h2 id={`${label}-delete`}>Delete {collection.name}?</h2><p>This deletes the collection and its memberships. All of its events will remain saved.</p><div className={styles.actions}><button type="button" className={styles.secondary} autoFocus onClick={() => dialog.current?.close()}>Cancel</button><button type="button" className={styles.primary} disabled={pending} onClick={remove}>Confirm deletion</button></div>{result && !result.ok && <p role="alert">{result.message}</p>}</dialog></>}
    {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? styles.success : styles.error}>{result.message}</p>}
  </div>;
}
