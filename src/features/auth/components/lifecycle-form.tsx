"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { emailRequestSchema, resetPasswordSchema } from "../schemas";
import { buttonStyles } from "@/components/ui/button";
import styles from "./auth.module.css";

export function EmailRequestForm({ kind, initialEmail = "" }: { kind: "verification" | "forgot"; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  const [error, setError] = useState(""), [cooldown, setCooldown] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const parsed = emailRequestSchema.safeParse({ email });
    if (!parsed.success) { setError("Enter a valid email address."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${kind === "forgot" ? "request-password-reset" : "send-verification-email"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!response.ok) { setError("This request could not be completed. Please try again shortly."); return; }
      setSent(true); setCooldown(true); setTimeout(() => setCooldown(false), 60000);
    } catch { setError("This request could not be completed. Please try again shortly."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} noValidate aria-busy={busy}>
    <fieldset disabled={busy} className={styles.fields}><legend className="sr-only">Email instructions</legend>
      <div className={styles.field}><label htmlFor="recovery-email">Email</label><input id="recovery-email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "recovery-error" : undefined} /></div>
      <button type="submit" disabled={cooldown} className={buttonStyles({ className: styles.submit })}>{busy ? "Sending request…" : cooldown ? "Wait 60 seconds to request again" : kind === "forgot" ? "Send reset instructions" : "Resend verification email"}</button>
    </fieldset>
    {sent && <p role="status" className={styles.intro}>If an account exists for that email, we sent instructions. Check your inbox and spam folder.</p>}
    {error && <p id="recovery-error" role="alert" className={styles.error}>{error}</p>}
  </form>;
}
export function CheckEmail({ email }: { email: string }) {
  return <div className={styles.card}><h1>Check your email</h1><p className={styles.intro}>We requested a verification email for {email}. Please verify your email before continuing. If it has not arrived, request another below.</p><EmailRequestForm kind="verification" initialEmail={email} /><p className={styles.switch}><Link href="/sign-in">Sign in</Link></p></div>;
}
export function ResetPasswordForm({ token, invalid }: { token?: string; invalid?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [success, setSuccess] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const parsed = resetPasswordSchema.safeParse({ token, newPassword: password, confirmPassword: confirmation });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!response.ok) { setError("This reset link could not be used. Request a new one and try again."); return; }
      setPassword(""); setConfirmation(""); setSuccess(true);
      // Remove the bearer token from browser history once it has been consumed.
      window.history.replaceState(null, "", "/reset-password");
      router.replace("/sign-in?reset=success");
      router.refresh();
    } catch { setError("Unable to reset your password. Please try again shortly."); }
    finally { setBusy(false); }
  }
  if (success) return <><h1>Password updated</h1><p role="status" className={styles.intro}>Your password has changed. Sign in with your new password. Previous sessions have been signed out.</p><Link className={buttonStyles()} href="/sign-in">Sign in</Link></>;
  if (!token || invalid) return <><h1>Request a new link</h1><p className={styles.intro}>This reset link could not be used. Please request a new one.</p><Link className={buttonStyles()} href="/forgot-password">Forgot password</Link></>;
  return <><h1>Set a new password</h1><p id="reset-hint" className={styles.intro}>Use 12–128 characters. A longer passphrase works well.</p><form onSubmit={submit} noValidate aria-busy={busy}><fieldset className={styles.fields} disabled={busy}><legend className="sr-only">New password</legend>
    {[["new-password", "New password", password, setPassword], ["confirm-password", "Confirm password", confirmation, setConfirmation]].map(([id, label, value, setter]) => <div className={styles.field} key={id as string}><label htmlFor={id as string}>{label as string}</label><input id={id as string} type={visible ? "text" : "password"} autoComplete="new-password" maxLength={128} value={value as string} onChange={event => (setter as typeof setPassword)(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "reset-error" : "reset-hint"} /></div>)}
    <button type="button" onClick={() => setVisible(value => !value)} aria-pressed={visible} className={styles.visibility}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}{visible ? "Hide passwords" : "Show passwords"}</button>
    <button className={buttonStyles({ className: styles.submit })} type="submit">{busy ? "Updating password…" : "Update password"}</button></fieldset>{error && <p id="reset-error" role="alert" className={styles.error}>{error} <Link href="/forgot-password">Request a new link</Link></p>}</form></>;
}
