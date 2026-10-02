import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getDb } from "@/lib/db";
import { getAuthEnvironment } from "@/lib/env";

function createAuth() {
  const env = getAuthEnvironment();
  return betterAuth({
    appName: "Nexora",
    baseURL: env.APP_URL,
    secret: env.AUTH_SECRET,
    trustedOrigins: [new URL(env.APP_URL).origin],
    database: prismaAdapter(getDb(), { provider: "postgresql", transaction: true }),
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: false },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 100, customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 3 } } },
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
