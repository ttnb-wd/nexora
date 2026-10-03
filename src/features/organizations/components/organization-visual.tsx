import { Asterisk, Orbit, Sparkles, Waves, Layers3, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicOrganization } from "../types";
import styles from "./organizations.module.css";
const symbols = { asterisk: Asterisk, orbit: Orbit, spark: Sparkles, waves: Waves, blocks: Layers3, northstar: Compass };
export function OrganizationVisual({ organization, size = "tile", className }: { organization: PublicOrganization; size?: "tile" | "banner" | "mark"; className?: string }) {
  const Symbol = symbols[organization.logoVariant];
  return <div className={cn(styles.visual, styles[organization.visualTheme], styles[size], className)} aria-hidden="true"><div className={styles.pattern}><i /><i /><i /></div><Symbol className={styles.symbol} strokeWidth={1.2} />{size !== "mark" && <><span className={styles.visualLabel}>{organization.industry} / NEXORA ORGANIZATIONS</span><strong className={styles.monogram}>{organization.shortName}</strong><span className={styles.visualFooter}>A PLACE FOR POSSIBILITY</span></>}</div>;
}
