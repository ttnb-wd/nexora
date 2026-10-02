"use client";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import styles from "@/features/events/components/event-management.module.css";
export default function Error({ reset }: { reset: () => void }) {
  return <main id="main-content" className={styles.page}><Container><section className={styles.empty}><h1>A short pause.</h1><p>We couldn’t load your events. Please try again shortly.</p><Button onClick={reset}>Try again</Button></section></Container></main>;
}
