import type { PrismaClient } from "@/generated/prisma/client";
import { eventSlugSchema } from "../management-schemas";
import { reminderMinutesSchema, reminderOff, type ReminderState } from "./schemas";
const selection = { id: true, status: true, startAt: true } as const;
function eligible(event: { status: string; startAt: Date }, status?: string, now = new Date()) {
  return event.status === "PUBLISHED" && event.startAt > now && status === "REGISTERED";
}
/** The caller supplies session identity, never form identity. All eligibility reads follow the event lock. */
export async function mutateReminder(db: PrismaClient, userId: string | null, slug: unknown, minutes: unknown, disable = false) {
  if (!userId) return { ok: false, message: "Please sign in to set a reminder." };
  const target = eventSlugSchema.safeParse(slug), value = reminderMinutesSchema.safeParse(minutes);
  if (!target.success || (!disable && !value.success)) return { ok: false, message: "Choose an available reminder time." };
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "slug" = ${target.data} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { slug: target.data }, select: selection });
      if (!event) return { ok: false, message: "This event is no longer available." };
      const where = { userId_eventId: { userId, eventId: event.id } };
      const registration = await tx.eventRegistration.findUnique({ where, select: { status: true } });
      if (!eligible(event, registration?.status)) return { ok: false, message: "Reminders are available for upcoming events you are registered for." };
      if (disable) await tx.eventReminderPreference.updateMany({ where: { userId, eventId: event.id, enabled: true }, data: { enabled: false } });
      else {
        const reminderMinutes = value.data!;
        await tx.eventReminderPreference.upsert({ where, create: { userId, eventId: event.id, enabled: true, reminderMinutes }, update: { enabled: true, reminderMinutes } });
      }
      return { ok: true, message: disable ? "Reminder turned off." : "Reminder preference saved. Automatic delivery is not available yet." };
    }, { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 15000 });
  } catch { return { ok: false, message: "We could not save your reminder. Please try again." }; }
}
export async function readViewerReminder(db: PrismaClient, userId: string | null, slug: string): Promise<ReminderState> {
  if (!userId || !eventSlugSchema.safeParse(slug).success) return reminderOff;
  const event = await db.event.findUnique({ where: { slug }, select: { ...selection,
    registrations: { where: { userId }, select: { status: true } },
    reminderPreferences: { where: { userId }, select: { enabled: true, reminderMinutes: true } } } });
  if (!event || !eligible(event, event.registrations[0]?.status)) return reminderOff;
  const preference = event.reminderPreferences[0];
  return { eligible: true, enabled: preference?.enabled ?? false, reminderMinutes: preference?.enabled ? preference.reminderMinutes : null };
}
