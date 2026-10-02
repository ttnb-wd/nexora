"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { OrganizationFormField, OrganizationFormState } from "../schemas";
import styles from "./organizer.module.css";

type FormProps = {
  action: (previous: OrganizationFormState, data: FormData) => Promise<OrganizationFormState>;
  initialValues?: Partial<Record<OrganizationFormField, string | null>>;
  slug?: string;
};
const fields: { name: OrganizationFormField; label: string; max: number; required?: boolean; multiline?: boolean; hint?: string }[] = [
  { name: "name", label: "Organization name", max: 120, required: true },
  { name: "slug", label: "Organization URL", max: 64, required: true, hint: "3–64 lowercase letters, numbers, and hyphens. This URL cannot be changed later." },
  { name: "shortName", label: "Short name", max: 40 },
  { name: "industry", label: "Industry", max: 80 },
  { name: "description", label: "Description", max: 2000, multiline: true },
  { name: "city", label: "City", max: 100 },
  { name: "region", label: "Region", max: 100 },
  { name: "website", label: "Website", max: 2048, hint: "Include https:// or http://." },
];
export function OrganizationForm({ action, initialValues = {}, slug }: FormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.errors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  return <form ref={formRef} action={formAction} className={styles.form} aria-busy={pending}>
    <div className={styles.formHeading}><h2>{slug ? "Organization details" : "Make it yours"}</h2><p>{slug ? "Keep your organization’s details up to date." : "Start with a name and a URL. Everything else is optional."}</p></div>
    {slug && <p className={styles.hint}>Organization URL: <strong>{slug}</strong></p>}
    <fieldset disabled={pending} className={styles.fields}>
      {fields.filter((field) => !(slug && field.name === "slug")).map((field) => {
        const errors = state.errors?.[field.name];
        const props = {
          id: `organization-${field.name}`, name: field.name, required: field.required, maxLength: field.max,
          minLength: field.required ? (field.name === "slug" ? 3 : 2) : undefined,
          defaultValue: state.values?.[field.name] ?? initialValues[field.name] ?? "",
          "aria-invalid": errors?.length ? true : undefined,
          "aria-describedby": [field.hint ? `${field.name}-hint` : "", errors?.length ? `${field.name}-error` : ""].filter(Boolean).join(" ") || undefined,
        };
        return <div key={field.name} className={field.multiline || field.name === "name" || field.name === "slug" || field.name === "website" ? styles.full : undefined}>
          <label htmlFor={props.id}>{field.label} {!field.required && <span>(optional)</span>}</label>
          {field.multiline ? <textarea {...props} rows={4} /> : <input {...props} type={field.name === "website" ? "url" : "text"} autoCapitalize={field.name === "slug" ? "none" : undefined} spellCheck={field.name === "slug" ? false : undefined} pattern={field.name === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined} placeholder={field.name === "slug" ? "your-organization" : field.name === "website" ? "https://example.com" : undefined} />}
          {field.hint && <p id={`${field.name}-hint`} className={styles.hint}>{field.hint}</p>}
          {errors && <p id={`${field.name}-error`} className={styles.error}>{errors[0]}</p>}
        </div>;
      })}
    </fieldset>
    <div aria-live="polite">{state.message && <p role="alert" className={styles.error}>{state.message}</p>}</div>
    <div className={styles.actions}><Button type="submit" disabled={pending}>{pending ? (slug ? "Saving…" : "Creating…") : (slug ? "Save changes" : "Create organization")}</Button><Link href={slug ? `/organizer/${slug}` : "/organizer"}>Cancel</Link></div>
  </form>;
}
