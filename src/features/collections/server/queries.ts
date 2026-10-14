import "server-only";
import { getDb } from "@/lib/db";
import { getAuthorizedUser, requireUser } from "@/features/auth/server/session";
import { participationSlugSchema } from "@/features/participation/rules";
import { mapPublicEvent, publicEventSelect } from "@/features/events/server/public-event-mapper";
import { COLLECTION_LIMIT, COLLECTION_PAGE_SIZE, collectionIdSchema, collectionPage, type CollectionPickerData } from "../schemas";

const collectionSelect = { id: true, name: true, updatedAt: true, _count: { select: { memberships: true } } } as const;
function summary(record: { id: string; name: string; updatedAt: Date; _count: { memberships: number } }) {
  return { id: record.id, name: record.name, updatedAt: record.updatedAt.toISOString(), count: record._count.memberships };
}
/** Lazy authenticated picker read: two scoped ORM reads, never one read per card. */
export async function getCollectionPickerData(input: unknown): Promise<CollectionPickerData | null> {
  const parsed = participationSlugSchema.safeParse(input);
  const user = await getAuthorizedUser();
  if (!user || !parsed.success) return null;
  const db = getDb();
  const [collections, bookmark] = await Promise.all([
    db.eventCollection.findMany({ where: { userId: user.id }, select: collectionSelect, orderBy: [{ name: "asc" }, { id: "asc" }], take: COLLECTION_LIMIT }),
    db.eventBookmark.findFirst({ where: { userId: user.id, event: { slug: parsed.data } }, select: { collectionMemberships: { where: { userId: user.id }, select: { collectionId: true }, take: COLLECTION_LIMIT } } }),
  ]);
  return { collections: collections.map(summary), selectedIds: bookmark?.collectionMemberships.map(row => row.collectionId) ?? [], saved: Boolean(bookmark) };
}
export async function getPersonalCollections() {
  const user = await requireUser();
  const rows = await getDb().eventCollection.findMany({ where: { userId: user.id }, select: collectionSelect, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: COLLECTION_LIMIT });
  return rows.map(summary);
}
export async function getPersonalSavedPage(pageInput: unknown, collectionInput?: unknown) {
  const user = await requireUser(), db = getDb(), page = collectionPage(pageInput);
  const parsed = collectionInput === undefined ? null : collectionIdSchema.safeParse(collectionInput);
  if (parsed && !parsed.success) return null;
  const collection = parsed?.success ? await db.eventCollection.findFirst({ where: { id: parsed.data, userId: user.id }, select: collectionSelect }) : null;
  if (parsed && !collection) return null;
  const where = { userId: user.id, ...(collection ? { collectionMemberships: { some: { collectionId: collection.id, userId: user.id } } } : {}) };
  const [total, bookmarks] = await Promise.all([
    db.eventBookmark.count({ where }),
    db.eventBookmark.findMany({ where, select: { event: { select: publicEventSelect } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * COLLECTION_PAGE_SIZE, take: COLLECTION_PAGE_SIZE }),
  ]);
  const now = new Date();
  return { collection: collection ? summary(collection) : null, page, total, pages: Math.ceil(total / COLLECTION_PAGE_SIZE), rows: bookmarks.map(({ event }) => ({ event: mapPublicEvent(event, now), eventStatus: event.status, publicVisible: ["PUBLISHED", "COMPLETED"].includes(event.status) })) };
}
