export const organizationIndustries = ["Technology", "AI", "Design", "Startup", "Community", "Business", "Career"] as const;
export type OrganizationIndustry = (typeof organizationIndustries)[number];
export type OrganizationTheme = "violet" | "cyan" | "coral" | "warm" | "blue" | "mixed";
export type OrganizationLogo = "asterisk" | "orbit" | "spark" | "waves" | "blocks" | "northstar";
export interface OrganizationTeamMember { name: string; role: string; initials: string; note?: string }
export interface OrganizationSocialLink { kind: "professional" | "community"; label: string; url: string }
export interface Organization {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  about: string[];
  statement: string;
  industry: OrganizationIndustry;
  location: { city: string; region: string };
  website?: string;
  visualTheme: OrganizationTheme;
  logo: OrganizationLogo;
  featured: boolean;
  topics: string[];
  team: OrganizationTeamMember[];
  socialLinks: OrganizationSocialLink[];
  createdAt?: string;
}
export interface OrganizationFiltersState { query: string; industry: string; location: string }
export type OrganizationSort = "relevance" | "alphabetical";
export type OrganizationCardVariant = "standard" | "featured" | "compact";

/** Serializable public identity. No internal IDs, memberships, or auth data. */
export interface PublicOrganization {
  name: string;
  slug: string;
  shortName: string;
  description: string;
  industry: string;
  city: string;
  region: string;
  website: string | null;
  visualTheme: OrganizationTheme;
  logoVariant: OrganizationLogo;
}
