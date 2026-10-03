import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";
import { BookmarkProvider } from "@/features/participation/components/bookmark-provider";
import { getBookmarkViewer } from "@/features/participation/server/service";

import { FollowProvider } from "@/features/follows/components/follow-provider";
import { getFollowViewer } from "@/features/follows/server/service";
import { getUnreadNotificationCount } from "@/features/notifications/server/queries";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let viewer;
  try { viewer = await getBookmarkViewer(); }
  catch { viewer = { authenticated: false, savedSlugs: [], unavailable: true }; }
  const [followResult, countResult] = await Promise.allSettled([getFollowViewer(), getUnreadNotificationCount()]);
  const followViewer = followResult.status === "fulfilled" ? followResult.value : { authenticated: false, followedSlugs: [], unavailable: true };
  const unreadCount = countResult.status === "fulfilled" ? countResult.value : null;
  return (
    <html lang="en" className="h-full antialiased">
      <body className="site-body"><a href="#main-content" className="skip-link">Skip to content</a><BookmarkProvider viewer={viewer}><FollowProvider viewer={followViewer}><SiteHeader authenticated={viewer.authenticated} unreadCount={unreadCount} />{children}<SiteFooter /></FollowProvider></BookmarkProvider></body>
    </html>
  );
}
