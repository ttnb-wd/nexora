import { ExploreExperience } from "@/features/events/components/explore-experience";
import { getPublishedEvents } from "@/features/events/server/public-event-queries";
export const dynamic = "force-dynamic";
export const metadata = { title: "Explore Events", description: "Discover upcoming technology, design, business, and community events on Nexora." };
export default async function ExplorePage() {
  const now = new Date();
  let events: Awaited<ReturnType<typeof getPublishedEvents>> = [];
  let unavailable = false;
  try {
    events = await getPublishedEvents(now);
  } catch (error) {
    console.error("Public event discovery query failed", error);
    unavailable = true;
  }
  return <ExploreExperience publishedEvents={events} featuredEvent={events[0] ?? null} now={now.toISOString()} unavailable={unavailable} />;
}
