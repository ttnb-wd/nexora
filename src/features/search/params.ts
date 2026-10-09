export const SEARCH_PAGE_SIZE = 12;
export const SEARCH_MAX_PAGE = 100;
export type SearchType = "all" | "events" | "organizations" | "speakers";
export type SearchParams = {
  q: string; type: SearchType; category: string; eventType: "" | "IN_PERSON" | "ONLINE" | "HYBRID";
  date: "upcoming" | "all"; location: string; sort: "relevance" | "soonest" | "newest"; page: number;
};
export type RawSearchParams = Record<string, string | string[] | undefined>;
export class SearchInputError extends Error {}
function text(value: string | string[] | undefined, max: number) {
  if (Array.isArray(value)) throw new SearchInputError("Use each search parameter only once.");
  if ((value?.length ?? 0) > max || /[\u0000-\u001f\u007f]/u.test(value ?? "")) throw new SearchInputError(`Search text must be at most ${max} characters and contain no control characters.`);
  return (value ?? "").trim().replace(/\s+/gu, " ");
}
function choice<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const clean = text(value, 30);
  if (!clean) return fallback;
  if (!allowed.includes(clean as T)) throw new SearchInputError("Choose a supported search filter.");
  return clean as T;
}
export function parseSearchParams(raw: RawSearchParams): SearchParams {
  const page = text(raw.page, 4);
  if (page && (!/^\d+$/u.test(page) || Number(page) < 1 || Number(page) > SEARCH_MAX_PAGE)) throw new SearchInputError(`Choose a page between 1 and ${SEARCH_MAX_PAGE}.`);
  return {
    q: text(raw.q, 100), type: choice(raw.type, ["all", "events", "organizations", "speakers"], "all"),
    category: text(raw.category, 80), eventType: choice(raw.eventType, ["", "IN_PERSON", "ONLINE", "HYBRID"], ""),
    date: choice(raw.date, ["upcoming", "all"], "upcoming"), location: text(raw.location, 80),
    sort: choice(raw.sort, ["relevance", "soonest", "newest"], "relevance"), page: page ? Number(page) : 1,
  };
}
// LIKE metacharacters are literal input, never user-controlled wildcards.
export function searchPattern(value: string) { return `%${value.toLowerCase().replace(/[\\%_]/gu, "\\$&")}%`; }
export function searchHref(params: SearchParams, updates: Partial<SearchParams> = {}, base = "/search") {
  const state = { ...params, ...updates }, query = new URLSearchParams();
  if (state.q) query.set("q", state.q);
  if (state.type !== "all") query.set("type", state.type);
  if (state.category) query.set("category", state.category);
  if (state.eventType) query.set("eventType", state.eventType);
  if (state.date !== "upcoming") query.set("date", state.date);
  if (state.location) query.set("location", state.location);
  if (state.sort !== "relevance") query.set("sort", state.sort);
  if (state.page > 1) query.set("page", String(state.page));
  return `${base}${query.size ? `?${query}` : ""}`;
}
