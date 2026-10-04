"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthorizedUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { createAndEmailInvitation } from "./delivery";
import { allowTeamRequest } from "./rate-limit";
import { changeTeamRole, removeTeamMember, respondToInvitation, revokeTeamInvitation, TeamError } from "./service";
import type { TeamActionState } from "./types";

export async function manageOrganizationTeam(slug: string, _previous: TeamActionState, form: FormData): Promise<TeamActionState> {
  const user = await getAuthorizedUser();
  if (!user) return { message: "Sign in to manage your team." };
  const db = getDb();
  const operation = form.get("operation"), id = String(form.get("id") ?? ""), expectedRole = String(form.get("expectedRole") ?? "");
  let left = false;
  let invitationResult: TeamActionState | undefined;
  try {
    if (operation === "invite" || operation === "reissue") {
      invitationResult = await createAndEmailInvitation(db, user.id, slug, { email: form.get("email"), role: form.get("role") }, operation === "reissue" ? id : undefined);
    } else if (operation === "revoke") await revokeTeamInvitation(db, user.id, slug, id);
    else if (operation === "role") await changeTeamRole(db, user.id, slug, id, expectedRole, form.get("role"));
    else if (operation === "remove" || operation === "leave") left = (await removeTeamMember(db, user.id, slug, operation === "leave" ? undefined : id, expectedRole)).left;
    else throw new TeamError("Choose a valid team action.");
  } catch (error) { return { message: error instanceof TeamError ? error.message : "Unable to update your team. Please try again." }; }
  revalidatePath("/organizer", "layout");
  revalidatePath("/dashboard");
  if (left) redirect("/organizer");
  return invitationResult ?? { ok: true, message: "Team updated." };
}

export async function answerOrganizationInvitation(token: string, _previous: TeamActionState, form: FormData): Promise<TeamActionState> {
  const user = await getAuthorizedUser();
  if (!user) return { message: "Sign in to accept invitation" };
  const response = form.get("response");
  if (response !== "accept" && response !== "decline") return { message: "Choose accept or decline." };
  try {
    const db = getDb();
    if (!await allowTeamRequest(db, user.id, "respond")) return { message: "Too many attempts. Please try again in a minute." };
    const result = await respondToInvitation(db, user.id, token, response);
    revalidatePath("/organizer", "layout");
    revalidatePath(`/invitations/${token}`);
    return { ok: true, message: result.state === "accepted" ? "Invitation accepted. Welcome to the team." : "Invitation declined.", ...result };
  } catch (error) { return { message: error instanceof TeamError ? error.message : "Unable to respond to this invitation. Please try again." }; }
}
