export const eventCategories = ["Technology", "AI", "Business", "Design", "Startup", "Community", "Career"] as const;
export const eventTypes = ["In person", "Online", "Hybrid"] as const;
export type EventCategory = (typeof eventCategories)[number];
export type EventType = (typeof eventTypes)[number];
export type EventVisual = "violet" | "cyan" | "coral" | "orange" | "warm" | "pink" | "mixed";
export type EventCardVariant = "featured" | "standard" | "compact" | "editorial";

export interface AgendaItem { time: string; title: string; description: string }
export interface EventSpeaker { name: string; role: string; organizationId: string; bio: string; tone: EventVisual }
export interface EventResource { type: "Slides" | "Recording" | "Links" | "Notes"; title: string; description: string }
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
  type: EventType;
  description?: string;
  visual: { tone: EventVisual; headline: string; caption: string };
  featured?: boolean;
  tags: string[];
  status: "upcoming" | "completed";
  details: EventDetails;
}

export type DateFilter = "Any date" | "This week" | "This month" | "Later";
export interface EventFiltersState {
  query: string;
  category: EventCategory | "All categories";
  type: EventType | "All types";
  location: string;
  date: DateFilter;
}
