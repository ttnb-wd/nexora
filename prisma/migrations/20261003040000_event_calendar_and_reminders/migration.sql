ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER';
CREATE TABLE "EventReminderPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "reminderMinutes" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "EventReminderPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventReminderPreference_minutes_check" CHECK ("reminderMinutes" IN (15, 30, 60, 1440))
);
CREATE UNIQUE INDEX "EventReminderPreference_userId_eventId_key" ON "EventReminderPreference"("userId", "eventId");
CREATE INDEX "EventReminderPreference_eventId_enabled_idx" ON "EventReminderPreference"("eventId", "enabled");
CREATE INDEX "EventReminderPreference_enabled_eventId_idx" ON "EventReminderPreference"("enabled", "eventId");
ALTER TABLE "EventReminderPreference" ADD CONSTRAINT "EventReminderPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventReminderPreference" ADD CONSTRAINT "EventReminderPreference_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
