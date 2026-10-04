"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, Asterisk, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authClient } from "../client";
import { authErrorMessage } from "../errors";
import { signInSchema, signUpSchema } from "../schemas";
import { buttonStyles } from "@/components/ui/button";
import { safeReturnPath } from "@/features/auth/return-path";
import styles from "./auth.module.css";
import { CheckEmail } from "./lifecycle-form";

// Both modes share fields; only sign-up requires a name.
const signInFormSchema = signInSchema.extend({ name: z.string() });
type AuthFields = z.infer<typeof signUpSchema>;
export function AuthForm({ mode, returnTo = "/dashboard", passwordReset = false }: { mode: "sign-in" | "sign-up"; returnTo?: string; passwordReset?: boolean }) {
  const signup = mode === "sign-up";
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AuthFields>({
    resolver: zodResolver(signup ? signUpSchema : signInFormSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  async function submit(values: AuthFields) {
    setError(null);
    try {
      const result = signup ? await authClient.signUp.email(values) : await authClient.signIn.email({ email: values.email, password: values.password });
      if (result.error) { setError(authErrorMessage(result.error)); return; }
      if (signup) { setConfirmationEmail(values.email); return; }
      // Only an explicitly allowed internal return path is used.
      router.replace(safeReturnPath(returnTo));
      router.refresh();
    } catch { setError(authErrorMessage(null)); }
  }
  if (confirmationEmail) return <CheckEmail email={confirmationEmail} />;
  return <div className={styles.card}>
    <span className={styles.mark} aria-hidden="true"><Asterisk size={30} /></span>
    <p className={styles.eyebrow}>YOUR NEXT CONNECTION</p>
    <h1>{signup ? "A little curiosity goes a long way." : "Good to see you again."}</h1>
    <p className={styles.intro}>{signup ? "Create your Nexora account and make room for what comes next." : "Sign in to your Nexora account."}</p>
    {passwordReset && <p role="status" className={styles.intro}>Your password has changed. Sign in with your new password. Previous sessions have been signed out.</p>}
    <form onSubmit={handleSubmit(submit)} noValidate aria-busy={isSubmitting}>
      <fieldset disabled={isSubmitting} className={styles.fields}>
        <legend className="sr-only">{signup ? "Create account" : "Sign in"} details</legend>
        {signup && <div className={styles.field}><label htmlFor="auth-name">Name</label><input id="auth-name" autoComplete="name" maxLength={80} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} {...register("name")} />{errors.name && <p id="name-error" className={styles.fieldError}>{errors.name.message}</p>}</div>}
        <div className={styles.field}><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" inputMode="email" autoComplete="email" maxLength={254} spellCheck={false} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />{errors.email && <p id="email-error" className={styles.fieldError}>{errors.email.message}</p>}</div>
        <div className={styles.field}><label htmlFor="auth-password">Password</label><div className={styles.password}><input id="auth-password" type={visible ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} maxLength={128} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : signup ? "password-hint" : undefined} {...register("password")} /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></div>{errors.password ? <p id="password-error" className={styles.fieldError}>{errors.password.message}</p> : signup && <p id="password-hint" className={styles.hint}>Use at least 12 characters. A longer passphrase works well.</p>}</div>
        <button type="submit" className={buttonStyles({ className: styles.submit })}>{isSubmitting ? <><LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />{signup ? "Creating account…" : "Signing in…"}</> : <>{signup ? "Create account" : "Sign in"}<ArrowUpRight size={18} aria-hidden="true" /></>}</button>
      </fieldset>
      {error && <p role="alert" className={styles.error}>{error} {error.includes("verify your email") && <Link href="/verify-email">Resend verification email</Link>}</p>}
    </form>
    {!signup && <p className={styles.switch}><Link href="/forgot-password">Forgot password?</Link></p>}
    <p className={styles.switch}>{signup ? "Already found your people?" : "New to Nexora?"} <Link href={`${signup ? "/sign-in" : "/get-started"}?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`}>{signup ? "Sign in" : "Create an account"}</Link></p>
  </div>;
}
