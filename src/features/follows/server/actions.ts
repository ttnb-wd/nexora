"use server";
import { revalidatePath } from "next/cache";
import { mutateFollow } from "./service";
async function mutate(slug: string, following: boolean) {
  const result = await mutateFollow(slug, following);
  if (result.ok) {
    revalidatePath("/", "layout");
    revalidatePath(`/companies/${slug}`);
    revalidatePath("/companies");
    revalidatePath("/dashboard/following");
    revalidatePath("/dashboard");
  }
  return result;
}
export async function followOrganization(slug: string) { return mutate(slug, true); }
export async function unfollowOrganization(slug: string) { return mutate(slug, false); }
