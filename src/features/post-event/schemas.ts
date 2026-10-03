import { z } from "zod";
export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.union([z.literal(""), z.string().max(1000).trim().min(1)]).optional(),
});
export type FeedbackActionState = { ok?: boolean; message?: string };
export type ViewerFeedback = { eligible: boolean; noShow: boolean; feedback: { rating: number; comment: string | null } | null };
export const feedbackOff: ViewerFeedback = { eligible: false, noShow: false, feedback: null };
export const ratingLabels = ["Poor", "Fair", "Good", "Very good", "Excellent"] as const;
