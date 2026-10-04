import { z } from "zod";
import { signUpSchema } from "@/features/auth/schemas";

export const profileSchema = z.object({ action: z.literal("profile"), name: signUpSchema.shape.name }).strict();
export const preferenceSchema = z.object({ action: z.literal("preferences"), timezone: z.string().trim().max(100).refine(value => {
  if (!value) return true;
  if (value !== "UTC" && !/^[A-Za-z_]+\/[A-Za-z0-9_+\-/]+$/.test(value)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Choose a valid IANA timezone, such as Asia/Yangon.") }).strict();
export const passwordSchema = z.object({ action: z.literal("password"), currentPassword: z.string().min(1, "Enter your current password.").max(128), newPassword: signUpSchema.shape.password, confirmPassword: z.string().max(128) }).strict().refine(value => value.newPassword === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords must match." });
export const revokeSchema = z.object({ action: z.literal("revoke"), sessionId: z.string().min(1).max(128), confirm: z.literal(true, { error: "Confirm that you want to sign out this session." }) }).strict();
export const revokeOthersSchema = z.object({ action: z.literal("revokeOthers"), confirm: z.literal(true, { error: "Confirm that you want to sign out other sessions." }) }).strict();
export const accountMutationSchema = z.union([profileSchema, preferenceSchema, passwordSchema, revokeSchema, revokeOthersSchema]);
export type AccountMutation = z.infer<typeof accountMutationSchema>;
