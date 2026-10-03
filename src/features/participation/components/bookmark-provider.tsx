"use client";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveEvent, unsaveEvent } from "../server/actions";
import { eventSignInPath } from "../rules";
type BookmarkViewer = { authenticated: boolean; savedSlugs: string[]; unavailable: boolean };
const BookmarkContext = createContext<BookmarkViewer>({ authenticated: false, savedSlugs: [], unavailable: false });
export function BookmarkProvider({ viewer, children }: { viewer: BookmarkViewer; children: ReactNode }) {
  return <BookmarkContext.Provider value={viewer}>{children}</BookmarkContext.Provider>;
}
export function useEventBookmark(slug: string, fixture = false) {
  const viewer = useContext(BookmarkContext);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const saved = viewer.savedSlugs.includes(slug);
  function toggle() {
    if (fixture) { setMessage("Bookmarks are available for real events."); return; }
    if (!viewer.authenticated && !viewer.unavailable) { router.push(eventSignInPath(slug)); return; }
    startTransition(async () => {
      try {
        const result = await (saved ? unsaveEvent(slug) : saveEvent(slug));
        if (result.signIn) { router.push(result.signIn); return; }
        setMessage(result.message);
        router.refresh();
      } catch { setMessage("We could not update your saved event. Please try again."); }
    });
  }
  return { saved, pending, message, toggle };
}
