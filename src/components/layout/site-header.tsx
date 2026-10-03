"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { ArrowUpRight, Asterisk, Bell, Grid2X2, Search } from "lucide-react";
import { Container } from "@/components/layout/container";
import { MobileNav } from "@/components/layout/mobile-nav";
import { buttonStyles } from "@/components/ui/button";
import { siteConfig, isNavigationActive } from "@/config/site";
import { authClient } from "@/features/auth/client";
import { AccountMenu } from "@/features/auth/components/account-menu";
import styles from "./site-header.module.css";

function subscribeScroll(notify: () => void) {
  window.addEventListener("scroll", notify, { passive: true });
  return () => window.removeEventListener("scroll", notify);
}

export function SiteHeader({ unreadCount = null, authenticated = false }: { unreadCount?: number | null; authenticated?: boolean }) {
  const { data: session } = authClient.useSession();
  const elevated = useSyncExternalStore(subscribeScroll, () => window.scrollY > 16, () => false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const pathname = usePathname();

  const signedIn = authenticated || Boolean(session?.user);
  const bell = <Link href="/dashboard/notifications" className={styles.bell} aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}><Bell size={18} aria-hidden="true" />{unreadCount !== null && unreadCount > 0 && <span className={styles.badge} aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Link>;
  return (
    <header className={styles.header} data-elevated={elevated}>
      <Container className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Nexora home"><span><Asterisk aria-hidden="true" /></span>nexora<i>.</i></Link>
        <nav aria-label="Main navigation" className={styles.desktopNav}>
          {siteConfig.navigation.map((item) => <Link key={item.href} href={item.href} aria-current={isNavigationActive(pathname, item.href) ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <div className={styles.actions}>
          <Link href="/explore#event-search" className={styles.search} aria-label="Search events"><Search size={18} aria-hidden="true" /><span>Search</span></Link>
          {signedIn && bell}
          {session?.user ? <><AccountMenu user={session.user} /></> : <><Link href="/sign-in" className={styles.signIn}>Sign in</Link>
          <Link href="/get-started" className={buttonStyles({ size: "sm", className: styles.getStarted })}>Get started <ArrowUpRight aria-hidden="true" /></Link></>}
        </div>
        {signedIn && <div className={styles.mobileBell}>{bell}</div>}
        <button type="button" className={styles.menuTrigger} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls={menuOpen ? "mobile-navigation" : undefined} aria-haspopup="dialog" onClick={() => setMenuOpen(true)}><Grid2X2 size={18} aria-hidden="true" /><span>Menu</span></button>
      </Container>
      <AnimatePresence>{menuOpen && <MobileNav key="navigation" onClose={closeMenu} user={session?.user} />}</AnimatePresence>
    </header>
  );
}
