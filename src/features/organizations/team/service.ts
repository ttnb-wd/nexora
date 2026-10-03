import { z } from "zod";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { allowedTeamRoles, canInviteMember, canLeaveOrganization, canManageMemberRole, canRemoveMember, canRevokeInvitation, invitationRoles } from "./policy";
import { hashInvitationToken, newInvitationToken, normalizeTeamEmail, validInvitationToken } from "./token";
import { allowTeamRequest } from "./rate-limit";

export class TeamError extends Error {}
const deny = () => { throw new TeamError("You do not have permission to perform this team action."); };
const open = { acceptedAt: null, declinedAt: null, revokedAt: null };
const inviteSchema = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()), role: z.enum(invitationRoles) });
const roleSchema = z.enum(invitationRoles);
type Tx = Prisma.TransactionClient;

// All team writes for one organization share this lock. Re-read roles after taking
// it: a removed/demoted actor cannot use authority captured before another write.
async function lockOrganization(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Organization" WHERE "id" = ${id} FOR UPDATE`;
  if (!rows.length) deny();
}
export async function databaseNow(tx: Tx) {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return row.now;
}
export async function withTeam<T>(db: PrismaClient, actorId: string, slug: string, work: (tx: Tx, access: { organizationId: string; role: "OWNER" | "ADMIN" | "EDITOR" | "MEMBER" }) => Promise<T>) {
  return db.$transaction(async tx => {
    const org = await tx.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!org) return deny();
    await lockOrganization(tx, org.id);
    const actor = await tx.organizationMember.findUnique({ where: { userId_organizationId: { userId: actorId, organizationId: org.id } } });
    if (!actor) return deny();
    return work(tx, { organizationId: org.id, role: actor.role });
  }, { timeout: 30000 });
}

export async function inviteTeamMember(db: PrismaClient, actorId: string, slug: string, input: unknown, replaceId?: string, emailDelivery = false) {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) throw new TeamError("Enter a valid email and an allowed role.");
  return withTeam(db, actorId, slug, async (tx, access) => {
    if (!canInviteMember(access.role, parsed.data.role)) return deny();
    const now = await databaseNow(tx);
    if (replaceId) {
      const previous = await tx.organizationInvitation.findFirst({ where: { id: replaceId, organizationId: access.organizationId } });
      if (!previous || previous.acceptedAt || previous.declinedAt || previous.revokedAt || previous.email !== parsed.data.email || !canRevokeInvitation(access.role, previous.role)) return deny();
      if (previous.expiresAt <= now) throw new TeamError("This invitation has expired. Create a new invitation instead.");
      if (emailDelivery && now.getTime() - previous.createdAt.getTime() < 60000) throw new TeamError("Please wait one minute before reissuing this invitation.");
      await tx.organizationInvitation.update({ where: { id: previous.id }, data: { revokedAt: now } });
    }
    const existingMember = await tx.organizationMember.findFirst({ where: { organizationId: access.organizationId, user: { email: { equals: parsed.data.email, mode: "insensitive" } } } });
    if (existingMember) throw new TeamError("This person is already a member of this organization.");
    await tx.organizationInvitation.updateMany({ where: { organizationId: access.organizationId, email: parsed.data.email, ...open, expiresAt: { lte: now } }, data: { revokedAt: now } });
    if (await tx.organizationInvitation.findFirst({ where: { organizationId: access.organizationId, email: parsed.data.email, ...open } })) throw new TeamError("An active invitation already exists for this email.");
    if (emailDelivery && (!await allowTeamRequest(tx, access.organizationId, "email-org") || !await allowTeamRequest(tx, JSON.stringify([access.organizationId, normalizeTeamEmail(parsed.data.email)]), "email-recipient"))) throw new TeamError("Too many invitation emails. Please try again in an hour.");
    const { token, tokenHash } = newInvitationToken();
    const invitation = await tx.organizationInvitation.create({ data: { ...parsed.data, organizationId: access.organizationId, invitedById: actorId, tokenHash, expiresAt: new Date(now.getTime() + 7 * 86400000) } });
    return { token, id: invitation.id };
  });
}

export async function revokeTeamInvitation(db: PrismaClient, actorId: string, slug: string, invitationId: string) {
  return withTeam(db, actorId, slug, async (tx, access) => {
    const invitation = await tx.organizationInvitation.findFirst({ where: { id: invitationId, organizationId: access.organizationId } });
    if (!invitation || !canRevokeInvitation(access.role, invitation.role)) return deny();
    if (invitation.acceptedAt || invitation.declinedAt) throw new TeamError("This invitation has already been used.");
    if (!invitation.revokedAt) await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { revokedAt: await databaseNow(tx) } });
  });
}

