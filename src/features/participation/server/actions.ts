"use server";
import { revalidatePath } from "next/cache";
import { mutateParticipation } from "./service";
async function mutate(slug: string, kind: "join" | "cancel" | "save" | "unsave") {
  const result = await mutateParticipation(slug, kind);
  if (result.ok) {
    revalidatePath("/", "layout");
    revalidatePath(`/events/${slug}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/joined");
    revalidatePath("/dashboard/saved");
    revalidatePath("/organizer/[organizationSlug]/events/[eventId]", "page");
    revalidatePath("/dashboard/events/[eventId]", "page");
    revalidatePath("/organizer/[organizationSlug]/events/[eventId]/attendees", "page");
    revalidatePath("/dashboard/events/[eventId]/attendees", "page");
  }
  return result;
}
export async function joinEvent(slug: string) { return mutate(slug, "join"); }
export async function cancelEventRegistration(slug: string) { return mutate(slug, "cancel"); }
export async function saveEvent(slug: string) { return mutate(slug, "save"); }
export async function unsaveEvent(slug: string) { return mutate(slug, "unsave"); }
