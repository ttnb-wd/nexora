"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getAuthorizedUser } from "@/features/auth/server/session";
import { mutateReminder, readViewerReminder } from "./service";
import { eventSlugSchema } from "../management-schemas";
async function change(slug: unknown, minutes: unknown, disable: boolean) {
  try {
    const user = await getAuthorizedUser();
    const result = await mutateReminder(getDb(), user?.id ?? null, slug, minutes, disable);
    if (result.ok && eventSlugSchema.safeParse(slug).success) {
      revalidatePath(`/events/${slug}`); revalidatePath("/dashboard"); revalidatePath("/dashboard/joined");
    }
    return result;
  } catch { return { ok: false, message: "We could not save your reminder. Please try again." }; }
}
export async function setEventReminder(slug: unknown, minutes: unknown) { return change(slug, minutes, false); }
export async function disableEventReminder(slug: unknown) { return change(slug, null, true); }
export async function getViewerEventReminder(slug: string) {
  const user = await getAuthorizedUser();
  return readViewerReminder(getDb(), user?.id ?? null, slug);
}
