import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/session";
import { AuthForm } from "@/features/auth/components/auth-form";
import styles from "@/features/auth/components/auth.module.css";
import { safeReturnPath } from "@/features/auth/return-path";

export const metadata = { title: "Get started", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  if (await getCurrentUser()) redirect(returnTo);
  return <main id="main-content" tabIndex={-1} className={styles.page}><AuthForm mode="sign-up" returnTo={returnTo} /></main>;
}
