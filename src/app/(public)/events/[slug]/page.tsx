import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedEventBySlug, getRelatedPublishedEvents } from "@/features/events/server/public-event-queries";
import { EventDetailExperience } from "@/features/events/components/event-detail-experience";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const event = await getPublishedEventBySlug(slug);
    return event ? { title: event.title, description: event.description } : { title: "Event not found", robots: { index: false, follow: false } };
  } catch (error) {
    console.error("Public event metadata query failed", error);
    return { title: "Event unavailable", robots: { index: false, follow: false } };
  }
}
export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;
  let event: Awaited<ReturnType<typeof getPublishedEventBySlug>>;
  try { event = await getPublishedEventBySlug(slug); }
  catch (error) { console.error("Public event detail query failed", error); throw new Error("Event temporarily unavailable"); }
  if (!event) notFound();
  let related: Awaited<ReturnType<typeof getRelatedPublishedEvents>> = [];
  try { related = await getRelatedPublishedEvents(event); }
  catch (error) { console.error("Related public events query failed", error); }
  return <EventDetailExperience key={event.id} event={event} related={related} />;
}
