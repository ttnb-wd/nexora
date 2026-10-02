"use client";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import styles from "@/features/events/components/event-detail.module.css";
export default function EventError() {
  return <main id="main-content" className={styles.notFound}><Container><h1>This event is temporarily unavailable.</h1><p>Please try again shortly.</p><Link href="/explore">Back to Explore</Link></Container></main>;
}
