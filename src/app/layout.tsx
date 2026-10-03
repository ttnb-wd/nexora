import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";
import { BookmarkProvider } from "@/features/participation/components/bookmark-provider";
import { getBookmarkViewer } from "@/features/participation/server/service";

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
  return (
    <html lang="en" className="h-full antialiased">
      <body className="site-body"><a href="#main-content" className="skip-link">Skip to content</a><BookmarkProvider viewer={viewer}><SiteHeader />{children}<SiteFooter /></BookmarkProvider></body>
    </html>
  );
}
