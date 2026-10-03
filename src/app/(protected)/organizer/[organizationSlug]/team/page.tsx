import Link from "next/link";
import { requireOrganizationBySlug } from "@/features/auth/server/authorization";
import { getDb } from "@/lib/db";
import { Container } from "@/components/layout/container";
import { InviteForm, InvitationActions, MemberActions } from "@/features/organizations/team/components";
import { invitationDeliveryState } from "@/features/organizations/team/delivery";
import { allowedTeamRoles } from "@/features/organizations/team/policy";
import styles from "@/features/organizations/components/organizer.module.css";
import team from "@/features/organizations/team/team.module.css";
export const metadata = { title: "Organization team", robots: { index: false, follow: false } };
export default async function TeamPage({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { organization, membership, user } = await requireOrganizationBySlug(organizationSlug);
  const db = getDb();
  const members = await db.organizationMember.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "asc" }, select: { id: true, userId: true, role: true, createdAt: true, user: { select: { name: true } } } });
  const invitations = allowedTeamRoles(membership.role).length ? await db.organizationInvitation.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, declinedAt: true, revokedAt: true, emailSentAt: true, emailLastAttemptAt: true, emailFailureCategory: true } }) : [];
  const [clock] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href={`/organizer/${organization.slug}`} className={styles.back}>← Organization overview</Link><p className={styles.eyebrow}>ORGANIZATION TEAM</p><h1>{organization.name}</h1><p className={styles.intro}>Manage your team and their access. Your role: {membership.role}.</p><InviteForm slug={organization.slug} role={membership.role} /><section className={team.section}><h2>Members ({members.length})</h2>{members.length === 1 && <p className={team.hint}>Your organization starts with you. Invite someone to grow your team.</p>}{members.map(member => <div key={member.id} className={team.row}><div className={team.identity}><strong>{member.user.name}{member.userId === user.id ? " (you)" : ""}</strong><p>{member.role}</p><p className={team.hint}>Joined {member.createdAt.toISOString().slice(0, 10)} (UTC)</p></div><MemberActions slug={organization.slug} actorRole={membership.role} member={{ id: member.id, name: member.user.name, role: member.role, self: member.userId === user.id }} /></div>)}</section>{allowedTeamRoles(membership.role).length > 0 && <section className={team.section}><h2>Organization invitations</h2><p className={team.hint}>Sent means accepted by the email provider, not confirmed inbox delivery. If sending fails, copy the link from the result now. After reload, reissue & send to create a new link; the old link stays invalid. Expired invitations require a new invitation.</p>{!invitations.length && <p>No pending invitations.</p>}{invitations.map(invitation => <div key={invitation.id} className={team.row}><div className={team.identity}><strong>{invitation.email}</strong><p>{invitation.role} · {invitationDeliveryState(invitation, clock.now)}</p><p className={team.hint}>{invitation.expiresAt <= clock.now ? "Expired" : "Expires"}: {invitation.expiresAt.toISOString().replace("T", " ").slice(0, 16)} UTC</p></div><InvitationActions slug={organization.slug} actorRole={membership.role} id={invitation.id} role={invitation.role} active={!invitation.acceptedAt && !invitation.declinedAt && !invitation.revokedAt && invitation.expiresAt > clock.now} terminal={Boolean(invitation.acceptedAt || invitation.declinedAt || invitation.revokedAt)} /></div>)}</section>}</Container></main>;
}

