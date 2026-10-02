import { z } from "zod";
import { organizationSlugSchema } from "./slug";

const optionalText = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer.`)
  .optional().transform((value) => value || null);
const fields = {
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(120, "Use 120 characters or fewer."),
  shortName: optionalText(40),
  description: optionalText(2000),
  industry: optionalText(80),
  city: optionalText(100),
  region: optionalText(100),
  website: z.string().trim().max(2048, "Use 2048 characters or fewer.").optional()
    .refine((value) => {
      if (!value) return true;
      try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
      catch { return false; }
    }, "Enter a valid website URL starting with https:// or http://.")
    .transform((value) => value || null),
};
export const createOrganizationSchema = z.object({ ...fields, slug: organizationSlugSchema });
export const updateOrganizationSchema = z.object(fields);
export type OrganizationFormField = keyof z.input<typeof createOrganizationSchema>;
export type OrganizationFormState = {
  errors?: Partial<Record<OrganizationFormField, string[]>>;
  message?: string;
  values?: Partial<Record<OrganizationFormField, string>>;
};