export async function respondToInvitation(db: PrismaClient, actorId: string, token: string, response: "accept" | "decline") {
  if (!validInvitationToken(token)) throw new TeamError("This invitation is unavailable.");
  return db.$transaction(async tx => {
    const found = await tx.organizationInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) }, select: { organizationId: true } });
    if (!found) throw new TeamError("This invitation is unavailable.");
    await lockOrganization(tx, found.organizationId);
    const invitation = await tx.organizationInvitation.findUniqueOrThrow({ where: { tokenHash: hashInvitationToken(token) }, include: { organization: { select: { slug: true } } } });
    const user = await tx.user.findUnique({ where: { id: actorId }, select: { email: true } });
    if (!user || normalizeTeamEmail(user.email) !== invitation.email) throw new TeamError("This invitation was sent to a different account.");
    if (invitation.revokedAt) throw new TeamError("This invitation has been revoked.");
    // Retries preserve the first terminal outcome, even after original expiration.
    if (invitation.acceptedAt && response === "accept") return { state: "accepted", slug: invitation.organization.slug };
    if (invitation.declinedAt && response === "decline") return { state: "declined", slug: invitation.organization.slug };
    if (invitation.acceptedAt || invitation.declinedAt) throw new TeamError("This invitation has already been used.");
    const now = await databaseNow(tx);
    if (invitation.expiresAt <= now) throw new TeamError("This invitation has expired. Ask an organization owner or admin for a new link.");
    if (response === "accept") {
      const existing = await tx.organizationMember.findUnique({ where: { userId_organizationId: { userId: actorId, organizationId: invitation.organizationId } } });
      if (existing) throw new TeamError("You are already a member of this organization.");
      await tx.organizationMember.create({ data: { userId: actorId, organizationId: invitation.organizationId, role: invitation.role } });
      await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: now } });
    } else await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { declinedAt: now } });
    return { state: response === "accept" ? "accepted" : "declined", slug: invitation.organization.slug };
  }, { timeout: 30000 });
}

export async function changeTeamRole(db: PrismaClient, actorId: string, slug: string, memberId: string, expectedRole: string, nextRole: unknown) {
  const parsed = roleSchema.safeParse(nextRole);
  if (!parsed.success) return deny();
  return withTeam(db, actorId, slug, async (tx, access) => {
    const target = await tx.organizationMember.findFirst({ where: { id: memberId, organizationId: access.organizationId } });
    if (!target || !canManageMemberRole(access.role, target.role, parsed.data)) return deny();
    if (target.role !== expectedRole) throw new TeamError("This member’s role changed. Refresh the page before trying again.");
    await tx.organizationMember.update({ where: { id: target.id }, data: { role: parsed.data } });
  });
}
export async function removeTeamMember(db: PrismaClient, actorId: string, slug: string, memberId?: string, expectedRole?: string) {
  return withTeam(db, actorId, slug, async (tx, access) => {
    const target = await tx.organizationMember.findFirst({ where: { organizationId: access.organizationId, ...(memberId ? { id: memberId } : { userId: actorId }) } });
    if (!target) return deny();
    const self = target.userId === actorId;
    if (self ? !canLeaveOrganization(target.role) : !canRemoveMember(access.role, target.role)) return deny();
    if (expectedRole && target.role !== expectedRole) throw new TeamError("This member’s role changed. Refresh the page before trying again.");
    await tx.organizationMember.delete({ where: { id: target.id } });
    return { left: self };
  });
}

// No hash, email, inviter or database identity crosses the invitation-page boundary.
export async function invitationPreview(db: PrismaClient, token: string) {
  if (!validInvitationToken(token)) return null;
  const invitation = await db.organizationInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) }, select: { role: true, expiresAt: true, acceptedAt: true, declinedAt: true, revokedAt: true, organization: { select: { name: true } } } });
  if (!invitation) return null;
  const [row] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return { name: invitation.organization.name, role: invitation.role, expiresAt: invitation.expiresAt.toISOString(), state: invitation.revokedAt ? "revoked" : invitation.acceptedAt ? "accepted" : invitation.declinedAt ? "declined" : invitation.expiresAt <= row.now ? "expired" : "active" };
}

export { allowedTeamRoles };
