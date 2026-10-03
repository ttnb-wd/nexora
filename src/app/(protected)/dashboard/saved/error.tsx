"use client";
import { buttonStyles } from "@/components/ui/button";
import styles from "@/features/auth/components/auth.module.css";
export default function DashboardError({ reset }: { reset: () => void }) {
  return <main id="main-content" className={styles.page}><div className={styles.card}><h1>A short pause.</h1><p className={styles.intro}>We couldn’t load your account. Please try again shortly.</p><button className={buttonStyles()} onClick={reset}>Try again</button></div></main>;
}
