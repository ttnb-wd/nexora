import { getDb } from "@/lib/db";
import { handleReminderJob } from "@/features/events/reminders/job-request";
import { processDueReminders } from "@/features/events/reminders/scheduler";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return handleReminderJob(request, process.env.CRON_SECRET, () => processDueReminders(getDb()));
}
