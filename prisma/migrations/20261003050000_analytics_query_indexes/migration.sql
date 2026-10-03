-- Event-scoped creation-time scans and daily/monthly registration trend grouping.
-- The existing (eventId, status) index remains useful for active-seat/status counts.
CREATE INDEX "EventRegistration_eventId_createdAt_idx" ON "EventRegistration"("eventId", "createdAt");
