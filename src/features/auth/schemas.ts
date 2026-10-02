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
