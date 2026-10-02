import { requireUser } from "@/features/auth/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organizer", robots: { index: false, follow: false } };
export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
