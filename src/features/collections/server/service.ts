import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { getAuthorizedUser } from "@/features/auth/server/session";
import { eventSignInPath } from "@/features/participation/rules";
import { COLLECTION_LIMIT, createCollectionSchema, renameCollectionSchema, deleteCollectionSchema, membershipSchema, type CollectionResult } from "../schemas";

const unavailable = { ok: false, message: "This collection is unavailable." };
const signIn = { ok: false, message: "Please sign in to manage collections.", signIn: "/sign-in?returnTo=%2Fdashboard%2Fsaved%3Fview%3Dcollections" };
const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 };
function safeFailure(error: unknown): CollectionResult {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
    ? { ok: false, message: "You already have a collection with that name." }
    : { ok: false, message: "We could not update your collections. Please try again." };
}
/** PostgreSQL is the canonical case-normalizer, including non-ASCII names. */
async function normalizedName(tx: Prisma.TransactionClient, name: string) {
  const [row] = await tx.$queryRaw<{ value: string }[]>`SELECT lower(${name}::text) AS value`;
  return row.value;
}
async function lockOwner(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}
export async function mutateCollection(input: unknown, operation: "create" | "rename" | "delete"): Promise<CollectionResult> {
  const parsed = (operation === "create" ? createCollectionSchema : operation === "rename" ? renameCollectionSchema : deleteCollectionSchema).safeParse(input);
  if (!parsed.success) return { ok: false, message: operation === "delete" ? "Confirm collection deletion first." : "Use a collection name between 1 and 60 characters." };
  try {
    const user = await getAuthorizedUser();
    if (!user) return signIn;
    return await getDb().$transaction(async tx => {
      // Serializes per-owner cap/name operations; membership writes use event -> owner.
      await lockOwner(tx, user.id);
      const id = "id" in parsed.data ? parsed.data.id : null;
      if (id && !await tx.eventCollection.findFirst({ where: { id, userId: user.id }, select: { id: true } })) return unavailable;
      if (operation === "delete" && id) {
        await tx.eventCollection.deleteMany({ where: { id, userId: user.id } });
        return { ok: true, message: "Collection deleted. Your events are still saved." };
      }
      if (!("name" in parsed.data)) return unavailable;
      const name = parsed.data.name, normalized = await normalizedName(tx, name);
      const duplicate = await tx.eventCollection.findFirst({ where: { userId: user.id, normalizedName: normalized, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
      if (duplicate) return { ok: false, message: "You already have a collection with that name." };
      if (!id && await tx.eventCollection.count({ where: { userId: user.id } }) >= COLLECTION_LIMIT) return { ok: false, message: "You can have up to 50 collections. Delete one before creating another." };
      const record = id
        ? await tx.eventCollection.update({ where: { id_userId: { id, userId: user.id } }, data: { name, normalizedName: normalized }, select: { id: true, name: true, updatedAt: true, _count: { select: { memberships: true } } } })
        : await tx.eventCollection.create({ data: { userId: user.id, name, normalizedName: normalized }, select: { id: true, name: true, updatedAt: true, _count: { select: { memberships: true } } } });
      return { ok: true, message: id ? "Collection renamed." : "Collection created.", collection: { id: record.id, name: record.name, count: record._count.memberships, updatedAt: record.updatedAt.toISOString() } };
    }, transactionOptions);
  } catch (error) { return safeFailure(error); }
}
/** Replace only the current viewer's memberships, atomically saving on first add. */
export async function mutateCollectionMemberships(input: unknown): Promise<CollectionResult> {
  const parsed = membershipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose valid collections for this event." };
  const { slug, collectionIds } = parsed.data;
  try {
    const user = await getAuthorizedUser();
    if (!user) return { ...signIn, signIn: eventSignInPath(slug) };
    return await getDb().$transaction(async tx => {
      // Same first lock as Save/Unsave; both outcomes of their race are consistent.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "slug" = ${slug} FOR UPDATE`;
      await lockOwner(tx, user.id);
      const event = await tx.event.findUnique({ where: { slug }, select: { id: true, status: true } });
      if (!event) return { ok: false, message: "This event is no longer available." };
      const owned = await tx.eventCollection.count({ where: { userId: user.id, id: { in: collectionIds } } });
      if (owned !== collectionIds.length) return unavailable;
      const where = { userId_eventId: { userId: user.id, eventId: event.id } };
      const bookmark = await tx.eventBookmark.findUnique({ where, select: { id: true } });
      if (!bookmark && !["PUBLISHED", "COMPLETED"].includes(event.status)) return { ok: false, message: "This event is no longer available." };
      if (collectionIds.length) await tx.eventBookmark.upsert({ where, create: { userId: user.id, eventId: event.id }, update: {} });
      const existing = await tx.eventCollectionMembership.findMany({ where: { userId: user.id, eventId: event.id }, select: { collectionId: true }, take: COLLECTION_LIMIT });
      const removed = existing.filter(row => !collectionIds.includes(row.collectionId)).map(row => row.collectionId);
      const added = collectionIds.filter(id => !existing.some(row => row.collectionId === id));
      if (removed.length) await tx.eventCollectionMembership.deleteMany({ where: { userId: user.id, eventId: event.id, collectionId: { in: removed } } });
      if (added.length) await tx.eventCollectionMembership.createMany({ data: added.map(collectionId => ({ collectionId, userId: user.id, eventId: event.id })), skipDuplicates: true });
      if (removed.length || added.length) await tx.eventCollection.updateMany({ where: { userId: user.id, id: { in: [...removed, ...added] } }, data: { updatedAt: new Date() } });
      const saved = Boolean(bookmark) || collectionIds.length > 0;
      return { ok: true, message: saved ? "Collections updated. Your event stays saved." : "No collections selected. This event has not been saved.", saved };
    }, transactionOptions);
  } catch (error) { return safeFailure(error); }
}
