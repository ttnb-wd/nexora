import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** CSS motion keeps this usable in Server Components and without JavaScript. */
export function GradientText({ className, ...props }: ComponentPropsWithRef<"span">) {
  return <span className={cn("gradient-text", className)} {...props} />;
}
