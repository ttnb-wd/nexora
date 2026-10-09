import { DiscoveryPage } from "@/features/search/components/discovery-page";
import type { RawSearchParams } from "@/features/search/params";
export const dynamic = "force-dynamic";
export const metadata = { title: "Search Nexora", robots: { index: false, follow: true } };
export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return <DiscoveryPage raw={await searchParams} />;
}
