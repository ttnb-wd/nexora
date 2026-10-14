import "server-only";

export const recommendationWeights = {
  followedOrganization: 50, attendedCategory: 30, joinedCategory: 25,
  savedCategory: 20, previousOrganization: 20, nearTerm: 10,
} as const;
export const RECOMMENDATION_HORIZON_DAYS = 90;
export const RECOMMENDATION_LIMIT = 6;
export const RECOMMENDATION_CANDIDATE_CAP = 300;
export type RecommendationCandidate = {
  slug: string; startAt: Date; category: string | null; organizationName: string | null;
  groupKey: string; followedOrganization: boolean; attendedCategory: boolean;
  joinedCategory: boolean; savedCategory: boolean; previousOrganization: boolean;
};
/** Boolean signals accumulate once each; history volume does not multiply scores. */
export function scoreRecommendationCandidate(candidate: RecommendationCandidate, now: Date) {
  const nearTerm = candidate.startAt > now && candidate.startAt.getTime() <= now.getTime() + 14 * 86400000;
  const personalized = candidate.followedOrganization || candidate.attendedCategory || candidate.joinedCategory || candidate.savedCategory || candidate.previousOrganization;
  const score = Object.entries(recommendationWeights).reduce((total, [signal, weight]) => total + (signal === "nearTerm" ? Number(nearTerm) : Number(candidate[signal as keyof typeof recommendationWeights & keyof RecommendationCandidate])) * weight, 0);
  const reason = candidate.followedOrganization ? `Because you follow ${candidate.organizationName}`
    : candidate.attendedCategory ? `Similar to ${candidate.category} events you attended`
    : candidate.joinedCategory ? `Similar to ${candidate.category} events you joined`
    : candidate.savedCategory ? `Similar to ${candidate.category} events you saved`
    : candidate.previousOrganization ? "From an organization whose events you joined or attended"
    : "Upcoming event you can join";
  return { ...candidate, score, reason, personalized };
}
/** Within-horizon events first, then score, start instant, and binary public slug. */
export function selectRecommendationCandidates(candidates: RecommendationCandidate[], now: Date, allowBackfill = true) {
  const horizon = now.getTime() + RECOMMENDATION_HORIZON_DAYS * 86400000;
  const ranked = candidates.map((candidate) => scoreRecommendationCandidate(candidate, now)).sort((a, b) =>
    Number(a.startAt.getTime() > horizon) - Number(b.startAt.getTime() > horizon)
    || b.score - a.score || a.startAt.getTime() - b.startAt.getTime()
    || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const selected: typeof ranked = [], deferred: typeof ranked = [], counts = new Map<string, number>();
  for (const candidate of ranked) {
    const count = counts.get(candidate.groupKey) ?? 0;
    if (count >= 2) { deferred.push(candidate); continue; }
    selected.push(candidate); counts.set(candidate.groupKey, count + 1);
    if (selected.length === RECOMMENDATION_LIMIT) return selected;
  }
  // Relax only after all available alternatives have been considered.
  if (allowBackfill) selected.push(...deferred.slice(0, RECOMMENDATION_LIMIT - selected.length));
  return selected;
}
