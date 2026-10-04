"use server";
import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import type { ContentKind, ContentState } from "../content-schemas";
import { mutateEventContent } from "./content-service";

async function run(eventId: string, scope: string | null, kind: ContentKind, operation: "create" | "update" | "delete" | "move", form: FormData): Promise<ContentState> {
  try {
    const user = await getAuthorizedUser();
    if (!user) return { message: "Sign in to manage event content." };
    const result = await mutateEventContent(getDb(), user.id, eventId, scope, kind, operation, form);
    if (result.ok) {
      revalidatePath(`/events/${result.slug}`);
      revalidatePath(scope ? `/organizer/${scope}/events/${eventId}` : `/dashboard/events/${eventId}`);
    }
    return { ok: result.ok, message: result.message, errors: result.errors };
  } catch { return { message: "We couldn’t save these changes. Please try again shortly." }; }
}
export async function createAgendaItem(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "agenda", "create", form); }
export async function updateAgendaItem(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "agenda", "update", form); }
export async function deleteAgendaItem(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "agenda", "delete", form); }
export async function moveAgendaItem(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "agenda", "move", form); }
export async function createSpeaker(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "speaker", "create", form); }
export async function updateSpeaker(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "speaker", "update", form); }
export async function deleteSpeaker(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "speaker", "delete", form); }
export async function moveSpeaker(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "speaker", "move", form); }
export async function createResource(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "resource", "create", form); }
export async function updateResource(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "resource", "update", form); }
export async function deleteResource(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "resource", "delete", form); }
export async function moveResource(eventId: string, scope: string | null, _previous: ContentState, form: FormData): Promise<ContentState> { return run(eventId, scope, "resource", "move", form); }
