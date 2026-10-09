"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchHref, parseSearchParams, type SearchParams } from "../params";
import type { SearchSuggestion } from "../server/queries";
import styles from "./search.module.css";

export function GlobalSearch({ initialQuery = "", params, base = "/search", compact = false, onNavigate }: { initialQuery?: string; params?: SearchParams; base?: string; compact?: boolean; onNavigate?: () => void }) {
  const router = useRouter(), id = useId(), container = useRef<HTMLFormElement>(null), popup = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(initialQuery), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [response, setResponse] = useState<{ query: string; items: SearchSuggestion[]; failed?: boolean }>({ query: "", items: [] });
  const query = value.trim(), items = response.query === query ? response.items : [];
  const expanded = open && query.length >= 2;
  useEffect(() => {
    if (!expanded) return;
    function position() {
      if (!container.current || !popup.current) return;
      const rect = container.current.getBoundingClientRect(), viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? window.innerHeight);
      const below = bottom - rect.bottom - 64, above = rect.top - top - 64;
      const flip = below < 160 && above > below;
      popup.current.dataset.above = String(flip);
      popup.current.style.setProperty("--suggestion-height", `${Math.max(80, Math.min(384, flip ? above : below))}px`);
    }
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [expanded]);
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, expanded, id]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    if (!open || query.length < 2 || query.length > 100) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" });
        if (!result.ok) throw new Error("Unavailable");
        const data: { suggestions: SearchSuggestion[] } = await result.json();
        if (!controller.signal.aborted) { setResponse({ query, items: data.suggestions }); setActive(-1); }
      } catch { if (!controller.signal.aborted) setResponse({ query, items: [], failed: true }); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open]);
  function navigate(href: string) { setOpen(false); onNavigate?.(); router.push(href); }
  function submit() { navigate(searchHref(params ?? parseSearchParams({}), { q: query, page: 1 }, base)); }
  const hidden = params ? Object.entries(params).filter(([key]) => !["q", "page"].includes(key)) : [];
  return <form ref={container} role="search" aria-label="Global search" action={base} className={`${styles.search} ${compact ? styles.compact : ""}`} onSubmit={(event) => { event.preventDefault(); submit(); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    {hidden.map(([key, entry]) => <input key={key} type="hidden" name={key} value={entry} />)}
    <label htmlFor={`${id}-input`} className="sr-only">Search events, companies, speakers</label>
    <div className={styles.inputRow}><Search size={18} aria-hidden="true" /><input id={`${id}-input`} name="q" type="search" role="combobox" autoComplete="off" maxLength={100} placeholder="Search events, companies, speakers..." value={value} aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? `${id}-list` : undefined} aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
      onFocus={() => setOpen(true)} onChange={(event) => { setValue(event.target.value); setActive(-1); setOpen(true); }} onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); }
        else if (["ArrowDown", "ArrowUp"].includes(event.key) && query.length >= 2) { event.preventDefault(); setOpen(true); setActive((index) => event.key === "ArrowDown" ? (index + 1) % (items.length + 1) : (index <= 0 ? items.length : index - 1)); }
        else if (event.key === "Enter") { event.preventDefault(); if (expanded && active >= 0 && active < items.length) navigate(items[active].href); else submit(); }
      }} /><button type="submit" className={styles.submit} aria-label="Search"><Search size={18} aria-hidden="true" /><span>Search</span></button></div>
    {expanded && <div ref={popup} className={styles.suggestions}><ul id={`${id}-list`} role="listbox" aria-label="Search suggestions">
      {items.map((item, index) => <li key={`${item.type}-${item.href}-${index}`} id={`${id}-option-${index}`} role="option" aria-selected={active === index} onPointerDown={(event) => event.preventDefault()} onClick={() => navigate(item.href)}><span><strong>{item.label}</strong><small>{item.context}</small></span><em>{item.type}</em></li>)}
      <li id={`${id}-option-${items.length}`} role="option" aria-selected={active === items.length} onPointerDown={(event) => event.preventDefault()} onClick={submit}><span><strong>Search for “{query}”</strong><small>View all matching results</small></span><Search size={16} aria-hidden="true" /></li>
    </ul><p role="status">{response.query !== query ? "Finding suggestions…" : response.failed ? "Suggestions unavailable. Press Enter to search." : items.length ? `${items.length} suggestions. Use arrow keys and Enter.` : "No suggestions. Press Enter to search all results."}</p></div>}
  </form>;
}
