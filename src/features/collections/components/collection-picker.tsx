"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCollection, loadEventCollections, updateEventCollections } from "../server/actions";
import type { CollectionPickerData, CollectionResult } from "../schemas";
import styles from "./collections.module.css";

export function CollectionPicker({ slug, title, saved = true }: { slug: string; title: string; saved?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const label = useId(), router = useRouter();
  const [data, setData] = useState<CollectionPickerData | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false), [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CollectionResult | null>(null);
  useEffect(() => {
    const element = dialog.current;
    return () => {
      // Removing the last row can unmount an open picker and its trigger.
      if (element?.open) document.getElementById("main-content")?.focus();
    };
  }, []);
  async function open() {
    setData(null); setResult(null); setLoading(true); dialog.current?.showModal();
    try {
      const response = await loadEventCollections(slug);
      if (response.ok) { setData(response.data); setSelected(response.data.selectedIds); }
      else setResult({ ok: false, message: response.message });
    } catch { setResult({ ok: false, message: "We could not load your collections. Please try again." }); }
    finally { setLoading(false); }
  }
  function apply() {
    startTransition(async () => {
      try {
        const response = await updateEventCollections({ slug, collectionIds: selected });
        setResult(response);
        if (response.signIn) { dialog.current?.close(); router.push(response.signIn); return; }
        if (response.ok) {
          const refreshed = await loadEventCollections(slug);
          if (refreshed.ok) { setData(refreshed.data); setSelected(refreshed.data.selectedIds); }
          else setData(current => current ? { ...current, selectedIds: selected, saved: Boolean(response.saved) } : current);
          router.refresh();
        }
      } catch { setResult({ ok: false, message: "We could not update your collections. Please try again." }); }
    });
  }
  return <>
    <button ref={trigger} type="button" className={styles.pickerTrigger} aria-haspopup="dialog" aria-label={`Manage collections for ${title}`} onClick={open}>{saved ? "Manage collections" : "Add to collection"}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={label} onClose={() => { if (trigger.current?.isConnected) trigger.current.focus(); }} onClick={event => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current.close(); } }}>
      <div className={styles.dialogHeading}><h2 id={label}>Collections for {title}</h2><button type="button" autoFocus className={styles.secondary} onClick={() => dialog.current?.close()}>Close</button></div>
      <p>Private lists, just for you. An event can belong to more than one collection.</p>
      {loading && <p role="status">Loading your collections…</p>}
      {data && <>
        <fieldset disabled={pending} className={styles.choices}><legend>Choose collections</legend>{data.collections.length ? data.collections.map(collection => <label key={collection.id}><input type="checkbox" checked={selected.includes(collection.id)} onChange={event => setSelected(current => event.target.checked ? [...current, collection.id] : current.filter(id => id !== collection.id))} /><span>{collection.name}</span><small>{collection.count} {collection.count === 1 ? "event" : "events"}</small></label>) : <p>Create a collection to organize saved events.</p>}</fieldset>
        <form className={styles.form} onSubmit={event => {
          event.preventDefault(); const form = event.currentTarget, name = new FormData(form).get("name");
          startTransition(async () => {
            try {
              const response = await createCollection({ name }); setResult(response);
              if (response.ok && response.collection) {
                const collection = response.collection;
                setData(current => current ? { ...current, collections: [...current.collections, collection] } : current);
                setSelected(current => [...current, collection.id]); form.reset();
                setResult({ ok: true, message: "Collection created. Apply changes to add this event." }); router.refresh();
              }
            } catch { setResult({ ok: false, message: "We could not create your collection. Please try again." }); }
          });
        }}><label htmlFor={`${label}-name`}>New collection</label><div className={styles.inline}><input id={`${label}-name`} name="name" maxLength={60} required placeholder="e.g. Learning" disabled={pending || data.collections.length >= 50} /><button type="submit" className={styles.secondary} disabled={pending || data.collections.length >= 50}>Create collection</button></div></form>
        <p className={styles.hint}>{data.saved ? "Removing a collection keeps the event saved. Use Unsave separately to remove it from all lists." : "Applying a collection also saves this event."}</p>
        <div className={styles.actions}><button type="button" className={styles.primary} disabled={pending} onClick={apply}>{pending ? "Updating…" : "Apply changes"}</button><Link href="/dashboard/saved?view=collections" onClick={() => dialog.current?.close()}>View collections</Link></div>
      </>}
      {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? styles.success : styles.error}>{result.message}</p>}
    </dialog>
  </>;
}
