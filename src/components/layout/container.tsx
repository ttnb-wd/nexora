import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

const sizes = { standard: "page-container", wide: "wide-container" } as const;

export type ContainerProps = ComponentPropsWithRef<"div"> & {
  size?: keyof typeof sizes;
};

export function Container({ size = "standard", className, ...props }: ContainerProps) {
  return <div className={cn(sizes[size], className)} {...props} />;
}
