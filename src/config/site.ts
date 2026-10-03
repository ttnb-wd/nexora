export const siteConfig = {
  name: "Nexora",
  description: "Discover what’s happening next.",
  tagline: "Your next idea. Your next connection. Your next great experience. Find it where people come together.",
  // Development placeholder; replace with the deployment origin before release.
  url: "http://localhost:3000",
  navigation: [
    { label: "Explore", href: "/explore" },
    { label: "Companies", href: "/companies" },
    { label: "Create Event", href: "/create-event" },
  ],
} as const;

export function isNavigationActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
    || (href === "/explore" && pathname.startsWith("/events/"));
}
