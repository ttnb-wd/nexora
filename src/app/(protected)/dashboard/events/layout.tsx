import { requireUser } from "@/features/auth/server/session";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your events", robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireUser(); return children;
}
