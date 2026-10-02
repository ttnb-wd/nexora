import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignSystemPreview } from "./_components/design-system-preview";

export const metadata: Metadata = { title: "Internal Design System", robots: { index: false, follow: false } };

export default function DesignSystemPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main id="main-content" tabIndex={-1}><DesignSystemPreview /></main>;
}
