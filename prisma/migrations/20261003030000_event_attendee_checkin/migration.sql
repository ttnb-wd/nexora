ALTER TABLE "EventRegistration"
 ADD COLUMN "checkedInAt" TIMESTAMPTZ(3),
 ADD COLUMN "checkedInById" TEXT;
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_checkedInById_fkey"
 FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "EventRegistration_checkedInById_idx" ON "EventRegistration"("checkedInById");
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_checkin_status_check"
 CHECK ("status" = 'ATTENDED' OR ("checkedInAt" IS NULL AND "checkedInById" IS NULL));
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_checkin_actor_time_check"
 CHECK ("checkedInAt" IS NOT NULL OR "checkedInById" IS NULL);
