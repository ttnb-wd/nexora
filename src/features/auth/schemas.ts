import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254));
export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128, "Password is too long."),
});
export const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(2, "Enter at least two characters.").max(80, "Use 80 characters or fewer."),
  password: z.string().min(12, "Use at least 12 characters.").max(128, "Use 128 characters or fewer."),
});
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export const emailRequestSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  newPassword: signUpSchema.shape.password,
  confirmPassword: z.string(),
}).refine(value => value.newPassword === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords must match." });
