import "server-only";
import type { Event } from "@/generated/prisma/client";
import { utcToLocalInputs } from "../timezone";
import type { EventFormValues } from "../management-schemas";

export function eventToFormValues(event: Event): EventFormValues {
  const start = utcToLocalInputs(event.startAt, event.timezone);
  const end = utcToLocalInputs(event.endAt, event.timezone);
  const deadline = event.registrationDeadline ? utcToLocalInputs(event.registrationDeadline, event.timezone) : null;
  return {
    title: event.title, slug: event.slug, description: event.description ?? "", shortDescription: event.shortDescription ?? "",
    category: event.category ?? "", organizationId: event.organizationId ?? "", eventType: event.eventType,
    startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time, timezone: event.timezone,
    locationName: event.locationName ?? "", city: event.city ?? "", region: event.region ?? "", onlineUrl: event.onlineUrl ?? "",
    capacity: event.capacity?.toString() ?? "", registrationDeadline: deadline ? `${deadline.date}T${deadline.time}` : "",
  };
}
