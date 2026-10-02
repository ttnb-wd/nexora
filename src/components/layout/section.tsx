import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

const spacingClasses = {
  none: "",
  compact: "section-compact",
  standard: "section-standard",
  spacious: "section-spacious",
} as const;

export type SectionProps = ComponentPropsWithRef<"section"> & {
  spacing?: keyof typeof spacingClasses;
};

export function Section({ spacing = "standard", className, ...props }: SectionProps) {
  return <section className={cn(spacingClasses[spacing], className)} {...props} />;
}
