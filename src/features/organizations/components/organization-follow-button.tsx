"use client";
import { motion, useReducedMotion } from "motion/react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrganizationFollow } from "@/features/follows/components/follow-provider";
import styles from "./organizations.module.css";
export function OrganizationFollowButton({ name, slug, className }: { name: string; slug: string; className?: string }) {
  const { following: value, pending, message, toggle } = useOrganizationFollow(slug);
  const reduced = useReducedMotion();
  // Keep tap-gesture keyboard focus identical during server rendering and hydration.
  return <><motion.button type="button" tabIndex={0} className={cn(styles.follow, className)} aria-label={`${value ? "Unfollow" : "Follow"} ${name}`} aria-pressed={value} disabled={pending} onClick={toggle} whileTap={reduced === false ? { scale: .97 } : undefined}><motion.span initial={false} animate={reduced === false ? { scale: value ? [0.85, 1] : 1 } : { scale: 1 }} transition={{ duration: reduced ? 0 : .18 }}>{value ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}</motion.span>{value ? "Following" : "Follow"}</motion.button>{message && <p className={styles.followStatus} role="status">{message}</p>}</>;
}
