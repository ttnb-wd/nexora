export const eventCategories = ["Technology", "AI", "Business", "Design", "Startup", "Community", "Career"] as const;
export const eventTypes = ["In person", "Online", "Hybrid"] as const;
export type EventCategory = (typeof eventCategories)[number] | "Other";
export type EventType = (typeof eventTypes)[number];
export type EventVisual = "violet" | "cyan" | "coral" | "orange" | "warm" | "pink" | "mixed";
export type EventCardVariant = "featured" | "standard" | "compact" | "editorial";

export interface AgendaItem { time: string; title: string; description: string; startAt?: string; endAt?: string; locationLabel?: string }
export interface EventSpeaker { name: string; role: string; organizationId: string; organizationName?: string; bio: string; tone: EventVisual }
export interface EventResource { type: "Slides" | "Recording" | "Links" | "Notes" | "Document" | "Other"; title: string; description: string; url?: string }
export interface EventDetails {
  about: string[];
  agenda: AgendaItem[];
  speakers: EventSpeaker[];
  venue: { address: string; guidance: string };
  availability: string;
  resources: EventResource[];
}

/** UI-only event model. Dates are ISO calendar dates; time includes its timezone. */
export interface Event {
  id: string;
  slug: string;
  title: string;
  category: EventCategory;
  date: string;
  time: string;
  location: { city: string; venue: string };
  organizationId: string;
  /** Public identity only; internal user and organization IDs stay on the server. */
  organizer?: { name: string; slug?: string; industry?: string; description?: string; location?: string };
  source?: "database" | "fixture";
  startAt?: string;
  timezone?: string;
  calendar?: { google: string; ics: string };
  type: EventType;
  description?: string;
  visual: { tone: EventVisual; headline: string; caption: string };
  featured?: boolean;
  tags: string[];
  status: "upcoming" | "completed";
  details: EventDetails;
}

/** Serializable public view model produced by the server mapper, never a Prisma record. */
export interface PublicEvent extends Event {
  organizer: { name: string; slug?: string; industry?: string; description?: string; location?: string };
  source: "database";
  startAt: string;
  timezone: string;
}

export type DateFilter = "Any date" | "This week" | "This month" | "Later";
export interface EventFiltersState {
  query: string;
  category: EventCategory | "All categories";
  type: EventType | "All types";
  location: string;
  date: DateFilter;
}
