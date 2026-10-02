import Link from "next/link";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import styles from "@/features/organizations/components/organizer.module.css";
export default function OrganizationNotFound() {
  return <main id="main-content" className={styles.page}><Container><section className={styles.empty}><h1>Organization unavailable.</h1><p>This organization could not be found or you do not have permission to access it.</p><Link href="/organizer" className={buttonStyles()}>Your organizations</Link></section></Container></main>;
}
