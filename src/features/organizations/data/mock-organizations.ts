import type { Organization } from "../types";

/** Fictional UI fixtures only. Reserved .example URLs are explicitly labeled placeholders. */
export const mockOrganizations: Organization[] = [
  {
    id: "tomorrow-collective", slug: "tomorrow-collective", name: "Tomorrow Collective", shortName: "TC",
    description: "A meeting point for curious minds shaping a more thoughtful, connected future.",
    about: ["Tomorrow Collective brings makers, designers, and researchers into the same conversation. We believe new possibilities emerge when people step outside their usual circle and explore together.", "Our gatherings blend fresh perspectives with small, practical experiments. Come with a question, share what you know, and make room for a direction you haven’t considered yet."],
    statement: "The future is better when we imagine it together.", industry: "Technology", location: { city: "Yangon", region: "Myanmar" }, website: "https://tomorrow-collective.example", socialLinks: [{ kind: "professional", label: "Professional network", url: "https://tomorrow-collective.example/network" }, { kind: "community", label: "Community", url: "https://tomorrow-collective.example/community" }], visualTheme: "mixed", logo: "asterisk", featured: true,
    topics: ["Human-centered technology", "Creative collaboration", "AI", "Future thinking"],
    team: [{ name: "Maya Lin Htet", role: "Creative technologist", initials: "ML", note: "Bringing people and possibilities into conversation." }, { name: "Robin Nyein", role: "Experience curator", initials: "RN", note: "Making space for welcoming, thoughtful gatherings." }],
  },
  {
    id: "form-and-friends", slug: "form-and-friends", name: "Form & Friends", shortName: "F&F",
    description: "A creative community exploring design that feels as good as it works.",
    about: ["Form & Friends makes space for the human side of design. We gather around sketches, systems, movement, and the small details that make an experience feel alive.", "From relaxed studio afternoons to online salons, our sessions invite designers at every stage to exchange perspectives and find new energy for their practice."],
    statement: "Make room for a little creative possibility.", industry: "Design", location: { city: "Yangon", region: "Myanmar" }, website: "https://form-and-friends.example", socialLinks: [{ kind: "professional", label: "Professional network", url: "https://form-and-friends.example/network" }, { kind: "community", label: "Community", url: "https://form-and-friends.example/community" }], visualTheme: "violet", logo: "orbit", featured: true,
    topics: ["Creative practice", "Motion design", "Design systems", "Accessible experiences"],
    team: [{ name: "Alex Thura", role: "Design facilitator", initials: "AT", note: "Connecting thoughtful systems with expressive ideas." }, { name: "Rowan Hnin", role: "Studio host", initials: "RH", note: "Turning a shared workspace into good company." }],
  },
  {
    id: "open-lab", slug: "open-lab", name: "Open Lab", shortName: "OL",
    description: "Open questions. Useful experiments. Emerging ideas made approachable.",
    about: ["Open Lab is a place to move beyond the headlines and try something useful. Our workshops make emerging technology easier to question, understand, and explore.", "We learn in the open, share our experiments, and welcome people with different starting points. Curiosity matters more than having all the answers."],
    statement: "Better questions lead to better experiments.", industry: "AI", location: { city: "Online", region: "Connected everywhere" }, website: "https://open-lab.example", socialLinks: [{ kind: "professional", label: "Professional network", url: "https://open-lab.example/network" }, { kind: "community", label: "Community", url: "https://open-lab.example/community" }], visualTheme: "cyan", logo: "spark", featured: false,
    topics: ["AI workflows", "Open learning", "Practical research"],
    team: [{ name: "Jamie Khin", role: "Research lead", initials: "JK", note: "Making complex ideas clear and useful." }, { name: "Avery Myat", role: "Workshop host", initials: "AM", note: "Helping curious people learn by trying." }],
  },
  {
    id: "good-company", slug: "good-company", name: "Good Company", shortName: "GC",
    description: "Welcoming local spaces for meaningful conversation and everyday connection.",
    about: ["Good Company starts with a simple invitation: come as you are. Our local gatherings bring neighbors together around shared stories, interests, and small possibilities.", "We care about spaces that feel easy to enter and conversations that leave room for everyone. Sometimes the most useful thing you can make is a new connection."],
    statement: "Good things start with hello.", industry: "Community", location: { city: "Mandalay", region: "Myanmar" }, website: "https://good-company.example", socialLinks: [{ kind: "professional", label: "Professional network", url: "https://good-company.example/network" }, { kind: "community", label: "Community", url: "https://good-company.example/community" }], visualTheme: "coral", logo: "waves", featured: true,
    topics: ["Local connection", "Community stories", "Welcoming spaces"],
    team: [{ name: "Nora Win", role: "Community builder", initials: "NW", note: "Helping strangers become neighbors." }, { name: "Casey Thet", role: "Gathering host", initials: "CT", note: "Making every introduction feel a little easier." }],
  },
  {
    id: "first-step-club", slug: "first-step-club", name: "First Step Club", shortName: "FS",
    description: "Practical conversations and honest encouragement for people starting something.",
    about: ["First Step Club supports early founders and small teams as they turn a promising question into a practical next move. We trade polished success stories for honest experience.", "Our gatherings combine founder conversations, shared exercises, and room to meet people working through similar questions."],
    statement: "Start small. Find your people. Keep going.", industry: "Startup", location: { city: "Yangon", region: "Myanmar" }, website: "https://first-step-club.example", socialLinks: [{ kind: "professional", label: "Professional network", url: "https://first-step-club.example/network" }, { kind: "community", label: "Community", url: "https://first-step-club.example/community" }], visualTheme: "warm", logo: "blocks", featured: false,
    topics: ["Early-stage ideas", "Founder stories", "Thoughtful growth"],
    team: [{ name: "Sam Aung", role: "Founder & facilitator", initials: "SA", note: "Helping early ideas find a practical first step." }, { name: "Reese Thant", role: "Community host", initials: "RT", note: "Building a circle of support for new ventures." }],
  },
  {
    id: "better-business-circle", slug: "better-business-circle", name: "Better Business Circle", shortName: "BB",
    description: "Independent teams learning to grow with purpose and play the long game.",
    about: ["Better Business Circle connects people who believe growth should consider the people and communities around it. We explore practical business questions through shared experience.", "Expect useful conversations, thoughtful perspectives, and time to connect with teams who are also choosing a more considered approach."],
    statement: "Build something that grows with purpose.", industry: "Business", location: { city: "Mandalay", region: "Myanmar" }, website: "https://better-business-circle.example", socialLinks: [{ kind: "professional", label: "Professional network", url: "https://better-business-circle.example/network" }, { kind: "community", label: "Community", url: "https://better-business-circle.example/community" }], visualTheme: "blue", logo: "blocks", featured: false,
    topics: ["Purposeful growth", "Independent business", "Long-term value"],
    team: [{ name: "Taylor Aye", role: "Business facilitator", initials: "TA", note: "Making space for a more thoughtful approach to growth." }, { name: "Morgan Zaw", role: "Program curator", initials: "MZ", note: "Connecting independent teams through shared learning." }],
  },
  {
    id: "next-chapter-network", slug: "next-chapter-network", name: "Next Chapter Network", shortName: "NC",
    description: "Career possibilities explored with clarity, intention, and good company.",
    about: ["Next Chapter Network supports curious professionals considering a new direction. We create room to reflect on strengths, explore possibilities, and shape a small action to take next.", "Our guided sessions balance practical exercises with real conversation. You don’t need a perfect plan to begin."],
    statement: "There’s room for what comes next.", industry: "Career", location: { city: "Online", region: "Connected everywhere" }, website: "https://next-chapter-network.example", socialLinks: [{ kind: "professional", label: "Professional network", url: "https://next-chapter-network.example/network" }, { kind: "community", label: "Community", url: "https://next-chapter-network.example/community" }], visualTheme: "mixed", logo: "northstar", featured: false,
    topics: ["Career clarity", "Personal growth", "Next steps"],
    team: [{ name: "Ellis Min", role: "Career coach", initials: "EM", note: "Helping people recognize their strengths and possibilities." }, { name: "Drew Su", role: "Session facilitator", initials: "DS", note: "Turning reflection into a thoughtful next move." }],
  },
  {
    id: "weekend-makers", slug: "weekend-makers", name: "Weekend Makers", shortName: "WM",
    description: "Learn by making. Meet through experiments. Give a small idea a whole day.",
    about: ["Weekend Makers brings curious people together to turn ideas into something tangible. Code, paper, first sketches, and unfinished experiments are all welcome.", "We build at our own pace, share what gets us unstuck, and celebrate the small discoveries along the way."],
    statement: "Think a little. Make a little. Share a lot.", industry: "Technology", location: { city: "Yangon", region: "Myanmar" }, website: "https://weekend-makers.example", socialLinks: [{ kind: "professional", label: "Professional network", url: "https://weekend-makers.example/network" }, { kind: "community", label: "Community", url: "https://weekend-makers.example/community" }], visualTheme: "warm", logo: "spark", featured: false,
    topics: ["Hands-on learning", "Creative experiments", "Making together"],
    team: [{ name: "Harper Wai", role: "Maker & host", initials: "HW", note: "Helping small ideas become things you can share." }, { name: "Finley Tun", role: "Workshop curator", initials: "FT", note: "Keeping the tools approachable and the questions open." }],
  },
  {
    id: "northstar-labs", slug: "northstar-labs", name: "Northstar Labs", shortName: "NL",
    description: "A fictional research studio exploring useful intelligence and thoughtful tools.",
    about: ["Northstar Labs explores how research can become approachable, useful experiences. Our work begins with questions about the people a tool serves.", "We’re shaping our first open gatherings. Follow along in this demo and explore the interests behind the studio while the program takes shape."],
    statement: "Let curiosity point the way.", industry: "AI", location: { city: "Online", region: "Connected everywhere" }, socialLinks: [], visualTheme: "blue", logo: "northstar", featured: false,
    topics: ["Applied intelligence", "Thoughtful tools", "Research in the open"],
    team: [],
  },
];
export const featuredOrganization = mockOrganizations[0];

