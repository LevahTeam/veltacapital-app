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

function withoutQueryOrFragment(value: string) {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function planFromPaymentLinkUrl(value: string): PlanKey | null {
  try {
    const normalizedUrl = withoutQueryOrFragment(value);
    for (const planName of Object.keys(PAYMENT_PLANS) as PlanKey[]) {
      if (PAYMENT_PLANS[planName].url === normalizedUrl) return planName;
    }
    return null;
  } catch {
    return null;
  }
}
