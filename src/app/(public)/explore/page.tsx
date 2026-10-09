import { DiscoveryPage } from "@/features/search/components/discovery-page";
import type { RawSearchParams } from "@/features/search/params";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  return { title: "Explore Events", description: "Discover upcoming technology, design, business, and community events on Nexora.",
    ...(Object.keys(raw).length ? { robots: { index: false, follow: true } } : {}),
  };
}
export default async function ExplorePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return <DiscoveryPage raw={await searchParams} explore />;
}
