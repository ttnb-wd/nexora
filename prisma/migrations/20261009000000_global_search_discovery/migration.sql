-- Neon supports pg_trgm. It accelerates literal substring matching; no fuzzy/AI ranking.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Event_public_search_trgm_idx" ON "Event" USING gin
  (lower(coalesce(title,'') || ' ' || coalesce("shortDescription",'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'') || ' ' || coalesce("locationName",'') || ' ' || coalesce(city,'') || ' ' || coalesce(region,'')) gin_trgm_ops)
  WHERE status IN ('PUBLISHED','COMPLETED');
CREATE INDEX "Organization_public_search_trgm_idx" ON "Organization" USING gin
  (lower(coalesce(name,'') || ' ' || coalesce("shortName",'') || ' ' || coalesce(description,'') || ' ' || coalesce(industry,'') || ' ' || coalesce(city,'') || ' ' || coalesce(region,'')) gin_trgm_ops);
CREATE INDEX "Organization_name_search_trgm_idx" ON "Organization" USING gin (lower(name) gin_trgm_ops);
CREATE INDEX "EventSpeaker_public_search_trgm_idx" ON "EventSpeaker" USING gin
  (lower(coalesce(name,'') || ' ' || coalesce(role,'') || ' ' || coalesce(company,'') || ' ' || coalesce(bio,'')) gin_trgm_ops);
CREATE INDEX "Event_category_status_startAt_idx" ON "Event" (category, status, "startAt");
