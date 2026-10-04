import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getDb } from "@/lib/db";
import { getAuthEnvironment } from "@/lib/env";
import { sendAuthenticationEmail } from "@/services/email/authentication";

function createAuth() {
  const env = getAuthEnvironment();
  return betterAuth({
    appName: "Nexora",
    baseURL: env.APP_URL,
    secret: env.AUTH_SECRET,
    trustedOrigins: [new URL(env.APP_URL).origin],
    database: prismaAdapter(getDb(), { provider: "postgresql", transaction: true }),
    user: { additionalFields: { verificationRequired: { type: "boolean", defaultValue: true, input: false } } },
    emailVerification: { sendOnSignUp: true, sendOnSignIn: false, expiresIn: 86400, autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => sendAuthenticationEmail("verification", user.email, url) },
    verification: { storeIdentifier: "hashed", disableCleanup: true },
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: false,
      resetPasswordTokenExpiresIn: 3600, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendAuthenticationEmail("reset", user.email, url) },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 100, customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 3 }, "/reset-password": { window: 60, max: 5 }, "/reset-password/*": false, "/request-password-reset": { window: 60, max: 5 }, "/send-verification-email": { window: 60, max: 5 } } },
    advanced: { useSecureCookies: new URL(env.APP_URL).protocol === "https:" },
    logger: { disabled: true },
  });
}
const authGlobal = globalThis as unknown as { nexoraAuth?: ReturnType<typeof createAuth> };
let productionAuth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (process.env.NODE_ENV === "production") return productionAuth ??= createAuth();
  return authGlobal.nexoraAuth ??= createAuth();
}
