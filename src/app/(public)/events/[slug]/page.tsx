import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mockEvents } from "@/features/events/data/mock-events";
import { getEventBySlug, getRelatedEvents } from "@/features/events/event-helpers";
import { EventDetailExperience } from "@/features/events/components/event-detail-experience";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return mockEvents.map((event) => ({ slug: event.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  return event ? { title: event.title, description: event.description } : { title: "Event not found", robots: { index: false, follow: false } };
}
export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) notFound();
  return <EventDetailExperience key={event.id} event={event} related={getRelatedEvents(event)} />;
}
