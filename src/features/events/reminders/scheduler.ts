import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { reminderMinutesSchema } from "./schemas";

export const reminderBatchSize = 50;
export type ReminderRunResult = { processed: number; delivered: number; skipped: number; failed: number };
export function reminderDeliveryKey(preferenceId: string, startAt: Date) {
  // One delivery per preference and event start, even if its duration is edited,
  // toggled off/on, or registration is cancelled/rejoined. Rescheduling creates
  // a new occurrence. Reading a notification never removes this ledger entry.
  return `reminder:${preferenceId}:${startAt.getTime()}`;
}
export function reminderMessage(title: string, minutes: number) {
  const duration = minutes === 1440 ? "1 day" : minutes === 60 ? "1 hour" : `${minutes} minutes`;
  return `${title} starts in ${duration}.`;
}
/** Production and diagnostic callers share this parameterized query. Its maximum
 * startAt window is one day; existing status/startAt, eventId/enabled and unique
 * notification dedupeKey indexes cover the range, join and delivery anti-join. */
export async function selectDueReminders(db: PrismaClient) {
  return db.$queryRaw<{ id: string; eventId: string }[]>`
    SELECT p."id", p."eventId"
    FROM "Event" e
    JOIN "EventReminderPreference" p ON p."eventId" = e."id" AND p."enabled" = true
    JOIN "EventRegistration" r ON r."eventId" = e."id" AND r."userId" = p."userId" AND r."status" = 'REGISTERED'
    WHERE e."status" = 'PUBLISHED'
      AND e."startAt" > CURRENT_TIMESTAMP
      AND e."startAt" <= CURRENT_TIMESTAMP + INTERVAL '1 day'
      AND p."reminderMinutes" IN (15, 30, 60, 1440)
      AND e."startAt" - p."reminderMinutes" * INTERVAL '1 minute' <= CURRENT_TIMESTAMP
      AND NOT EXISTS (SELECT 1 FROM "Notification" n WHERE n."dedupeKey" =
        'reminder:' || p."id" || ':' || ((EXTRACT(EPOCH FROM e."startAt") * 1000)::bigint)::text)
    ORDER BY e."startAt" - p."reminderMinutes" * INTERVAL '1 minute', p."id"
    LIMIT ${reminderBatchSize}
  `;
}
export async function processDueReminders(db: PrismaClient): Promise<ReminderRunResult> {
  // Leave room for the last transaction and response within the route's budget.
  // Scheduling still uses PostgreSQL time; this monotonic clock only bounds work.
  const deadline = performance.now() + 40_000;
  const candidates = await selectDueReminders(db);
  const result: ReminderRunResult = { processed: 0, delivered: 0, skipped: 0, failed: 0 };
  for (const candidate of candidates) {
    if (performance.now() >= deadline) break;
    result.processed++;
    try {
      const delivered = await db.$transaction(async (tx) => {
        // Lock order matches preference, registration and organizer mutations.
        // A second job waits, then sees the committed unique delivery record.
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${candidate.eventId} FOR UPDATE`;
        const preference = await tx.eventReminderPreference.findUnique({ where: { id: candidate.id },
          select: { id: true, eventId: true, userId: true, enabled: true, reminderMinutes: true } });
        if (!preference?.enabled || preference.eventId !== candidate.eventId || !reminderMinutesSchema.safeParse(preference.reminderMinutes).success) return false;
        const event = await tx.event.findUnique({ where: { id: candidate.eventId },
          select: { status: true, startAt: true, title: true, slug: true } });
        const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
        if (!event || event.status !== "PUBLISHED" || event.startAt <= now || event.startAt.getTime() - preference.reminderMinutes * 60_000 > now.getTime()) return false;
        const registration = await tx.eventRegistration.findUnique({ where: { userId_eventId: { userId: preference.userId, eventId: candidate.eventId } }, select: { status: true } });
        if (registration?.status !== "REGISTERED") return false;
        // The notification IS the persisted delivery record. Its unique key and
        // skipDuplicates also protect against concurrent/non-cooperating callers.
        const created = await tx.notification.createMany({ data: [{
          userId: preference.userId, type: "EVENT_REMINDER", title: "Event starts soon",
          message: reminderMessage(event.title, preference.reminderMinutes), href: `/events/${event.slug}`,
          dedupeKey: reminderDeliveryKey(preference.id, event.startAt),
        }], skipDuplicates: true });
        return created.count === 1;
      }, { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 10000 });
      if (delivered) result.delivered++; else result.skipped++;
    } catch {
      // Never include database errors, identifiers or notification content in logs.
      result.failed++;
    }
  }
  return result;
}
