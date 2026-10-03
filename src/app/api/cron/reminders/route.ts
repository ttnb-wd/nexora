import "server-only";
import { getDb } from "@/lib/db";
import { handleReminderCron } from "@/features/events/reminders/job-request";
import { processDueReminders } from "@/features/events/reminders/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  return handleReminderCron(request, process.env.CRON_SECRET, () => processDueReminders(getDb()));
}
