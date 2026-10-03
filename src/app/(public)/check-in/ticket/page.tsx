import Link from "next/link";
export const metadata = { title: "Nexora ticket", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
// The URL fragment never reaches the server. This page performs no ticket lookup or mutation.
export default function Page() {
  return <main id="main-content" tabIndex={-1} style={{ padding: "8rem 1.5rem", maxWidth: 680, margin: "auto" }}><h1>Nexora event ticket</h1><p>Present this QR to an authorized organizer at the event. Organizers can paste the full QR URL into the event’s check-in page.</p><Link href="/organizer">Organizer workspace</Link></main>;
}
