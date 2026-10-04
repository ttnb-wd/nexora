import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getAuthorizedUser } from "@/features/auth/server/session";
import type { ParticipationResult } from "@/features/participation/rules";
const notificationIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export async function markRead(input?: unknown, all = false): Promise<ParticipationResult> {
  if (!all && !notificationIdSchema.safeParse(input).success) return { ok: false, message: "This notification is unavailable." };
  try {
    const user = await getAuthorizedUser();
    if (!user) return { ok: false, message: "Please sign in to continue.", signIn: "/sign-in?returnTo=%2Fdashboard%2Fnotifications" };
    await getDb().notification.updateMany({ where: { userId: user.id, readAt: null, ...(!all ? { id: input as string } : {}) }, data: { readAt: new Date() } });
    // Same response for nonexistent and other-user records: never reveal ownership.
    return { ok: true, message: all ? "All notifications marked read." : "Notification marked read." };
  } catch { return { ok: false, message: "We could not update your notifications. Please try again shortly." }; }
}
