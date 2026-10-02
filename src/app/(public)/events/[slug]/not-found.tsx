import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import styles from "@/features/events/components/event-detail.module.css";
export default function EventNotFound() {
  return <main id="main-content" tabIndex={-1} className={styles.notFound}><Container><span className={styles.notFoundMark}><Compass size={34} aria-hidden="true" /></span><p className={styles.eyebrow}>A DIFFERENT DIRECTION</p><h1>This moment isn’t here.</h1><p>We couldn’t find that event. There’s still a world of experiences to explore.</p><Link href="/explore" className={buttonStyles({ size: "lg" })}>Back to Explore <ArrowUpRight aria-hidden="true" /></Link></Container></main>;
}
