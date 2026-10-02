import { FloatingElement } from "@/components/animation/floating-element";
import styles from "./ambient-background.module.css";

/** Two moving light layers and one CSS mesh; no canvas, assets, or layout motion. */
export function AmbientBackground() {
  return <div className={styles.ambient} aria-hidden="true"><div className={styles.mesh} /><FloatingElement className={styles.violetLight} duration={22} distance={24} /><FloatingElement className={styles.cyanLight} duration={26} distance={18} delay={1} /></div>;
}
