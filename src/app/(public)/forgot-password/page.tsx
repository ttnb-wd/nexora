import Link from "next/link";
import { EmailRequestForm } from "@/features/auth/components/lifecycle-form";
import styles from "@/features/auth/components/auth.module.css";
export const metadata = { title: "Forgot password", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function Page() { return <main id="main-content" tabIndex={-1} className={styles.page}><div className={styles.card}><h1>Forgot your password?</h1><p className={styles.intro}>Enter your email to request secure password reset instructions.</p><EmailRequestForm kind="forgot" /><p className={styles.switch}><Link href="/sign-in">Back to sign in</Link></p></div></main>; }
