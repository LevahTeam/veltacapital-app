const Velta = (() => {
  const STORAGE_KEY = "velta_proto_v1";
  const INITIAL_STATE = Object.freeze({
    loggedIn: false,
    name: "",
    email: "",
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
    apiPortfolio,
    apiStats,
  };
})();

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
