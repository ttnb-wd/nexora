import { eventSlugSchema } from "@/features/events/management-schemas";
export const participationSlugSchema = eventSlugSchema;
export type ParticipationResult = { ok: boolean; message: string; signIn?: string };
export type Availability = { closedReason: string | null; spotsLeft: number | null };
export type ViewerParticipation = { authenticated: boolean; joined: boolean; attended: boolean; saved: boolean };
// Check-in records continue occupying their registered seat.
export const occupiedRegistrationStatuses = ["REGISTERED", "ATTENDED"] as const;
export function eventReturnPath(value: unknown) {
  return typeof value === "string" && /^\/events\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 108 ? value : "/dashboard";
}
export function eventSignInPath(slug: string) { return `/sign-in?returnTo=${encodeURIComponent(eventReturnPath(`/events/${slug}`))}`; }
export function registrationClosedReason(event: { status: string; startAt: Date; endAt: Date; registrationDeadline: Date | null }, now = new Date()) {
  if (event.status !== "PUBLISHED") return "This event is no longer available.";
  if (event.startAt <= now || event.endAt <= now) return "This event has ended or already started.";
  if (event.registrationDeadline && event.registrationDeadline <= now) return "Registration is closed.";
  return null;
}
