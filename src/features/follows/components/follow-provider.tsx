"use client";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { followOrganization, unfollowOrganization } from "../server/actions";
type FollowViewer = { authenticated: boolean; followedSlugs: string[]; unavailable: boolean };
const FollowContext = createContext<FollowViewer>({ authenticated: false, followedSlugs: [], unavailable: false });
export function FollowProvider({ viewer, children }: { viewer: FollowViewer; children: ReactNode }) {
  return <FollowContext.Provider value={viewer}>{children}</FollowContext.Provider>;
}
export function useOrganizationFollow(slug: string) {
  const viewer = useContext(FollowContext);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const following = viewer.followedSlugs.includes(slug);
  function toggle() {
    if (!viewer.authenticated && !viewer.unavailable) { router.push(`/sign-in?returnTo=${encodeURIComponent(`/companies/${slug}`)}`); return; }
    startTransition(async () => {
      try {
        const result = await (following ? unfollowOrganization(slug) : followOrganization(slug));
        if (result.signIn) { router.push(result.signIn); return; }
        setMessage(result.message); router.refresh();
      } catch { setMessage("We could not update your follow. Please try again."); }
    });
  }
  return { following, pending, message, toggle };
}
