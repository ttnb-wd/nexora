import type { Prisma } from "@/generated/prisma/client";
import type { OrganizationLogo, OrganizationTheme, PublicOrganization } from "../types";

// This allowlist is the public boundary; never select memberships or internal identities.
export const publicOrganizationSelect = {
  name: true, slug: true, shortName: true, description: true, industry: true,
  city: true, region: true, website: true, visualTheme: true, logoVariant: true,
} satisfies Prisma.OrganizationSelect;
export type PublicOrganizationRecord = Prisma.OrganizationGetPayload<{ select: typeof publicOrganizationSelect }>;
const themes: OrganizationTheme[] = ["violet", "cyan", "coral", "warm", "blue", "mixed"];
const logos: OrganizationLogo[] = ["asterisk", "orbit", "spark", "waves", "blocks", "northstar"];
export function mapPublicOrganization(record: PublicOrganizationRecord): PublicOrganization {
  let website: string | null = null;
  try {
    const url = new URL(record.website ?? "");
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) website = url.href;
  } catch { /* Missing or unsafe links are not rendered. */ }
  return {
    name: record.name, slug: record.slug,
    shortName: record.shortName || record.name.split(/\s+/).map((word) => word[0]).slice(0, 3).join("").toUpperCase(),
    description: record.description ?? "", industry: record.industry ?? "",
    city: record.city ?? "", region: record.region ?? "", website,
    visualTheme: themes.includes(record.visualTheme as OrganizationTheme) ? record.visualTheme as OrganizationTheme : "violet",
    logoVariant: logos.includes(record.logoVariant as OrganizationLogo) ? record.logoVariant as OrganizationLogo : "asterisk",
  };
}
