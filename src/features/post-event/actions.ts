"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getAuthorizedUser } from "@/features/auth/server/session";
import { saveFeedback } from "./service";
import type { FeedbackActionState } from "./schemas";
export async function saveEventFeedback(slug: string, _previous: FeedbackActionState, form: FormData): Promise<FeedbackActionState> {
  const user = await getAuthorizedUser();
  const result = await saveFeedback(getDb(), user?.id ?? null, slug, { rating: Number(form.get("rating")), comment: form.get("comment") ?? undefined });
  if (result.ok) {
    revalidatePath(`/events/${slug}`);
    revalidatePath("/organizer/[organizationSlug]/events/[eventId]/feedback", "page");
    revalidatePath("/dashboard/events/[eventId]/feedback", "page");
    revalidatePath("/organizer/[organizationSlug]/events/[eventId]/analytics", "page");
    revalidatePath("/dashboard/events/[eventId]/analytics", "page");
  }
  return result;
}
