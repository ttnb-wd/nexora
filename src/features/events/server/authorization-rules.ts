import type { Prisma } from "@/generated/prisma/client";
export const eventManagerRoles = ["OWNER", "ADMIN", "EDITOR"] as const;
export function eventAccessWhere(userId: string, manage = true): Prisma.EventWhereInput {
  return { OR: [
    { organizationId: null, creatorId: userId },
    { organization: { members: { some: { userId, ...(manage ? { role: { in: [...eventManagerRoles] } } : {}) } } } },
  ] };
}
