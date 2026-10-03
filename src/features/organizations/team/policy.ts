import type { OrganizationRole } from "../../../generated/prisma/enums";
export const invitationRoles = ["ADMIN", "EDITOR", "MEMBER"] as const;
export type TeamRole = typeof invitationRoles[number];
export function allowedTeamRoles(actor: OrganizationRole): readonly TeamRole[] {
  return actor === "OWNER" ? invitationRoles : actor === "ADMIN" ? ["EDITOR", "MEMBER"] : [];
}
export function canInviteMember(actor: OrganizationRole, role: OrganizationRole) {
  return allowedTeamRoles(actor).some(value => value === role);
}
export function canManageMemberRole(actor: OrganizationRole, target: OrganizationRole, next: OrganizationRole) {
  return canInviteMember(actor, target) && canInviteMember(actor, next);
}
export function canRemoveMember(actor: OrganizationRole, target: OrganizationRole) {
  return canInviteMember(actor, target);
}
export const canRevokeInvitation = canInviteMember;
export function canLeaveOrganization(role: OrganizationRole) { return role !== "OWNER"; }
