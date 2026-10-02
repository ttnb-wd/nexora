import Link from "next/link";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import styles from "@/features/events/components/event-management.module.css";
export default function NotFound() {
  return <main id="main-content" className={styles.page}><Container><section className={styles.empty}><h1>Event unavailable.</h1><p>This event could not be found or you do not have permission to access it.</p><Link href="/dashboard/events" className={buttonStyles()}>Your events</Link></section></Container></main>;
}
