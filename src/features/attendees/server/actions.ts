"use server";
import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { mutateAttendance } from "./service";
import type { AttendeeActionState } from "../schemas";

async function run(eventId: string, scope: string | null, form: FormData, operation: "check-in" | "undo"): Promise<AttendeeActionState> {
  try {
    const user = await getAuthorizedUser();
    if (!user) return { message: "Sign in to manage event attendees." };
    if (operation === "undo" && form.get("confirm") !== "yes") return { message: "Confirm that you want to undo this check-in." };
    const result = await mutateAttendance(getDb(), user.id, { eventId, scope, registrationId: form.get("registrationId") }, operation);
    if (result.ok) {
      const path = scope ? `/organizer/${scope}/events/${eventId}` : `/dashboard/events/${eventId}`;
      revalidatePath(`${path}/attendees`);
      revalidatePath(path);
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/joined");
      revalidatePath("/dashboard/saved");
      revalidatePath(`/events/${result.slug}`);
    }
    return { ok: result.ok, message: result.message };
  } catch { return { message: "We couldn’t update attendance. Please try again shortly." }; }
}
export async function checkInAttendee(eventId: string, scope: string | null, _previous: AttendeeActionState, form: FormData) { return run(eventId, scope, form, "check-in"); }
export async function undoAttendeeCheckIn(eventId: string, scope: string | null, _previous: AttendeeActionState, form: FormData) { return run(eventId, scope, form, "undo"); }
