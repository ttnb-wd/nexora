import Link from "next/link";
import { Building2, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import styles from "@/features/organizations/components/organizations.module.css";
export default function OrganizationNotFound() {
  return <main id="main-content" tabIndex={-1} className={styles.notFound}><Container><span><Building2 size={34} aria-hidden="true" /></span><p className={styles.eyebrow}>A NEW POINT OF CONNECTION</p><h1>This organization isn’t here.</h1><p>We couldn’t find that profile. There are still curious people and shared possibilities to discover.</p><Link href="/companies" className={buttonStyles({size: "lg"})}>Explore organizations <ArrowUpRight aria-hidden="true" /></Link></Container></main>;
}
