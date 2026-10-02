import Link from "next/link";
import { Asterisk, ArrowUpRight } from "lucide-react";
import { Container } from "./container";
import styles from "./site-footer.module.css";
export function SiteFooter() {
  return <footer className={styles.footer}><Container><div className={styles.top}><div><Link href="/" className={styles.brand} aria-label="Nexora home"><Asterisk aria-hidden="true" />nexora<span>.</span></Link><p>For the moments that move you.</p></div><nav aria-label="Footer navigation"><Link href="/explore">Explore <ArrowUpRight size={14} aria-hidden="true" /></Link><Link href="/companies">Companies <ArrowUpRight size={14} aria-hidden="true" /></Link><Link href="/create-event">Create Event <ArrowUpRight size={14} aria-hidden="true" /></Link></nav></div><div className={styles.bottom}><span>Stay curious. Come together.</span><div className={styles.placeholders}>{["About", "Privacy", "Terms"].map((label) => <details key={label}><summary>{label}</summary><p>{label} information is coming soon. Nexora is currently a UI demo.</p></details>)}</div><small>Nexora / 2026</small></div></Container></footer>;
}
