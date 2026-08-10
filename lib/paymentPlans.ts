export const PAYMENT_PLANS = {
  trial: {
    url: "https://buy.stripe.com/5kQ3cv06e2zEfSHfil5sA01",
    runs: 5,
    unlimited: false,
    rank: 1,
  },
  starter: {
    url: "https://buy.stripe.com/bJeeVdg5cgqufSHb255sA03",
    runs: 15,
    unlimited: false,
    rank: 2,
  },
  standard: {
    url: "https://buy.stripe.com/aFadR9aKS2zEaynfil5sA04",
    runs: 50,
    unlimited: false,
    rank: 3,
  },
  premium: {
    url: "https://buy.stripe.com/28E5kD9GOdei8qfdad5sA05",
    runs: 0,
    unlimited: true,
    rank: 4,
  },
} as const;

export type PlanKey = keyof typeof PAYMENT_PLANS;

export function planFromPaymentLinkUrl(value: string): PlanKey | null {
  try {
    const candidate = new URL(value);
    candidate.search = "";
    candidate.hash = "";
    const normalized = candidate.toString().replace(/\/$/, "");
    const match = Object.entries(PAYMENT_PLANS).find(([, plan]) => plan.url === normalized);
    return match ? match[0] as PlanKey : null;
  } catch {
    return null;
  }
}
