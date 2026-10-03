import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/features/auth/server/session";
import { invitationPreview } from "@/features/organizations/team/service";
import { allowTeamRequest } from "@/features/organizations/team/rate-limit";
import { InvitationResponse } from "@/features/organizations/team/components";
import { getDb } from "@/lib/db";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import styles from "@/features/organizations/components/organizer.module.css";
import team from "@/features/organizations/team/team.module.css";
export const metadata = { title: "Organization invitation", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  const db = getDb();
  const requestHeaders = await headers();
  const identity = user?.id ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const allowed = await allowTeamRequest(db, identity, "verify");
  const invitation = allowed ? await invitationPreview(db, token) : null;
  const messages: Record<string, string> = { expired: "This invitation has expired. Ask an owner or admin for a new link.", revoked: "This invitation has been revoked.", accepted: "This invitation has already been accepted.", declined: "This invitation has been declined." };
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href="/dashboard" className={styles.back}>← Your dashboard</Link><section className={team.section}><p className={styles.eyebrow}>TEAM INVITATION</p><h1>{invitation ? `Join ${invitation.name}` : "Invitation unavailable"}</h1>{invitation ? <><p className={styles.intro}>Invited role: {invitation.role}</p><p>Expires {invitation.expiresAt.replace("T", " ").slice(0, 16)} UTC</p>{invitation.state !== "active" && <p role="status" className={team.message}>{messages[invitation.state]}</p>}{user ? <InvitationResponse token={token} active={invitation.state === "active"} /> : invitation.state === "active" && <Link className={buttonStyles()} href={`/sign-in?returnTo=${encodeURIComponent(`/invitations/${token}`)}`}>Sign in to accept invitation</Link>}</> : <p>{allowed ? "This invitation link is invalid or unavailable." : "Too many attempts. Please try again in a minute."}</p>}</section></Container></main>;
}
