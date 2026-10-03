import "server-only";
import { getDb } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/features/auth/server/session";
import { safeReturnPath } from "@/features/auth/return-path";
export async function getUserNotifications() {
  const user = await requireUser();
  const rows = await getDb().notification.findMany({ where: { userId: user.id }, select: { id: true, title: true, message: true, href: true, readAt: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 });
  return rows.map((row) => ({ id: row.id, title: row.title, message: row.message, href: row.href && safeReturnPath(row.href) === row.href ? row.href : null, readAt: row.readAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() }));
}
export async function getUnreadNotificationCount() {
  const user = await getCurrentUser();
  if (!user) return 0;
  return getDb().notification.count({ where: { userId: user.id, readAt: null } });
}
