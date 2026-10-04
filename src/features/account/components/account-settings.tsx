"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/features/auth/client";
import { EmailRequestForm } from "@/features/auth/components/lifecycle-form";
import { accountMutationSchema } from "../schemas";
import type { AccountSettings } from "../types";
import styles from "./settings.module.css";

function SettingsForm({ action, children, label, onSuccess }: { action: "profile" | "password" | "preferences"; children: ReactNode; label: string; onSuccess: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const form = event.currentTarget;
    const parsed = accountMutationSchema.safeParse({ ...Object.fromEntries(new FormData(form)), action });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const result = await response.json();
      if (!response.ok) { setError(result.message || "Unable to save your changes. Please try again."); return; }
      if (action === "password") form.reset();
      setMessage(action === "password" ? "Password changed. Other sessions were signed out; this browser has a new session." : "Changes saved.");
      await onSuccess();
    } catch { setError("Unable to save your changes. Please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} noValidate aria-busy={busy}><fieldset disabled={busy} aria-describedby={error ? `${action}-error` : undefined}><legend className="sr-only">{label}</legend>{children}<button type="submit">{busy ? "Saving…" : label}</button></fieldset>{error && <p id={`${action}-error`} className={styles.error} role="alert">{error}</p>}{message && <p role="status" className={styles.success}>{message}</p>}</form>;
}
function date(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC"; }
export function AccountSettingsView({ account: initial, timezones }: { account: AccountSettings; timezones: string[] }) {
  const [account, setAccount] = useState(initial), [visible, setVisible] = useState(false), [pending, setPending] = useState(false), [sessionMessage, setSessionMessage] = useState(""), [sessionError, setSessionError] = useState("");
  const router = useRouter();
  async function refresh() {
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (!response.ok) throw new Error("Refresh unavailable");
      setAccount(await response.json());
      await authClient.getSession({ query: { disableCookieCache: true } });
      router.refresh();
    } catch { setSessionError("Changes were saved, but account details could not refresh. Please reload this page."); }
  }
  async function revoke(event: FormEvent<HTMLFormElement>, sessionId?: string) {
    event.preventDefault(); const form = event.currentTarget; setSessionMessage(""); setSessionError("");
    if (new FormData(form).get("confirm") !== "on") { setSessionError("Confirm the session sign-out first."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: sessionId ? "revoke" : "revokeOthers", ...(sessionId ? { sessionId } : {}), confirm: true }) });
      if (!response.ok) { const result = await response.json(); setSessionError(result.message || "Unable to sign out sessions. Please try again."); return; }
      form.reset(); setSessionMessage("Selected sessions signed out."); await refresh();
    } catch { setSessionError("Unable to sign out sessions. Please try again."); }
    finally { setPending(false); }
  }
  return <><nav aria-label="Settings sections" className={styles.sections}>{["Profile", "Email", "Security", "Sessions", "Preferences"].map(label => <a key={label} href={"#" + label.toLowerCase()}>{label}</a>)}</nav>
    <section id="profile" aria-labelledby="profile-title"><h2 id="profile-title">Profile</h2><p>Your name may appear publicly as an event organizer or wherever Nexora already shows your name. Your email and security details remain private.</p><SettingsForm action="profile" label="Save profile" onSuccess={refresh}><label htmlFor="display-name">Display name</label><input id="display-name" name="name" autoComplete="name" minLength={2} maxLength={80} defaultValue={account.name} required /></SettingsForm></section>
    <section id="email" aria-labelledby="email-title"><h2 id="email-title">Email</h2><p className={styles.email}>{account.email}</p><p className={account.emailVerified ? styles.success : styles.notice}>{account.emailVerified ? "Verified" : "Not verified"}</p><p>Email address changes are not available yet.</p>{!account.emailVerified && <EmailRequestForm kind="verification" initialEmail={account.email} />}</section>
    <section id="security" aria-labelledby="security-title"><h2 id="security-title">Password / Security</h2><p id="password-policy">Use 12–128 characters. Changing your password signs out other sessions and keeps this browser signed in with a new session.</p><SettingsForm action="password" label="Change password and sign out other sessions" onSuccess={refresh}>
      <label htmlFor="current-password">Current password</label><input id="current-password" name="currentPassword" type={visible ? "text" : "password"} autoComplete="current-password" maxLength={128} required />
      <label htmlFor="new-password">New password</label><input id="new-password" name="newPassword" type={visible ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="password-policy" required />
      <label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" maxLength={128} required />
      <button type="button" className={styles.secondary} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Hide passwords" : "Show passwords"}</button>
    </SettingsForm><Link href="/forgot-password">Forgot your current password?</Link></section>
    <section id="sessions" aria-labelledby="sessions-title"><h2 id="sessions-title">Sessions</h2><p>Only you can view these details. IP addresses and session credentials are never shown. Times below are in UTC.</p>{!account.sessionsAvailable ? <p role="status">Sign in again to view your sessions. <Link href="/sign-in?reauthenticate=1&returnTo=%2Fdashboard%2Fsettings">Sign in</Link></p> : <><ul className={styles.sessions}>{account.sessions.map(session => <li key={session.id}><h3>{session.device}{session.current ? " · Current session" : ""}</h3><p>Created: {date(session.createdAt)}<br />Updated: {date(session.updatedAt)}<br />Expires: {date(session.expiresAt)}</p>{!session.current && <form onSubmit={event => revoke(event, session.id)}><fieldset disabled={pending}><label className={styles.check}><input name="confirm" type="checkbox" />Confirm sign out of this session</label><button type="submit" className={styles.secondary}>Sign out this session</button></fieldset></form>}</li>)}</ul>{account.sessions.some(session => !session.current) && <form onSubmit={event => revoke(event)}><fieldset disabled={pending}><label className={styles.check}><input name="confirm" type="checkbox" />Confirm sign out of all other sessions</label><button type="submit">Sign out all other sessions</button></fieldset></form>}</>}{sessionError && <p role="alert" className={styles.error}>{sessionError}</p>}{sessionMessage && <p role="status" className={styles.success}>{sessionMessage}</p>}</section>
    <section id="preferences" aria-labelledby="preferences-title"><h2 id="preferences-title">Preferences</h2><p id="timezone-hint">Optional timezone for future display preferences. Event schedules and their timezones stay unchanged.</p><SettingsForm action="preferences" label="Save preferences" onSuccess={refresh}><label htmlFor="timezone">Timezone</label><input id="timezone" name="timezone" list="timezone-options" defaultValue={account.timezone ?? ""} maxLength={100} placeholder="Asia/Yangon" aria-describedby="timezone-hint" /><datalist id="timezone-options"><option value="UTC" />{timezones.map(zone => <option key={zone} value={zone} />)}</datalist></SettingsForm></section>
  </>;
}
