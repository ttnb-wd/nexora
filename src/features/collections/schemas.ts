import { z } from "zod";
import { participationSlugSchema } from "@/features/participation/rules";
export const COLLECTION_LIMIT = 50;
export const COLLECTION_PAGE_SIZE = 24;
export const collectionNameSchema = z.string().max(256).transform(value => value.trim()).refine(value => Array.from(value).length >= 1 && Array.from(value).length <= 60 && !/\p{Cc}/u.test(value), "Use a collection name between 1 and 60 characters.");
export const collectionIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const createCollectionSchema = z.object({ name: collectionNameSchema }).strict();
export const renameCollectionSchema = z.object({ id: collectionIdSchema, name: collectionNameSchema }).strict();
export const deleteCollectionSchema = z.object({ id: collectionIdSchema, confirm: z.literal(true) }).strict();
export const membershipSchema = z.object({ slug: participationSlugSchema, collectionIds: z.array(collectionIdSchema).max(COLLECTION_LIMIT).refine(ids => new Set(ids).size === ids.length) }).strict();
export type CollectionSummary = { id: string; name: string; count: number; updatedAt: string };
export type CollectionResult = { ok: boolean; message: string; collection?: CollectionSummary; saved?: boolean; signIn?: string };
export type CollectionPickerData = { collections: CollectionSummary[]; selectedIds: string[]; saved: boolean };
export function collectionPage(value: unknown) { const page = Number(value); return Number.isSafeInteger(page) && page >= 1 ? Math.min(page, 10000) : 1; }
