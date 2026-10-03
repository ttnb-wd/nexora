"use server";
import { revalidatePath } from "next/cache";
import { markRead } from "./service";
async function mark(input?: string, all = false) {
  const result = await markRead(input, all);
  if (result.ok) { revalidatePath("/", "layout"); revalidatePath("/dashboard/notifications"); }
  return result;
}
export async function markNotificationRead(id: string) { return mark(id); }
export async function markAllNotificationsRead() { return mark(undefined, true); }
