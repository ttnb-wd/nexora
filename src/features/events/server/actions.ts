"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireUser } from "@/features/auth/server/session";
import { requireOrganizationRole } from "@/features/auth/server/authorization";
import { createEventSchema, updateEventSchema, emptyEventValues, eventDataFromInput, type EventActionState } from "../management-schemas";
import { eventAccessWhere, eventManagerRoles, eventManagementPath, requireEventAccess } from "./authorization";
import { eventToFormValues } from "./form-values";

import { notifyEventPublished, notifyEventCancelled } from "@/features/notifications/server/creation";
import { completeManagedEvent } from "@/features/post-event/service";

function fieldsFromForm(form: FormData) { return Object.fromEntries(Object.keys(emptyEventValues).map((key) => [key, form.get(key) ?? ""])); }
function safeError(error: unknown): EventActionState {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { errors: { slug: ["That event URL is already in use."] }, message: "Choose another event URL." };
  return { message: "We couldn’t save this event. Please try again shortly." };
}
function refreshEvent(path: string, organizationSlug?: string, eventSlug?: string) {
  revalidatePath(path);
  revalidatePath(`${path}/edit`);
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/joined");
  revalidatePath("/dashboard/saved");
  if (organizationSlug) revalidatePath(`/organizer/${organizationSlug}/events`);
  revalidatePath("/", "layout");
  revalidatePath("/dashboard/notifications");
  revalidatePath("/explore");
  revalidatePath("/companies");
  revalidatePath("/companies/[slug]", "page");
  // Other detail pages may contain this event in their related cards.
  revalidatePath("/events/[slug]", "page");
  if (eventSlug) revalidatePath(`/events/${eventSlug}`);
}

export async function createEvent(_previous: EventActionState, form: FormData): Promise<EventActionState> {
  const user = await requireUser();
  const result = createEventSchema.safeParse(fieldsFromForm(form));
  if (!result.success) return { errors: result.error.flatten().fieldErrors, message: "Please check the highlighted fields." };
  const intent = z.enum(["draft", "publish"]).safeParse(form.get("intent"));
  if (!intent.success) return { message: "Choose Save as draft or Publish event." };
  if (result.data.organizationId) await requireOrganizationRole(result.data.organizationId, eventManagerRoles);
  let path: string;
  let organizationSlug: string | undefined;
  let eventSlug: string | undefined;
  try {
    const event = await getDb().$transaction(async (tx) => {
      if (result.data.organizationId) {
        const membership = await tx.organizationMember.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: result.data.organizationId } } });
        if (!membership || !eventManagerRoles.some((role) => role === membership.role)) return null;
      }
      const created = await tx.event.create({ data: { ...eventDataFromInput(result.data), creatorId: user.id, status: intent.data === "publish" ? "PUBLISHED" : "DRAFT" }, include: { organization: { select: { slug: true } } } });
      if (created.status === "PUBLISHED") await notifyEventPublished(tx, created.id);
      return created;
    }, { maxWait: 10000, timeout: 15000 });
    if (!event) return { message: "You do not have permission to create events for this organization." };
    path = eventManagementPath(event);
    organizationSlug = event.organization?.slug;
    eventSlug = event.slug;
  } catch (error) { return safeError(error); }
  refreshEvent(path, organizationSlug, eventSlug);
  redirect(path);
}

export async function updateEvent(eventId: string, scope: string | null, _previous: EventActionState, form: FormData): Promise<EventActionState> {
  const { user, event } = await requireEventAccess(eventId, scope);
  if (!["DRAFT", "PUBLISHED"].includes(event.status)) return { message: "This event is read-only. Cancelled events cannot be edited or republished." };
  const result = updateEventSchema.safeParse({ ...fieldsFromForm(form), organizationId: event.organizationId ?? "" });
  if (!result.success) return { errors: result.error.flatten().fieldErrors, message: "Please check the highlighted fields." };
  if (form.get("version") !== event.updatedAt.toISOString()) return { message: "This event changed while you were editing. Reload it before saving." };
  const data = eventDataFromInput(result.data);
  let count: number;
  try {
    const updated = await getDb().event.updateMany({
      where: { id: event.id, status: event.status, updatedAt: event.updatedAt, AND: [eventAccessWhere(user.id)] }, data,
    });
    count = updated.count;
  } catch (error) { return safeError(error); }
  if (!count) return { message: "This event changed or your access was removed. Reload it before saving." };
  const path = eventManagementPath(event);
  refreshEvent(path, event.organization?.slug, event.slug);
  redirect(path);
}

