import "server-only";
import type { PrismaClient } from "../../../generated/prisma/client";
import { resolvePublicAppUrl, isLoopbackUrl } from "../../../lib/public-url";
import { sendOrganizationInvitationEmail } from "../../../services/email/organization-invitation";
import type { EmailResult } from "../../../lib/email/types";
import { inviteTeamMember, withTeam, databaseNow, TeamError } from "./service";
import { canInviteMember } from "./policy";
import { hashInvitationToken } from "./token";
import { allowTeamRequest } from "./rate-limit";

export function invitationEmailOrigin() {
  const value = process.env.PUBLIC_APP_URL?.trim();
  if (!value) throw new TeamError("Configure PUBLIC_APP_URL before creating invitation links.");
  try {
    const origin = resolvePublicAppUrl(value, value, process.env.NODE_ENV === "production");
    if (process.env.NODE_ENV === "production" && isLoopbackUrl(origin)) throw new Error();
    return origin;
  } catch { throw new TeamError("Configure PUBLIC_APP_URL with a valid application origin (HTTPS in production)."); }
}

// Only called with a fresh server-created credential. Hashes are never recovered.
// Claim one attempt under Step 21's lock, checking current authorization/state.
export async function deliverIssuedInvitation(db: PrismaClient, actorId: string, slug: string, issued: { id: string; token: string }, origin: string, send = sendOrganizationInvitationEmail) {
  const invitationUrl = new URL(`/invitations/${issued.token}`, origin).href;
  const content = await withTeam(db, actorId, slug, async (tx, access) => {
    const invitation = await tx.organizationInvitation.findFirst({ where: { id: issued.id, organizationId: access.organizationId, tokenHash: hashInvitationToken(issued.token) }, include: { organization: { select: { name: true } }, invitedBy: { select: { name: true } } } });
    const now = await databaseNow(tx);
    if (!invitation || !canInviteMember(access.role, invitation.role) || invitation.revokedAt || invitation.acceptedAt || invitation.declinedAt || invitation.expiresAt <= now || invitation.emailSendAttempts > 0) throw new TeamError("This invitation is unavailable for email delivery.");
    await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { emailLastAttemptAt: now, emailSendAttempts: { increment: 1 } } });
    return { invitationId: invitation.id, email: invitation.email, organizationName: invitation.organization.name, role: invitation.role, inviterName: invitation.invitedBy?.name, expiresAt: invitation.expiresAt, invitationUrl };
  });
  // Never hold a Neon transaction/organization lock during the network request.
  let result: EmailResult;
  try { result = await send(content); } catch { result = { ok: false, category: "provider" }; }
  try {
    await db.organizationInvitation.update({ where: { id: issued.id }, data: result.ok ? { emailSentAt: new Date(), emailProviderMessageId: result.messageId, emailFailureCategory: null } : { emailFailureCategory: result.category } });
  } catch {
    // Provider acceptance cannot be rolled back. Keep the valid link and surface
    // uncertainty; don't automatically resend on a metadata persistence failure.
    console.warn("[Nexora email]", { operation: "organization_invitation", outcome: "metadata_failure" });
    return { ok: true as const, delivery: "unknown" as const, message: "Invitation created, but email status could not be confirmed. Copy this link now or reissue and send later.", link: invitationUrl };
  }
  console.info("[Nexora email]", { operation: "organization_invitation", outcome: result.ok ? "sent" : "failed", ...(!result.ok ? { category: result.category } : {}) });
  return result.ok
    ? { ok: true as const, delivery: "sent" as const, message: "Invitation created and email sent." }
    : { ok: true as const, delivery: "failed" as const, message: `Invitation created but email could not be sent. ${result.category === "configuration" || result.category === "authentication" || result.category === "domain" ? "Ask the administrator to check email configuration." : result.category === "rate_limit" ? "Please wait before reissuing and sending." : "Copy the link now, or reissue and send later."}`, link: invitationUrl };
}

export async function createAndEmailInvitation(db: PrismaClient, actorId: string, slug: string, input: unknown, replaceId?: string, send = sendOrganizationInvitationEmail) {
  const origin = invitationEmailOrigin();
  if (!await allowTeamRequest(db, actorId, "invite")) throw new TeamError("Too many invitations. Please try again in an hour.");
  // Reissue derives email/role only from trusted storage, never from the client.
  const prior = replaceId !== undefined ? await db.organizationInvitation.findFirst({ where: { id: replaceId, organization: { slug, members: { some: { userId: actorId, role: { in: ["OWNER", "ADMIN"] } } } } }, select: { email: true, role: true } }) : null;
  if (replaceId !== undefined && !prior) throw new TeamError("This invitation is unavailable.");
  const issued = await inviteTeamMember(db, actorId, slug, prior ?? input, replaceId, true);
  try { return await deliverIssuedInvitation(db, actorId, slug, issued, origin, send); }
  catch {
    // Creation has committed; a subsequent database/authorization failure must
    // never claim creation failed or lose the authorized creator's fallback link.
    return { ok: true as const, delivery: "unknown" as const, message: "Invitation created but email could not be sent. Copy this link now; reissue and send later.", link: new URL(`/invitations/${issued.token}`, origin).href };
  }
}

export function invitationDeliveryState(invitation: { acceptedAt: Date | null; declinedAt: Date | null; revokedAt: Date | null; expiresAt: Date; emailSentAt: Date | null; emailLastAttemptAt: Date | null; emailFailureCategory: string | null }, now: Date) {
  return invitation.revokedAt ? "Revoked" : invitation.acceptedAt ? "Accepted" : invitation.declinedAt ? "Declined" : invitation.expiresAt <= now ? "Expired" : invitation.emailSentAt ? "Sent" : invitation.emailFailureCategory ? "Send failed" : invitation.emailLastAttemptAt ? "Status unconfirmed" : "Not sent";
}
