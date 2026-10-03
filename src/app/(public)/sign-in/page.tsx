import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/session";
import { AuthForm } from "@/features/auth/components/auth-form";
import { safeReturnPath } from "@/features/auth/return-path";
import styles from "@/features/auth/components/auth.module.css";

export const metadata = { title: "Sign in", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  if (await getCurrentUser()) redirect(returnTo);
  return <main id="main-content" tabIndex={-1} className={styles.page}><AuthForm mode="sign-in" returnTo={returnTo} /></main>;
}