export async function publishEvent(eventId: string, scope: string | null, _previous: EventActionState, form: FormData): Promise<EventActionState> {
  const { user, event } = await requireEventAccess(eventId, scope);
  if (event.status !== "DRAFT") return { message: "Only draft events can be published. Cancelled events cannot be republished." };
  if (form.get("confirm") !== "yes") return { message: "Confirm that you want to publish this event." };
  try {
    const result = createEventSchema.safeParse(eventToFormValues(event));
    if (!result.success) return { message: "This draft is not ready to publish. Edit it and complete all required details." };
  } catch { return { message: "This draft is not ready to publish. Edit it and complete all required details." }; }
  let count: number;
  try {
    count = await getDb().$transaction(async (tx) => {
      const updated = await tx.event.updateMany({ where: { id: event.id, status: "DRAFT", updatedAt: event.updatedAt, AND: [eventAccessWhere(user.id)] }, data: { status: "PUBLISHED" } });
      if (updated.count) await notifyEventPublished(tx, event.id);
      return updated.count;
    }, { maxWait: 10000, timeout: 15000 });
  } catch { return { message: "We couldn’t publish this event. Please try again shortly." }; }
  if (!count) return { message: "This event changed or your access was removed. Reload it before publishing." };
  refreshEvent(eventManagementPath(event), event.organization?.slug, event.slug);
  redirect(eventManagementPath(event));
}

export async function cancelEvent(eventId: string, scope: string | null, _previous: EventActionState, form: FormData): Promise<EventActionState> {
  const { user, event } = await requireEventAccess(eventId, scope);
  if (event.status !== "PUBLISHED") return { message: "Only published events can be cancelled." };
  if (form.get("confirm") !== "yes") return { message: "Confirm that you want to cancel this event." };
  let count: number;
  try {
    count = await getDb().$transaction(async (tx) => {
      const updated = await tx.event.updateMany({ where: { id: event.id, status: "PUBLISHED", updatedAt: event.updatedAt, AND: [eventAccessWhere(user.id)] }, data: { status: "CANCELLED" } });
      if (updated.count) {
        await tx.eventReminderPreference.updateMany({ where: { eventId: event.id, enabled: true }, data: { enabled: false } });
        await notifyEventCancelled(tx, event.id);
      }
      return updated.count;
    }, { maxWait: 10000, timeout: 15000 });
  } catch { return { message: "We couldn’t cancel this event. Please try again shortly." }; }
  if (!count) return { message: "This event changed or your access was removed. Reload it before cancelling." };
  refreshEvent(eventManagementPath(event), event.organization?.slug, event.slug);
  redirect(eventManagementPath(event));
}

export async function completeEvent(eventId: string, scope: string | null, _previous: EventActionState, form: FormData): Promise<EventActionState> {
  const user = await requireUser();
  const result = await completeManagedEvent(getDb(), user.id, eventId, scope, form.get("confirm") === "yes");
  if (!result.ok) return { message: result.message };
  const path = scope ? `/organizer/${scope}/events/${eventId}` : `/dashboard/events/${eventId}`;
  refreshEvent(path, scope ?? undefined, "slug" in result ? result.slug : undefined);
  revalidatePath(`${path}/attendees`);
  revalidatePath(`${path}/analytics`);
  revalidatePath(`${path}/feedback`);
  redirect(path);
}
