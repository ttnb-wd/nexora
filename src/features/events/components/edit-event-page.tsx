import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireEventAccess, eventManagementPath } from "../server/authorization";
import { updateEvent } from "../server/actions";
import { eventToFormValues } from "../server/form-values";
import { EventWizard } from "./event-wizard";
import styles from "./event-management.module.css";
export async function EditEventPage({ eventId, scope }: { eventId: string; scope: string | null }) {
  const { event, user } = await requireEventAccess(eventId, scope);
  if (!["DRAFT", "PUBLISHED"].includes(event.status)) notFound();
  const path = eventManagementPath(event);
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href={path} className={styles.back}>← Event overview</Link><p className={styles.eyebrow}>EDIT EVENT · {event.status}</p><h1>Keep your gathering current.</h1><p className={styles.intro}>Update the details. Your event keeps its current status and organizer.</p><EventWizard action={updateEvent.bind(null, event.id, scope)} organizations={event.organization ? [event.organization] : []} individualName={user.name} initialValues={eventToFormValues(event)} edit version={event.updatedAt.toISOString()} returnPath={path} /></Container></main>;
}
