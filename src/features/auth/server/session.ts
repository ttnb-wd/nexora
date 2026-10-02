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
  return user;
}
