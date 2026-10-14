"use server";
import { revalidatePath } from "next/cache";
import { mutateCollection, mutateCollectionMemberships } from "./service";
import { getCollectionPickerData } from "./queries";
import type { CollectionResult } from "../schemas";
function invalidate(result: CollectionResult) {
  if (result.ok) { revalidatePath("/", "layout"); revalidatePath("/dashboard/saved/[collectionId]", "page"); }
  return result;
}
export async function createCollection(input: unknown) { return invalidate(await mutateCollection(input, "create")); }
export async function renameCollection(input: unknown) { return invalidate(await mutateCollection(input, "rename")); }
export async function deleteCollection(input: unknown) { return invalidate(await mutateCollection(input, "delete")); }
export async function updateEventCollections(input: unknown) { return invalidate(await mutateCollectionMemberships(input)); }
export async function loadEventCollections(slug: unknown) {
  try {
    const data = await getCollectionPickerData(slug);
    return data ? { ok: true as const, data } : { ok: false as const, message: "Sign in to manage your collections." };
  } catch { return { ok: false as const, message: "We could not load your collections. Please try again." }; }
}
