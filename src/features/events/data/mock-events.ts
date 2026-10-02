import type { Event } from "../types";
import { completedDetail, getMockDetail } from "./mock-event-details";

// Stable demo calendar: date filters intentionally use this date, never the host clock.
export const demoToday = "2026-10-02";
const eventPreviews: Omit<Event, "slug" | "tags" | "status" | "details">[] = [
  { id: "future-forum", title: "The future is a shared idea.", category: "Technology", date: "2026-10-18", time: "10:00 AM – 5:00 PM · MMT", location: { city: "Yangon", venue: "The Glasshouse" }, organizationId: "tomorrow-collective", type: "Hybrid", description: "A day of bold conversations, hands-on experiments, and fresh perspectives on the technology shaping how we live. Bring your curiosity. Leave with a new direction.", visual: { tone: "cyan", headline: "FUTURE / FORWARD", caption: "Ideas in motion. People in connection." }, featured: true },
  { id: "design-motion", title: "Design in motion", category: "Design", date: "2026-10-04", time: "2:00 – 6:00 PM · MMT", location: { city: "Yangon", venue: "Studio 09" }, organizationId: "form-and-friends", type: "In person", description: "Explore the space between a first sketch and a feeling that stays with you.", visual: { tone: "pink", headline: "MAKE / FEEL", caption: "An afternoon for creative minds." } },
  { id: "ai-lab", title: "AI, beyond the buzz", category: "AI", date: "2026-10-06", time: "6:00 – 8:00 PM · MMT", location: { city: "Online", venue: "Live virtual workshop" }, organizationId: "open-lab", type: "Online", description: "A practical workshop for turning curious questions into useful experiments.", visual: { tone: "cyan", headline: "HUMAN + MACHINE", caption: "Less hype. More hands-on." } },
  { id: "community-table", title: "A seat at the community table", category: "Community", date: "2026-10-10", time: "4:00 – 7:00 PM · MMT", location: { city: "Mandalay", venue: "Garden Commons" }, organizationId: "good-company", type: "In person", description: "Meet your neighbors, swap stories, and make room for a new connection.", visual: { tone: "coral", headline: "COME / TOGETHER", caption: "Good things start with hello." } },
  { id: "startup-sessions", title: "Small starts. Big possibilities.", category: "Startup", date: "2026-10-14", time: "9:00 AM – 12:00 PM · MMT", location: { city: "Yangon", venue: "Foundry Space" }, organizationId: "first-step-club", type: "Hybrid", description: "Honest founder stories and a fresh look at what it takes to get an idea moving.", visual: { tone: "orange", headline: "ZERO / TO ONE", caption: "For the ones starting something." } },
  { id: "business-better", title: "Building business, better", category: "Business", date: "2026-10-22", time: "1:00 – 4:00 PM · MMT", location: { city: "Mandalay", venue: "Exchange Hall" }, organizationId: "better-business-circle", type: "In person", description: "New approaches to thoughtful growth, with people who care about the long game.", visual: { tone: "orange", headline: "GROW / WITH PURPOSE", caption: "A different kind of business conversation." } },
  { id: "career-next", title: "Your next chapter", category: "Career", date: "2026-10-25", time: "11:00 AM – 1:00 PM · MMT", location: { city: "Online", venue: "Live virtual session" }, organizationId: "next-chapter-network", type: "Online", description: "Find a little clarity on your next move through guided conversations and practical advice.", visual: { tone: "pink", headline: "NEXT / IS YOURS", caption: "Make space for what comes next." } },
  { id: "design-systems", title: "Systems with soul", category: "Design", date: "2026-11-07", time: "3:00 – 5:00 PM · MMT", location: { city: "Online", venue: "Live design salon" }, organizationId: "form-and-friends", type: "Online", description: "A design salon on keeping personality alive at scale.", visual: { tone: "coral", headline: "ORDER / & ENERGY", caption: "Structure can have personality." } },
  { id: "tech-weekend", title: "Build something this weekend", category: "Technology", date: "2026-11-14", time: "10:00 AM – 4:00 PM · MMT", location: { city: "Yangon", venue: "Maker House" }, organizationId: "weekend-makers", type: "In person", description: "Bring a small idea and spend a day making it tangible.", visual: { tone: "cyan", headline: "THINK / MAKE", caption: "Curiosity gets its hands dirty." } },
];

export const mockEvents: Event[] = [
  ...eventPreviews.map((event): Event => {
    const { details, tags, cover } = getMockDetail(event.id);
    return { ...event, slug: event.id, status: "upcoming", tags, details, visual: { ...event.visual, tone: cover ?? event.visual.tone } };
  }),
  { id: "creative-notebook", slug: "creative-notebook", title: "The creative notebook", category: "Design", date: "2026-09-26", time: "2:00 – 5:00 PM · MMT", location: { city: "Yangon", venue: "Studio 09" }, organizationId: "form-and-friends", type: "In person", description: "Small discoveries, shared sketches, and a different way to see your creative process.", visual: { tone: "coral", headline: "NOTICE / MORE", caption: "A gathering worth revisiting." }, tags: ["Creative practice", "Learning", "Connection"], status: "completed", details: completedDetail },
];

export const featuredEvent = mockEvents[0];
export const homepageEvents = mockEvents.slice(1, 4);
