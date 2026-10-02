import { BrainCircuit, BriefcaseBusiness, Cpu, GraduationCap, Palette, Rocket, UsersRound } from "lucide-react";
import { Container } from "@/components/layout/container";
import styles from "./category-strip.module.css";

const categories = [
  { label: "Technology", icon: Cpu, color: "#6635cf" },
  { label: "AI", icon: BrainCircuit, color: "#285ace" },
  { label: "Business", icon: BriefcaseBusiness, color: "#18818c" },
  { label: "Design", icon: Palette, color: "#ad3e87" },
  { label: "Startup", icon: Rocket, color: "#b96032" },
  { label: "Community", icon: UsersRound, color: "#7760bd" },
  { label: "Career", icon: GraduationCap, color: "#2a7f64" },
] as const;

export function CategoryStrip() {
  return <section aria-labelledby="categories-title" className={styles.section}><Container><div className={styles.heading}><h2 id="categories-title">Follow your curiosity.</h2><p>Seven interests. A world of possibilities.</p></div><ul tabIndex={0} aria-label="Event categories, scroll to see all categories" className={styles.list}>{categories.map(({ label, icon: Icon, color }) => <li key={label}><span style={{ color, background: `color-mix(in srgb, ${color} 10%, white)` }}><Icon size={16} aria-hidden="true" /></span>{label}</li>)}</ul></Container></section>;
}
