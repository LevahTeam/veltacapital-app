export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export const REVIEW_LANGUAGES = ["en", "ko", "fr"] as const;
export const REVIEW_LIMITS = {
  nameMin: 2,
  nameMax: 40,
  bodyMin: 20,
  bodyMax: 600,
  publicPage: 24,
} as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ReviewLanguage = (typeof REVIEW_LANGUAGES)[number];
export type ReviewProblem = "name" | "rating" | "body" | "links" | "language" | "consent";

export type ReviewFields = {
  displayName: string;
  rating: number;
  body: string;
  language: ReviewLanguage;
};

type ParsedReview =
  | { ok: true; data: ReviewFields }
  | { ok: false; problem: ReviewProblem };

const CONTROL_CHARACTERS = /[\u0000-\u0009\u000B-\u001F\u007F]/g;
const LINK_OR_EMAIL = /https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[^\s@]+/i;

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARACTERS, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseReview(input: unknown): ParsedReview {
  const candidate = (input ?? {}) as Record<string, unknown>;
  const displayName = cleanText(candidate.displayName).replace(/\s+/g, " ");
  const body = cleanText(candidate.body);
  const { rating, language, consent } = candidate;

  if (displayName.length < REVIEW_LIMITS.nameMin || displayName.length > REVIEW_LIMITS.nameMax) {
    return { ok: false, problem: "name" };
  }
  if (!Number.isInteger(rating) || Number(rating) < 1 || Number(rating) > 5) {
    return { ok: false, problem: "rating" };
  }
  if (body.length < REVIEW_LIMITS.bodyMin || body.length > REVIEW_LIMITS.bodyMax) {
    return { ok: false, problem: "body" };
  }
  if (LINK_OR_EMAIL.test(body) || LINK_OR_EMAIL.test(displayName)) {
    return { ok: false, problem: "links" };
  }
  if (!REVIEW_LANGUAGES.includes(language as ReviewLanguage)) {
    return { ok: false, problem: "language" };
  }
  if (consent !== true) return { ok: false, problem: "consent" };

  return {
    ok: true,
    data: { displayName, rating: Number(rating), body, language: language as ReviewLanguage },
  };
}

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return REVIEW_STATUSES.includes(value as ReviewStatus);
}
