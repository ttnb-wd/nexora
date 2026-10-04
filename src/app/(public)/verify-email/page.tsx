import Link from "next/link";
import { getCurrentUser } from "@/features/auth/server/session";
import { EmailRequestForm } from "@/features/auth/components/lifecycle-form";
import styles from "@/features/auth/components/auth.module.css";
export const metadata = { title: "Verify email", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const query = await searchParams, user = await getCurrentUser();
  // A cosmetic callback flag must never override a signed-in user's actual state.
  const success = !query.error && (user?.emailVerified || (!user && query.success === "1"));
  return <main id="main-content" tabIndex={-1} className={styles.page}><div className={styles.card}><h1>{success ? "Email verified" : query.error ? "Request another verification link" : "Please verify your email"}</h1><p role="status" className={styles.intro}>{success ? "Your email verification is complete. You can continue to Nexora." : query.error ? "This link could not be used. Request a new verification email below." : "Check your inbox and verify your email before continuing."}</p>{!success && <EmailRequestForm kind="verification" initialEmail={user?.email ?? ""} />}<p className={styles.switch}><Link href={user?.emailVerified || user && !user.verificationRequired ? "/dashboard" : "/sign-in"}>{user?.emailVerified || user && !user.verificationRequired ? "Continue" : "Sign in"}</Link></p></div></main>;
}
