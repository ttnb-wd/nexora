import { getSearchSuggestions } from "@/features/search/server/queries";
import { parseSearchParams, SearchInputError } from "@/features/search/params";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const values = url.searchParams.getAll("q");
    const { q } = parseSearchParams({ q: values.length > 1 ? values : values[0] });
    return Response.json({ suggestions: await getSearchSuggestions(q) }, { headers });
  } catch (error) {
    if (error instanceof SearchInputError) return Response.json({ message: error.message, suggestions: [] }, { status: 400, headers });
    console.error("Public search suggestions unavailable", { name: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Search suggestions are temporarily unavailable.", suggestions: [] }, { status: 503, headers });
  }
}
