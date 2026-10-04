"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, LayoutDashboard, Building2, Settings } from "lucide-react";
import { authClient } from "../client";
import { authErrorMessage } from "../errors";
import styles from "./account-menu.module.css";

export type AccountIdentity = { name: string; email: string };
export function AccountMenu({ user, onNavigate }: { user: AccountIdentity; onNavigate?: () => void }) {
  const details = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    function outside(event: PointerEvent) { if (event.target instanceof Node && !details.current?.contains(event.target)) details.current?.removeAttribute("open"); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function close() { details.current?.removeAttribute("open"); onNavigate?.(); }
  async function signOut() {
    setPending(true); setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) { setError(authErrorMessage(result.error)); return; }
      close(); router.replace("/sign-in"); router.refresh();
    } catch { setError(authErrorMessage(null)); }
    finally { setPending(false); }
  }
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "N";
  return <details ref={details} className={styles.menu} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); details.current?.removeAttribute("open"); details.current?.querySelector("summary")?.focus(); } }}>
    <summary aria-label={`Account for ${user.name}`}><span className={styles.avatar} aria-hidden="true">{initials}</span><span className={styles.name}>{user.name}</span><ChevronDown size={14} aria-hidden="true" /></summary>
    <div className={styles.dropdown}><p>{user.email}</p><Link href="/dashboard" onClick={close}><LayoutDashboard size={16} aria-hidden="true" />Dashboard</Link><Link href="/dashboard/settings" onClick={close}><Settings size={16} aria-hidden="true" />Account settings</Link><Link href="/organizer" onClick={close}><Building2 size={16} aria-hidden="true" />Organizer</Link><button type="button" disabled={pending} onClick={signOut}><LogOut size={16} aria-hidden="true" />{pending ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className={styles.error}>{error}</p>}</div>
  </details>;
}
