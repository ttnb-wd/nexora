import { z } from "zod";

export const organizationSlugSchema = z.string().trim()
  .min(3, "Use at least 3 characters.")
  .max(64, "Use 64 characters or fewer.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens between words.")
  .refine((slug) => !["create", "settings"].includes(slug), "Choose another organization URL.");
