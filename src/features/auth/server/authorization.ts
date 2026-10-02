import "server-only";
import type { OrganizationRole } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { requireUser } from "./session";

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor() { super("You do not have permission to access this organization."); }
}
export async function requireOrganizationMembership(organizationId: string) {
  const user = await requireUser();
  const membership = await getDb().organizationMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
  });
  if (!membership) throw new AuthorizationError();
  return { user, membership };
}
/** Call only from server code; roles always come from the persisted membership. */
export async function requireOrganizationRole(organizationId: string, allowedRoles: readonly OrganizationRole[]) {
  const access = await requireOrganizationMembership(organizationId);
  if (!allowedRoles.includes(access.membership.role)) throw new AuthorizationError();
  return access;
}
