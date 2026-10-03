"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { answerOrganizationInvitation, manageOrganizationTeam } from "./actions";
import { allowedTeamRoles, canLeaveOrganization, canManageMemberRole, canRemoveMember, canRevokeInvitation } from "./policy";
import type { OrganizationRole } from "@/generated/prisma/enums";
import type { TeamActionState } from "./types";
import styles from "./team.module.css";
const initial: TeamActionState = {};
const buttonClass = buttonStyles({ variant: "secondary" });
function ConfirmSubmit({ name, value, label, message, pending }: { name: string; value: string; label: string; message: string; pending: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submit = useRef<HTMLButtonElement>(null);
  return <><button ref={submit} type="submit" name={name} value={value} className={buttonClass} disabled={pending} onClick={event => { event.preventDefault(); dialog.current?.showModal(); }}>{label}</button><dialog ref={dialog} className={styles.dialog} aria-label={label}><h2>{label}</h2><p>{message}</p><div className={styles.actions}><button type="button" className={buttonClass} autoFocus onClick={() => dialog.current?.close()}>Cancel</button><button type="button" className={buttonClass} data-confirm disabled={pending} onClick={() => { dialog.current?.close(); if (submit.current) submit.current.form?.requestSubmit(submit.current); }}>Confirm</button></div></dialog></>;
}
function Result({ state }: { state: TeamActionState }) {
  const [copy, setCopy] = useState({ link: "", message: "" });
  return <>{state.message && <p className={styles.message} role={state.ok ? "status" : "alert"}>{state.message}</p>}{state.link && <div><label>Invitation link<input aria-label="Invitation link" className={styles.link} readOnly value={state.link} onFocus={event => event.target.select()} /></label><button type="button" className={buttonClass} onClick={async () => { try { await navigator.clipboard.writeText(state.link!); setCopy({ link: state.link!, message: "Link copied." }); } catch { setCopy({ link: state.link!, message: "Select and copy the link above." }); } }}>Copy invitation link</button><p role="status">{copy.link === state.link ? copy.message : ""}</p></div>}</>;
}
export function InviteForm({ slug, role }: { slug: string; role: OrganizationRole }) {
  const [state, action, pending] = useActionState(manageOrganizationTeam.bind(null, slug), initial);
  const roles = allowedTeamRoles(role);
  if (!roles.length) return null;
  return <section className={styles.section}><h2>Invite someone</h2><p className={styles.hint}>Share a private invitation link. Invitations expire after 7 days.</p><form action={action} className={styles.form}><input type="hidden" name="operation" value="invite" /><div className={styles.field}><label htmlFor="team-email">Email</label><input id="team-email" name="email" type="email" required maxLength={254} autoComplete="email" /></div><div className={styles.field}><label htmlFor="team-role">Role</label><select id="team-role" name="role" defaultValue="MEMBER">{roles.map(value => <option key={value}>{value}</option>)}</select></div><button className={buttonClass} disabled={pending}>{pending ? "Creating invitation…" : "Invite"}</button></form><Result state={state} /></section>;
}
export function MemberActions({ slug, actorRole, member }: { slug: string; actorRole: OrganizationRole; member: { id: string; name: string; role: OrganizationRole; self: boolean } }) {
  const [state, action, pending] = useActionState(manageOrganizationTeam.bind(null, slug), initial);
  const roles = allowedTeamRoles(actorRole).filter(role => canManageMemberRole(actorRole, member.role, role));
  const removable = member.self ? canLeaveOrganization(member.role) : canRemoveMember(actorRole, member.role);
  return <div><form action={action} className={styles.actions}><input type="hidden" name="id" value={member.id} /><input type="hidden" name="expectedRole" value={member.role} />{roles.length > 0 && <><label>Role for {member.name}<select name="role" defaultValue={member.role} disabled={pending}>{roles.map(role => <option key={role}>{role}</option>)}</select></label><button name="operation" value="role" className={buttonClass} disabled={pending}>Save role</button></>}{removable && <ConfirmSubmit name="operation" value="remove" label={member.self ? "Leave organization" : "Remove member"} message={member.self ? "Your organization access will end immediately." : `Remove ${member.name} from the team? Their access will end immediately.`} pending={pending} />}{member.role === "OWNER" && <p className={styles.hint}>Owner role is protected.</p>}</form><Result state={state} /></div>;
}
export function InvitationActions({ slug, actorRole, id, role }: { slug: string; actorRole: OrganizationRole; id: string; role: OrganizationRole }) {
  const [state, action, pending] = useActionState(manageOrganizationTeam.bind(null, slug), initial);
  if (!canRevokeInvitation(actorRole, role)) return null;
  return <div><form action={action} className={styles.actions}><input type="hidden" name="id" value={id} /><ConfirmSubmit name="operation" value="reissue" label="Reissue link" message="The previous invitation link will stop working. Copy and share the new link after reissuing." pending={pending} /><ConfirmSubmit name="operation" value="revoke" label="Revoke" message="This invitation link will stop working permanently." pending={pending} /></form><Result state={state} /></div>;
}
export function InvitationResponse({ token, active }: { token: string; active: boolean }) {
  const [state, action, pending] = useActionState(answerOrganizationInvitation.bind(null, token), initial);
  return <><form action={action} className={styles.actions}>{active && !state.ok && <><button name="response" value="accept" className={buttonClass} disabled={pending}>Accept invitation</button><ConfirmSubmit name="response" value="decline" label="Decline invitation" message="You can ask for a new invitation later." pending={pending} /></>}</form><Result state={state} />{state.state === "accepted" && state.slug && <Link className={buttonClass} href={`/organizer/${state.slug}`}>Go to organization</Link>}</>;
}
