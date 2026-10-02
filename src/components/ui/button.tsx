import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "button-primary",
  secondary: "button-secondary",
  ghost: "button-ghost",
  outline: "button-outline",
  destructive: "button-destructive",
} as const;
const sizes = { sm: "button-sm", md: "button-md", lg: "button-lg" } as const;

/** Shared by native buttons and semantic links styled as buttons. */
export function buttonStyles({ variant = "primary", size = "md", className }: Pick<ButtonProps, "variant" | "size" | "className"> = {}) {
  return cn("button", variants[variant], sizes[size], className);
}

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

// Native props include disabled, aria attributes, events, and React 19 refs.
// Icon-only consumers must supply an accessible name (for example aria-label).
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  );
}
