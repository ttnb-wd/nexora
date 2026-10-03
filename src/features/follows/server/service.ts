import "server-only";
import { getDb } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/features/auth/server/session";
import { organizationSlugSchema } from "@/features/organizations/slug";
import { mapPublicOrganization, publicOrganizationSelect } from "@/features/organizations/server/public-organization-mapper";
import type { ParticipationResult } from "@/features/participation/rules";

export async function mutateFollow(input: unknown, following: boolean): Promise<ParticipationResult> {
  const parsed = organizationSlugSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "This organization is no longer available." };
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Please sign in to continue.", signIn: `/sign-in?returnTo=${encodeURIComponent(`/companies/${parsed.data}`)}` };
    const organization = await getDb().organization.findUnique({ where: { slug: parsed.data }, select: { id: true } });
    if (!organization) return { ok: false, message: "This organization is no longer available." };
    const where = { userId: user.id, organizationId: organization.id };
    if (following) await getDb().organizationFollower.createMany({ data: [where], skipDuplicates: true });
    else await getDb().organizationFollower.deleteMany({ where });
    return { ok: true, message: following ? "You are following this organization." : "Organization unfollowed." };
  } catch { return { ok: false, message: "We could not update your follow. Please try again shortly." }; }
}
export async function isOrganizationFollowedByUser(slug: string) {
  const user = await getCurrentUser();
  if (!user || !organizationSlugSchema.safeParse(slug).success) return false;
  return Boolean(await getDb().organizationFollower.findFirst({ where: { userId: user.id, organization: { slug } }, select: { createdAt: true } }));
}
export async function getFollowedOrganizations() {
  const user = await requireUser();
  const rows = await getDb().organizationFollower.findMany({ where: { userId: user.id }, select: { organization: { select: publicOrganizationSelect } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return rows.map(({ organization }) => mapPublicOrganization(organization));
}
/** One batch for all visible Follow controls; never put follow records in public DTOs. */
export async function getFollowViewer() {
  const user = await getCurrentUser();
  if (!user) return { authenticated: false, followedSlugs: [] as string[], unavailable: false };
  const rows = await getDb().organizationFollower.findMany({ where: { userId: user.id }, select: { organization: { select: { slug: true } } } });
  return { authenticated: true, followedSlugs: rows.map(({ organization }) => organization.slug), unavailable: false };
}
