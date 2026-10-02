import "server-only";
import { notFound } from "next/navigation";
import type { OrganizationRole } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { getCurrentUser, requireUser } from "./session";

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor() { super("You do not have permission to access this organization."); }
}
export async function getOrganizationMembership(organizationId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return getDb().organizationMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    include: { organization: true },
  });
}
export async function requireOrganizationMember(organizationId: string) {
  const user = await requireUser();
  const membership = await getDb().organizationMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    include: { organization: true },
  });
  if (!membership) notFound();
  return { user, membership };
}
export const requireOrganizationMembership = requireOrganizationMember;
/** Call only from server code; roles always come from the persisted membership. */
export async function requireOrganizationRole(organizationId: string, allowedRoles: readonly OrganizationRole[]) {
  const access = await requireOrganizationMembership(organizationId);
  if (!allowedRoles.includes(access.membership.role)) notFound();
  return access;
}

/** Resolve by membership so inaccessible and nonexistent slugs have the same response. */
export async function requireOrganizationBySlug(slug: string, allowedRoles?: readonly OrganizationRole[]) {
  const user = await requireUser();
  const membership = await getDb().organizationMember.findFirst({
    where: { userId: user.id, organization: { slug }, ...(allowedRoles ? { role: { in: [...allowedRoles] } } : {}) },
    include: { organization: true },
  });
  if (!membership) notFound();
  return { user, membership, organization: membership.organization };
}
