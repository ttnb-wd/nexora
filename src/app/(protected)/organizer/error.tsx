"use client";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import styles from "@/features/organizations/components/organizer.module.css";
export default function OrganizerError({ reset }: { reset: () => void }) {
  return <main id="main-content" className={styles.page}><Container><section className={styles.empty}><h1>A short pause.</h1><p>We couldn’t load your organizations. Please try again shortly.</p><Button onClick={reset}>Try again</Button></section></Container></main>;
}
