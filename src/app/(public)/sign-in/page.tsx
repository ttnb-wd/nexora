import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/session";
import { AuthForm } from "@/features/auth/components/auth-form";
import styles from "@/features/auth/components/auth.module.css";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <main id="main-content" tabIndex={-1} className={styles.page}><AuthForm mode="sign-in" /></main>;
}
