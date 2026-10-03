"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { siteConfig, isNavigationActive } from "@/config/site";
import { motionTokens } from "@/config/motion";
import { AccountMenu, type AccountIdentity } from "@/features/auth/components/account-menu";
import styles from "./site-header.module.css";

export function MobileNav({ onClose, user }: { onClose: () => void; user?: AccountIdentity }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleResize = () => { if (desktop.matches) onClose(); };
    desktop.addEventListener("change", handleResize);
    window.addEventListener("popstate", onClose);
    return () => {
      desktop.removeEventListener("change", handleResize);
      window.removeEventListener("popstate", onClose);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);

  const duration = reducedMotion === false ? motionTokens.duration.normal : 0;
  return (
    <motion.dialog ref={dialogRef} id="mobile-navigation" aria-labelledby="mobile-nav-title" className={styles.dialog}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary, [tabindex="0"]')).filter((control) => control.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div className={styles.drawer} initial={{ x: reducedMotion === false ? 40 : 0 }} animate={{ x: 0 }} exit={{ x: reducedMotion === false ? 40 : 0 }} transition={{ duration, ease: motionTokens.ease.premium }}>
        <div className={styles.drawerTop}><h2 id="mobile-nav-title">Your next direction.</h2><button type="button" className={styles.closeButton} aria-label="Close navigation" onClick={onClose}><X size={20} aria-hidden="true" /></button></div>
        <p className={styles.drawerEyebrow}>GO WHERE CURIOSITY TAKES YOU</p>
        <nav aria-label="Mobile navigation" className={styles.drawerLinks}>
          {siteConfig.navigation.map((item, index) => <Link key={item.href} href={item.href} onClick={onClose} aria-current={isNavigationActive(pathname, item.href) ? "page" : undefined}><small>0{index + 1}</small>{item.label}<ArrowUpRight size={22} aria-hidden="true" /></Link>)}
        </nav>
        <Link href="/explore#event-search" onClick={onClose} className={styles.drawerSearch}><Search size={18} aria-hidden="true" />Search events<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <div className={styles.drawerActions}>{user ? <AccountMenu user={user} onNavigate={onClose} /> : <><Link href="/sign-in" onClick={onClose} className={buttonStyles({ variant: "secondary" })}>Sign in</Link><Link href="/get-started" onClick={onClose} className={buttonStyles()}>Get started <ArrowUpRight aria-hidden="true" /></Link></>}</div>
        <p className={styles.drawerNote}>New ideas. New places. Your next connection.</p>
      </motion.div>
    </motion.dialog>
  );
}
