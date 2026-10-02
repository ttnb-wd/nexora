import { z } from "zod";
import { eventCategories } from "./types";
import { isValidTimezone, zonedDateTimeToUtc } from "./timezone";

export const managedEventTypes = ["IN_PERSON", "ONLINE", "HYBRID"] as const;
export const eventTypeLabels = { IN_PERSON: "In person", ONLINE: "Online", HYBRID: "Hybrid" } as const;
export const eventSlugSchema = z.string().trim().min(3, "Use at least 3 characters.").max(80, "Use 80 characters or fewer.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens between words.");
const optionalText = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer.`).optional().transform((value) => value || null);
export const eventBasicInfoSchema = z.object({
  title: z.string().trim().min(3, "Enter at least 3 characters.").max(160, "Use 160 characters or fewer."),
  slug: eventSlugSchema,
  shortDescription: optionalText(280),
  description: z.string().trim().min(10, "Describe your event in at least 10 characters.").max(12000, "Use 12000 characters or fewer."),
  category: z.enum(eventCategories, "Choose a category."),
  organizationId: optionalText(128),
  eventType: z.enum(managedEventTypes, "Choose an event type."),
});
const scheduleFields = z.object({
  startDate: z.string().trim(), startTime: z.string().trim(), endDate: z.string().trim(), endTime: z.string().trim(),
  timezone: z.string().trim().max(100).refine(isValidTimezone, "Choose a valid IANA timezone explicitly."),
  locationName: optionalText(160), city: optionalText(100), region: optionalText(100),
  onlineUrl: optionalText(2048).refine((value) => {
    if (!value) return true;
    try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  }, "Enter a valid HTTP or HTTPS link without embedded credentials."),
});
function validateSchedule(input: z.output<typeof scheduleFields>, ctx: z.RefinementCtx) {
  let start: Date | undefined;
  let end: Date | undefined;
  for (const kind of ["start", "end"] as const) {
    try {
      const date = zonedDateTimeToUtc(input[`${kind}Date`], input[`${kind}Time`], input.timezone);
      if (kind === "start") start = date; else end = date;
    } catch (error) { ctx.addIssue({ code: "custom", path: [`${kind}Date`], message: error instanceof Error ? error.message : "Enter a valid schedule." }); }
  }
  if (start && end && end <= start) ctx.addIssue({ code: "custom", path: ["endDate"], message: "The event must end after it starts." });
}
export const eventScheduleSchema = scheduleFields.superRefine(validateSchedule);
export const eventRegistrationSchema = z.object({
  capacity: z.string().trim().optional().refine((value) => !value || /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 2147483647, "Enter a positive whole-number capacity (up to 2147483647).")
    .transform((value) => value ? Number(value) : null),
  registrationDeadline: z.string().trim().optional().refine((value) => !value || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), "Enter a valid registration deadline.").transform((value) => value || null),
});
const eventFields = eventBasicInfoSchema.extend(scheduleFields.shape).extend(eventRegistrationSchema.shape);
export const createEventSchema = eventFields.superRefine((input, ctx) => {
  validateSchedule(input, ctx);
  if (input.eventType !== "ONLINE") {
    if (!input.locationName) ctx.addIssue({ code: "custom", path: ["locationName"], message: "Enter a venue or location name." });
    if (!input.city) ctx.addIssue({ code: "custom", path: ["city"], message: "Enter a city." });
  }
  if (input.eventType !== "IN_PERSON" && !input.onlineUrl) ctx.addIssue({ code: "custom", path: ["onlineUrl"], message: "Enter the online event link." });
  if (input.registrationDeadline) {
    try {
      const [date, time] = input.registrationDeadline.split("T");
      const deadline = zonedDateTimeToUtc(date, time, input.timezone);
      const start = zonedDateTimeToUtc(input.startDate, input.startTime, input.timezone);
      if (deadline > start) ctx.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Registration must close no later than the event starts." });
    } catch { ctx.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Enter a valid, unambiguous deadline in the event timezone." }); }
  }
});
export const updateEventSchema = createEventSchema;
export type EventFormValues = { [K in keyof z.input<typeof eventFields>]-?: string };
export type EventFormField = keyof EventFormValues;
export type EventActionState = { errors?: Partial<Record<EventFormField, string[]>>; message?: string };
export const emptyEventValues: EventFormValues = {
  title: "", slug: "", shortDescription: "", description: "", category: "", organizationId: "", eventType: "",
  startDate: "", startTime: "", endDate: "", endTime: "", timezone: "", locationName: "", city: "", region: "", onlineUrl: "", capacity: "", registrationDeadline: "",
};
export function eventDataFromInput(input: z.output<typeof createEventSchema>) {
  const { startDate, startTime, endDate, endTime, registrationDeadline, ...fields } = input;
  const [deadlineDate, deadlineTime] = registrationDeadline?.split("T") ?? [];
  return {
    ...fields,
    startAt: zonedDateTimeToUtc(startDate, startTime, input.timezone),
    endAt: zonedDateTimeToUtc(endDate, endTime, input.timezone),
    registrationDeadline: registrationDeadline ? zonedDateTimeToUtc(deadlineDate, deadlineTime, input.timezone) : null,
    locationName: input.eventType === "ONLINE" ? null : input.locationName,
    city: input.eventType === "ONLINE" ? null : input.city,
    region: input.eventType === "ONLINE" ? null : input.region,
    onlineUrl: input.eventType === "IN_PERSON" ? null : input.onlineUrl,
  };
}
