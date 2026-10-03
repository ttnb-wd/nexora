"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/features/auth/server/session";
import { requireOrganizationBySlug } from "@/features/auth/server/authorization";
import { getDb } from "@/lib/db";
import { createOrganizationSchema, updateOrganizationSchema, type OrganizationFormState } from "../schemas";

function readFields(form: FormData, includeSlug: boolean) {
  const names = ["name", "shortName", "description", "industry", "city", "region", "website", ...(includeSlug ? ["slug"] : [])];
  return Object.fromEntries(names.map((name) => [name, form.get(name) ?? ""]));
}
function formValues(fields: Record<string, FormDataEntryValue>) {
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export async function createOrganization(_previous: OrganizationFormState, form: FormData): Promise<OrganizationFormState> {
  const user = await requireUser();
  const fields = readFields(form, true);
  const values = formValues(fields);
  const result = createOrganizationSchema.safeParse(fields);
  if (!result.success) return { errors: result.error.flatten().fieldErrors, values, message: "Please check the highlighted fields." };
  let slug: string;
  try {
    const organization = await getDb().$transaction(async (tx) => {
      const created = await tx.organization.create({ data: result.data });
      await tx.organizationMember.create({ data: { userId: user.id, organizationId: created.id, role: "OWNER" } });
      return created;
    });
    slug = organization.slug;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { errors: { slug: ["This organization URL is already taken."] }, values };
    }
    return { message: "Something went wrong while creating the organization. Please try again shortly.", values };
  }
  revalidatePath("/companies");
  revalidatePath("/companies/[slug]", "page");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/");
  revalidatePath("/explore");
  revalidatePath("/organizer");
  revalidatePath("/dashboard");
  redirect(`/organizer/${slug}`);
}

export async function updateOrganization(slug: string, _previous: OrganizationFormState, form: FormData): Promise<OrganizationFormState> {
  const { user, organization } = await requireOrganizationBySlug(slug, ["OWNER", "ADMIN"]);
  const fields = readFields(form, false);
  const values = formValues(fields);
  const result = updateOrganizationSchema.safeParse(fields);
  if (!result.success) return { errors: result.error.flatten().fieldErrors, values, message: "Please check the highlighted fields." };
  let updatedCount: number;
  try {
    // The write itself is membership-scoped, even if access changed since the first check.
    const updated = await getDb().organization.updateMany({
      where: { id: organization.id, members: { some: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } } } },
      data: result.data,
    });
    updatedCount = updated.count;
  } catch {
    return { message: "Something went wrong while saving the organization. Please try again shortly.", values };
  }
  if (!updatedCount) notFound();
  revalidatePath("/companies");
  revalidatePath("/companies/[slug]", "page");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/");
  revalidatePath("/explore");
  revalidatePath("/organizer");
  revalidatePath(`/organizer/${organization.slug}`);
  revalidatePath(`/organizer/${organization.slug}/settings`);
  redirect(`/organizer/${organization.slug}?saved=1`);
}
