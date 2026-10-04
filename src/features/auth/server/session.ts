import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/env";
import { getAuth } from "./auth";

export const getCurrentUser = cache(async () => {
  if (!isAuthConfigured()) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
});
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.verificationRequired && !user.emailVerified) redirect("/verify-email?required=1");
  return user;
}
/** Mutation entry points must never treat an unverified new account as authorized. */
export async function getAuthorizedUser() {
  const user = await getCurrentUser();
  return user && (!user.verificationRequired || user.emailVerified) ? user : null;
}
