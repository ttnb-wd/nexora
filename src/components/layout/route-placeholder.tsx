import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { buttonStyles } from "@/components/ui/button";

export function RoutePlaceholder({ title, description }: { title: string; description: string }) {
  return <main id="main-content" tabIndex={-1}><Section><Container><p className="label mb-4 text-primary">NEXORA / COMING SOON</p><h1 className="heading-1">{title}</h1><p className="body-lg mt-5 mb-8 max-w-xl text-muted-foreground">{description}</p><Link href="/" className={buttonStyles({ variant: "secondary" })}><ArrowLeft aria-hidden="true" />Back to Nexora</Link></Container></Section></main>;
}
