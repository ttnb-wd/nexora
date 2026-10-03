import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { agendaInputFromForm, agendaItemSchema, eventSpeakerSchema, eventResourceSchema, contentTargetSchema, contentEditable, type ContentKind, type ContentState } from "../content-schemas";
import { eventAccessWhere } from "./authorization-rules";

type Operation = "create" | "update" | "delete" | "move";
type Row = { id: string; sortOrder: number; updatedAt: Date };
function delegate(tx: Prisma.TransactionClient, kind: ContentKind) {
  // Shared scalar operations retain event scoping; create/update data are typed separately below.
  return {
    rows: (eventId: string): Promise<Row[]> => {
      const args = { where: { eventId }, select: { id: true, sortOrder: true, updatedAt: true }, orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] };
      return kind === "agenda" ? tx.eventAgendaItem.findMany(args) : kind === "speaker" ? tx.eventSpeaker.findMany(args) : tx.eventResource.findMany(args);
    },
    remove: (eventId: string, id: string) => {
      const args = { where: { id, eventId } };
      return kind === "agenda" ? tx.eventAgendaItem.deleteMany(args) : kind === "speaker" ? tx.eventSpeaker.deleteMany(args) : tx.eventResource.deleteMany(args);
    },
    order: (eventId: string, id: string, sortOrder: number) => {
      const args = { where: { id, eventId }, data: { sortOrder } };
      return kind === "agenda" ? tx.eventAgendaItem.updateMany(args) : kind === "speaker" ? tx.eventSpeaker.updateMany(args) : tx.eventResource.updateMany(args);
    },
  };
}

/** All rich-content writers serialize on the parent event, including appends and reorders. */
export async function mutateEventContent(db: PrismaClient, userId: string, eventId: string, scope: string | null, kind: ContentKind, operation: Operation, form: FormData): Promise<ContentState & { slug?: string; organizationSlug?: string }> {
  const itemId = operation === "create" ? undefined : form.get("itemId");
  const target = contentTargetSchema.safeParse({ eventId, scope, itemId });
  if (!target.success) return { message: "This request is invalid. Reload the event and try again." };
  try {
    return await db.$transaction(async (tx) => {
      const where = { id: eventId, ...(scope === null ? { organizationId: null } : { organization: { slug: scope } }), AND: [eventAccessWhere(userId)] };
      const authorized = await tx.event.findFirst({ where, select: { id: true } });
      if (!authorized) return { message: "You do not have permission to manage this event, or it no longer exists." };
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      // Recheck access and lifecycle after acquiring the lock.
      const event = await tx.event.findFirst({ where, include: { organization: { select: { slug: true } } } });
      if (!event) return { message: "Your access changed. Reload the event." };
      if (!contentEditable(event.status, kind)) return { message: "This section is read-only for the event’s current status." };
      const model = delegate(tx, kind);
      const rows = await model.rows(eventId);
      const row = rows.find((entry) => entry.id === target.data.itemId);
      if (operation !== "create" && !row) return { message: "This item was removed. Reload the event." };
      if (row && operation !== "move" && form.get("version") !== row.updatedAt.toISOString()) return { message: "This item changed while you were editing. Reload before saving." };
      if (operation === "create" || operation === "update") {
        if (operation === "create" && rows.length >= 200) return { message: "Each section supports up to 200 items." };
        const sortOrder = (rows.at(-1)?.sortOrder ?? -1) + 1;
        const fields = Object.fromEntries(form.entries());
        if (kind === "agenda") {
          let input;
          try { input = agendaInputFromForm(form, event.timezone); }
          catch (error) { return { message: error instanceof Error ? error.message : "Check the agenda times." }; }
          const parsed = agendaItemSchema.safeParse(input);
          if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, message: "Please check the highlighted fields." };
          if (parsed.data.startAt < event.startAt || parsed.data.startAt >= event.endAt || (parsed.data.endAt && parsed.data.endAt > event.endAt)) return { message: "Agenda times must fall within the event’s scheduled dates and times." };
          if (operation === "create") await tx.eventAgendaItem.create({ data: { ...parsed.data, eventId, sortOrder } });
          else await tx.eventAgendaItem.updateMany({ where: { id: row!.id, eventId }, data: parsed.data });
        } else if (kind === "speaker") {
          const parsed = eventSpeakerSchema.safeParse(fields);
          if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, message: "Please check the highlighted fields." };
          if (operation === "create") await tx.eventSpeaker.create({ data: { ...parsed.data, eventId, sortOrder } });
          else await tx.eventSpeaker.updateMany({ where: { id: row!.id, eventId }, data: parsed.data });
        } else {
          const parsed = eventResourceSchema.safeParse(fields);
          if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, message: "Please check the highlighted fields." };
          if (operation === "create") await tx.eventResource.create({ data: { ...parsed.data, eventId, sortOrder } });
          else await tx.eventResource.updateMany({ where: { id: row!.id, eventId }, data: parsed.data });
        }
      } else if (operation === "delete") {
        await model.remove(eventId, row!.id);
      } else {
        const direction = z.enum(["up", "down"]).safeParse(form.get("direction"));
        if (!direction.success) return { message: "Choose Move up or Move down." };
        if (form.get("orderVersion") !== JSON.stringify(rows.map((entry) => entry.id))) return { message: "The order changed. Reload before moving items." };
        const index = rows.findIndex((entry) => entry.id === row!.id);
        const adjacent = index + (direction.data === "up" ? -1 : 1);
        if (adjacent < 0 || adjacent >= rows.length) return { message: "This item is already at the end of the list." };
        // Swap only the neighboring pair using an unused temporary position.
        // Three writes keep the unique index valid and avoid work proportional to list length.
        const neighbor = rows[adjacent];
        const temporaryPosition = Math.max(...rows.map((entry) => entry.sortOrder)) + 1;
        await model.order(eventId, row!.id, temporaryPosition);
        await model.order(eventId, neighbor.id, row!.sortOrder);
        await model.order(eventId, row!.id, neighbor.sortOrder);
      }
      // Lifecycle actions use updatedAt guards, so concurrent stale status changes fail safely.
      await tx.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
      return { ok: true, message: operation === "delete" ? "Item removed." : operation === "move" ? "Order updated." : "Changes saved.", slug: event.slug, organizationSlug: event.organization?.slug };
    }, { maxWait: 10000, timeout: 20000 });
  } catch { return { message: "We couldn’t save these changes. Reload the event and try again." }; }
}
