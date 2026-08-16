const Velta = (() => {
  const STORAGE_KEY = "velta_proto_v1";
  const INITIAL_STATE = Object.freeze({
    loggedIn: false,
    name: "",
    email: "",
    plan: "none",
    trialRoundsUsed: 0,
  });

  function freshState(values = {}) {
    return { ...INITIAL_STATE, ...values };
  }

  function loadState() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
      return freshState(stored);
    } catch {
      return freshState();
    }
  }

  function persist(value) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage may be disabled; the in-memory session still works.
    }
  }

  async function responseData(response, fallbackMessage) {
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || fallbackMessage);
    return data;
  }

  async function postJson(path, payload, fallbackMessage) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return responseData(response, fallbackMessage);
  }

  function hiddenInput(name, value) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    return input;
  }

  function localCallback(value) {
    const isLocal =
      typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
    return isLocal ? value : "/member.html";
  }

  let state = loadState();

  function fakeLogin(name, email) {
    state = {
      ...state,
      loggedIn: true,
      name: name || "Trial User",
      email: email || "you@example.com",
    };
    persist(state);
  }

  function useTrialRound() {
    state = { ...state, trialRoundsUsed: state.trialRoundsUsed + 1 };
    persist(state);
    return state.trialRoundsUsed;
  }

  function reset() {
    state = freshState();
    persist(state);
  }

  async function getCsrfToken() {
    const response = await fetch("/api/auth/csrf", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not start secure sign-in");
    const { csrfToken } = await response.json();
    if (!csrfToken) throw new Error("Could not start secure sign-in");
    return csrfToken;
  }

  async function clearAuthSession(callbackUrl) {
    const csrfToken = await getCsrfToken();
    const body = new URLSearchParams({ csrfToken, callbackUrl: callbackUrl || "/" });
    const response = await fetch("/api/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) throw new Error("Could not switch accounts safely");
  }

  async function apiLogin(callbackUrl) {
    await clearAuthSession("/");
    const csrfToken = await getCsrfToken();
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/signin/google?prompt=select_account";
    form.append(hiddenInput("csrfToken", csrfToken));
    form.append(hiddenInput("callbackUrl", localCallback(callbackUrl)));
    document.body.append(form);
    form.submit();
  }

  async function apiMe() {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    return data.ok ? data.user : null;
  }

  async function apiLogout() {
    await clearAuthSession("/");
  }

  async function apiStats() {
    return responseData(await fetch("/api/stats"), "Could not load stats");
  }

  async function apiSubmitScore(result) {
    return postJson("/api/score/submit", result, "Could not save score");
  }

  async function apiRedeem(rewardId) {
    return postJson("/api/rewards/redeem", { rewardId }, "Could not redeem reward");
  }

  async function apiBuy(plan, knownUser) {
    const selectedPlan = PLANS[plan];
    if (!selectedPlan?.paymentLink) {
      throw new Error("This payment option is not configured");
    }

    const user = knownUser || (await apiMe());
    if (!user) throw new Error("Sign in before choosing a plan");
    if (user.plan && user.plan !== "none") {
      throw new Error(
        "This account already has course access. Contact support before buying another plan."
      );
    }
    if (!user.id || !user.email) {
      throw new Error("Your account is missing the information required for checkout");
    }

    const checkout = new URL(selectedPlan.paymentLink);
    checkout.searchParams.set("client_reference_id", user.id);
    checkout.searchParams.set("locked_prefilled_email", user.email);
    window.location.assign(checkout.toString());
  }

  async function apiConfirmCheckout(sessionId) {
    return postJson("/api/stripe/confirm", { sessionId }, "Could not confirm payment");
  }

  async function apiPortfolio() {
    return responseData(
      await fetch("/api/portfolio"),
      "Could not load simulation portfolio"
    );
  }

  return {
    get: () => ({ ...state }),
    save: () => persist(state),
    fakeLogin,
    useTrialRound,
    reset,
    apiLogin,
    apiMe,
    apiLogout,
    apiSubmitScore,
    apiRedeem,
    apiBuy,
    apiConfirmCheckout,
    apiPortfolio,
    apiStats,
  };
})();

function planDetails(name, price, blurb, paymentLink, simRuns, unlimited, features) {
  return { name, price, cadence: "one-time", blurb, paymentLink, simRuns, unlimited, features };
}

const PLANS = {
  trial: planDetails(
    "Course Trial", "$9",
    "A low-cost introduction to the written course and historical chart practice.",
    "https://buy.stripe.com/5kQ3cv06e2zEfSHfil5sA01", 5, false,
    ["First 5 course chapters", "5 historical chart exercises", "$100 option comparisons and portfolio history", "Earn and redeem non-cash learning credits"]
  ),
  starter: planDetails(
    "Starter", "$19",
    "More lessons and practice for learners building their foundation.",
    "https://buy.stripe.com/bJeeVdg5cgqufSHb255sA03", 15, false,
    ["First 10 course chapters", "15 historical chart exercises", "$100 option comparisons and portfolio history", "Earn and redeem non-cash learning credits"]
  ),
  standard: planDetails(
    "Standard", "$39",
    "The full written curriculum with enough practice for structured repetition.",
    "https://buy.stripe.com/aFadR9aKS2zEaynfil5sA04", 50, false,
    ["All 15 course chapters", "50 historical chart exercises", "$100 option comparisons and lifetime portfolio", "Certificate eligibility and learning rewards"]
  ),
  premium: planDetails(
    "Premium", "$69",
    "Full curriculum access with unlimited historical chart practice.",
    "https://buy.stripe.com/28E5kD9GOdei8qfdad5sA05", 0, true,
    ["All 15 course chapters", "Unlimited historical chart exercises", "$100 option comparisons and lifetime portfolio", "Certificate eligibility and learning rewards"]
  ),
};

function el(tag, attrs = {}, html) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "class") element.className = value;
    else element.setAttribute(name, value);
  }
  if (html !== undefined) element.innerHTML = html;
  return element;
}

function fmt(value) {
  return value.toLocaleString();
}

function veltaMark() {
  return (
    '<img src="assets/img/logo-mark.png" alt="VeltaCapital" ' +
    'style="height:36px;width:auto;display:block" />'
  );
}
