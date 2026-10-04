import { ResetPasswordForm } from "@/features/auth/components/lifecycle-form";
import styles from "@/features/auth/components/auth.module.css";
export const metadata = { title: "Reset password", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) { const query = await searchParams; return <main id="main-content" tabIndex={-1} className={styles.page}><div className={styles.card}><ResetPasswordForm token={query.token} invalid={Boolean(query.error)} /></div></main>; }
