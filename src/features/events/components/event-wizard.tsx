"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventCategories } from "../types";
import { createEventSchema, eventBasicInfoSchema, emptyEventValues, eventTypeLabels, managedEventTypes, type EventActionState, type EventFormField, type EventFormValues } from "../management-schemas";
import { formatManagedEventDate, zonedDateTimeToUtc } from "../timezone";
import styles from "./event-management.module.css";

type OrganizerOption = { id: string; name: string };
type Props = {
  action: (previous: EventActionState, data: FormData) => Promise<EventActionState>;
  organizations: OrganizerOption[];
  individualName: string;
  initialValues?: EventFormValues;
  edit?: boolean;
  version?: string;
  returnPath?: string;
};
const steps = ["Basic info", "Date & location", "Registration", "Preview", "Publish"];
const stepFields: EventFormField[][] = [
  ["title", "slug", "shortDescription", "description", "category", "organizationId", "eventType"],
  ["startDate", "startTime", "endDate", "endTime", "timezone", "locationName", "city", "region", "onlineUrl"],
  ["capacity", "registrationDeadline"],
];
export function EventWizard({ action, organizations, individualName, initialValues = emptyEventValues, edit = false, version, returnPath = "/organizer" }: Props) {
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [requestedStep, setStep] = useState(0);
  const [localErrors, setErrors] = useState<EventActionState["errors"]>({});
  const [dismissedState, setDismissedState] = useState<EventActionState | null>(null);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [state, formAction, pending] = useActionState(action, {});
  const serverErrors = state !== dismissedState ? state.errors : undefined;
  const errorStep = stepFields.findIndex((fields) => fields.some((field) => serverErrors?.[field]?.length));
  const step = errorStep >= 0 ? errorStep : requestedStep;
  const errors = serverErrors ?? localErrors;
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty && !pending) { event.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);
  useEffect(() => {
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid) { invalid.focus({ preventScroll: true }); invalid.scrollIntoView({ block: "center" }); }
    else { headingRef.current?.focus({ preventScroll: true }); headingRef.current?.scrollIntoView({ block: "start" }); }
  }, [step, state, validationAttempt]);
  function change(field: EventFormField, value: string) {
    setStep(step); setDismissedState(state);
    setValues((current) => ({ ...current, [field]: value }));
    setErrors({ ...errors, [field]: undefined });
    setPublishConfirmed(false);
  }
  function next() {
    setStep(step); setDismissedState(state);
    const result = step === 0 ? eventBasicInfoSchema.safeParse(values) : createEventSchema.safeParse(values);
    if (!result.success) {
      const allErrors = result.error.flatten().fieldErrors;
      const relevant = stepFields[step] ?? [];
      const found = Object.fromEntries(Object.entries(allErrors).filter(([field]) => relevant.includes(field as EventFormField)));
      if (Object.keys(found).length) { setErrors(found); setValidationAttempt((current) => current + 1); return; }
    }
    setErrors({}); setStep(Math.min(step + 1, 4));
  }
  function input(field: EventFormField, label: string, options: { type?: string; multiline?: boolean; max?: number; optional?: boolean; hint?: string } = {}) {
    const props = {
      id: `event-${field}`, value: values[field], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(field, event.target.value),
      maxLength: options.max, "aria-invalid": errors?.[field]?.length ? true as const : undefined,
      "aria-describedby": [options.hint ? `${field}-hint` : "", errors?.[field]?.length ? `${field}-error` : ""].filter(Boolean).join(" ") || undefined,
    };
    return <div className={options.multiline ? styles.full : undefined}><label htmlFor={props.id}>{label}{options.optional && <span> (optional)</span>}</label>{options.multiline ? <textarea {...props} rows={5} /> : <input {...props} type={options.type ?? "text"} autoCapitalize={field === "slug" ? "none" : undefined} />}{options.hint && <p id={`${field}-hint`} className={styles.hint}>{options.hint}</p>}{errors?.[field] && <p id={`${field}-error`} className={styles.error}>{errors[field]?.[0]}</p>}</div>;
  }
  function select(field: EventFormField, label: string, options: { value: string; label: string }[], placeholder: string) {
    return <div><label htmlFor={`event-${field}`}>{label}</label><select id={`event-${field}`} value={values[field]} onChange={(event) => change(field, event.target.value)} aria-invalid={errors?.[field]?.length ? true : undefined} aria-describedby={errors?.[field]?.length ? `${field}-error` : undefined}>{field !== "organizationId" && <option value="">{placeholder}</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{errors?.[field] && <p id={`${field}-error`} className={styles.error}>{errors[field]?.[0]}</p>}</div>;
  }
  const timezoneOptions = ["UTC", "Asia/Yangon", "Asia/Bangkok", "Asia/Singapore", "Asia/Kolkata", "Asia/Tokyo", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney", ...(initialValues.timezone ? [initialValues.timezone] : [])].filter((zone, index, all) => all.indexOf(zone) === index);
  const organizer = organizations.find((organization) => organization.id === values.organizationId)?.name ?? individualName;
  let schedule = "Complete your schedule to see the preview.";
  try {
    schedule = `${formatManagedEventDate(zonedDateTimeToUtc(values.startDate, values.startTime, values.timezone), values.timezone)} – ${formatManagedEventDate(zonedDateTimeToUtc(values.endDate, values.endTime, values.timezone), values.timezone)} (${values.timezone})`;
  } catch { /* Incomplete input stays in the form; no browser timezone fallback. */ }
  const preview = <article className={styles.preview}>
    <div className={styles.artwork}><CalendarDays size={38} aria-hidden="true" /><p>{values.category || "Your next gathering"}</p><h2>{values.title || "Your event, brought to life."}</h2><span>{values.eventType ? eventTypeLabels[values.eventType as keyof typeof eventTypeLabels] : "Event type"}</span></div>
    <div className={styles.previewBody}><p className={styles.eyebrow}>{organizer}</p><p>{schedule}</p><p>{values.eventType === "ONLINE" ? "Online" : [values.locationName, values.city, values.region].filter(Boolean).join(", ")}{values.eventType === "HYBRID" && " + online"}</p>{values.onlineUrl && values.eventType !== "IN_PERSON" && <p className={styles.hint}>Online link: {values.onlineUrl}</p>}{values.shortDescription && <p className={styles.lead}>{values.shortDescription}</p>}<p className={styles.description}>{values.description}</p><p className={styles.hint}>{values.capacity ? `Capacity: ${values.capacity}` : "No capacity limit specified"}{values.registrationDeadline && ` · Registration closes ${values.registrationDeadline.replace("T", " ")} (${values.timezone})`}</p></div>
  </article>;
  return <div className={styles.wizard}>
    <ol className={styles.progress} aria-label="Event creation progress">{steps.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={15} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span><p>{edit && index === 4 ? "Save changes" : label}</p></li>)}</ol>
    <form ref={formRef} action={formAction} className={styles.form} aria-busy={pending} onSubmit={(event) => {
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      if (step !== 4) { event.preventDefault(); next(); }
      else if (!edit && submitter instanceof HTMLButtonElement && submitter.value === "publish" && !publishConfirmed) { event.preventDefault(); }
    }}>
      {Object.entries(values).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {version && <input type="hidden" name="version" value={version} />}
      <div className={styles.formHeading}><p className={styles.eyebrow}>STEP {String(step + 1).padStart(2, "0")} OF 05</p><h2 ref={headingRef} tabIndex={-1}>{edit && step === 4 ? "Ready to save your changes?" : ["Start with the story.", "Set the time and place.", "Plan the gathering.", "See it come together.", "Ready for the next step?"][step]}</h2><p>{["Give people a reason to be curious.", "Choose the timezone explicitly. All dates and times below use it.", "Registration details are informational for now.", "This preview uses your details.", edit ? "Your event keeps its current status." : "Save a draft or publish in organizer management. Public discovery will be available in a future step."][step]}</p></div>
      {state !== dismissedState && state.message && <p className={styles.error} role="alert">{state.message}</p>}
      {Object.values(errors ?? {}).some((error) => error?.length) && <p className={styles.error} role="alert">Please check the highlighted fields.</p>}
      <fieldset disabled={pending} className={styles.fields}>
        {step === 0 && <>
          {input("title", "Event title", { max: 160 })}{input("slug", "Event URL", { max: 80, hint: "3–80 lowercase letters, numbers, and single hyphens." })}
          {input("shortDescription", "Short description", { max: 280, optional: true, multiline: true })}{input("description", "Full description", { max: 12000, multiline: true })}
          {select("category", "Category", eventCategories.map((category) => ({ value: category, label: category })), "Choose a category")}
          {select("eventType", "Event type", managedEventTypes.map((type) => ({ value: type, label: eventTypeLabels[type] })), "Choose an event type")}
          {edit ? <p className={styles.hint}>Organizer: {organizer}. Event ownership cannot be changed here.</p> : select("organizationId", "Organizer", [{ value: "", label: `Individual · ${individualName}` }, ...organizations.map((organization) => ({ value: organization.id, label: organization.name }))], "Choose an organizer")}
        </>}
        {step === 1 && <>
          {select("timezone", "Timezone", timezoneOptions.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") })), "Choose the event timezone")}
          <p className={styles.hint}>Clock changes can make some local times missing or ambiguous. Choose another time if prompted.</p>
          {input("startDate", "Start date", { type: "date" })}{input("startTime", "Start time", { type: "time" })}{input("endDate", "End date", { type: "date" })}{input("endTime", "End time", { type: "time" })}
          {values.eventType !== "ONLINE" && <>{input("locationName", "Venue / location", { max: 160 })}{input("city", "City", { max: 100 })}{input("region", "Region", { max: 100, optional: true })}</>}
          {values.eventType !== "IN_PERSON" && input("onlineUrl", "Online event link", { type: "url", max: 2048, hint: "Use a full https:// or http:// URL." })}
        </>}
        {step === 2 && <>{input("capacity", "Capacity", { type: "number", optional: true, hint: "A positive whole number. Leave blank for no specified limit." })}{input("registrationDeadline", "Registration deadline", { type: "datetime-local", optional: true, hint: `Uses ${values.timezone || "the event timezone"}; cannot be later than the start.` })}<p className={`${styles.note} ${styles.full}`}>Registration and attendee tracking will be added later. These details do not open registration.</p></>}
        {step === 3 && <div className={styles.full}>{preview}</div>}
        {step === 4 && <div className={`${styles.full} ${styles.finish}`}><CalendarDays size={32} aria-hidden="true" /><h3>{values.title}</h3><p>{schedule}</p><p>{edit ? "Changes are validated before saving. Publishing and cancellation are separate actions on the management page." : "A draft stays private in your management space. Publishing updates its status here; it will not appear on public Explore yet."}</p>{!edit && <label className={styles.confirm}><input type="checkbox" checked={publishConfirmed} onChange={(event) => setPublishConfirmed(event.target.checked)} />I’ve reviewed the details and want to publish this event.</label>}</div>}
      </fieldset>
      <div className={styles.actions}>{step > 0 && <Button variant="secondary" disabled={pending} onClick={() => { setDismissedState(state); setErrors({}); setStep(step - 1); }}><ArrowLeft size={16} aria-hidden="true" />Back</Button>}{step < 4 ? <Button disabled={pending} onClick={next}>Next<ArrowRight size={16} aria-hidden="true" /></Button> : edit ? <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button> : <><Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending}>{pending ? "Saving…" : "Save as draft"}</Button><Button type="submit" name="intent" value="publish" disabled={pending || !publishConfirmed}>{pending ? "Saving…" : "Publish event"}</Button></>}<Link href={returnPath} onClick={(event) => { if (dirty && !pending && !window.confirm("Leave this form and discard your unsaved changes?")) event.preventDefault(); }}>Cancel</Link></div>
    </form>
  </div>;
}
