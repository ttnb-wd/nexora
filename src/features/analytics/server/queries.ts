import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { loadEventAnalytics, loadOrganizationAnalytics } from "./service";
export async function getEventAnalytics(eventId: string, scope: string | null, range: unknown = "all", includeTrend = true) {
  const user = await requireUser();
  const result = await loadEventAnalytics(getDb(),user.id,eventId,scope,range,new Date(),includeTrend);
  if (!result) notFound();
  return result;
}
export async function getOrganizationAnalytics(slug: string, range: unknown = "all") {
  const user = await requireUser();
  const result = await loadOrganizationAnalytics(getDb(),user.id,slug,range);
  if (!result) notFound();
  return result;
}
