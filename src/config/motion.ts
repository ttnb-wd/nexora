/** Seconds for Motion; matching CSS interaction tokens live in globals.css. */
export const motionTokens = {
  ease: { premium: [0.22, 1, 0.36, 1], float: "easeInOut" },
  duration: { fast: 0.18, normal: 0.45, slow: 0.8, float: 12, gradient: 10 },
  stagger: { word: 0.065, line: 0.12, element: 0.1 },
  spring: { stiffness: 260, damping: 24, mass: 0.8 },
  distance: { subtle: 16, reveal: 32, float: 12 },
} as const;
