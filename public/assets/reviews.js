const VeltaReviews = (() => {
  const DRAFT_KEY = "velta_review_draft";
  const LIMITS = { nameMin: 2, nameMax: 40, bodyMin: 20, bodyMax: 600 };
  const byId = (id) => document.getElementById(id);

  let t = (key) => key;
  let language = () => "en";
  let requestLogin = () => {};
  let wall = { state: "loading", reviews: [] };
  let signedIn = false;
  let mine = null;

  function readDraft() {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveDraft(draft) {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage may be disabled; the writer stays on this page with their text.
    }
  }

  function clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing was stored.
    }
  }

  function formValues() {
    const form = byId("review-form");
    return {
      displayName: form.elements.displayName.value.trim(),
      rating: Number(form.elements.rating.value) || 0,
      body: form.elements.body.value.trim(),
      consent: form.elements.consent.checked,
    };
  }

  function fillForm({ displayName = "", rating = 0, body = "", consent = false }) {
    const form = byId("review-form");
    form.elements.displayName.value = displayName;
    form.elements.body.value = body;
    form.elements.consent.checked = consent;
    form.querySelectorAll('[name="rating"]').forEach((radio) => {
      radio.checked = Number(radio.value) === rating;
    });
    updateCounter();
  }

  function localProblem(values) {
    if (values.displayName.length < LIMITS.nameMin) return "name";
    if (!values.rating) return "rating";
    if (values.body.length < LIMITS.bodyMin) return "body";
    if (!values.consent) return "consent";
    return null;
  }

  function setMessage(key, tone) {
    const message = byId("review-message");
    message.textContent = key ? t(key) : "";
    message.dataset.tone = tone || "";
    message.dataset.key = key || "";
  }

  function updateCounter() {
    const { length } = byId("review-body").value;
    byId("review-count").textContent = `${length} / ${LIMITS.bodyMax}`;
  }

  function renderMarks(host, rating) {
    const marks = document.createElement("span");
    marks.className = "review-marks";
    marks.setAttribute("aria-hidden", "true");
    marks.textContent = "▮".repeat(rating) + "▯".repeat(5 - rating);
    const value = document.createElement("span");
    value.className = "review-score";
    value.textContent = `${rating} / 5`;
    host.append(marks, value);
  }

  function reviewCard(review) {
    const card = document.createElement("figure");
    card.className = "review-card";
    const rating = document.createElement("p");
    rating.className = "review-rating";
    renderMarks(rating, review.rating);
    const body = document.createElement("blockquote");
    body.lang = review.language;
    body.textContent = review.body;
    const caption = document.createElement("figcaption");
    const name = document.createElement("b");
    name.textContent = review.displayName;
    const meta = document.createElement("span");
    const date = new Date(review.createdAt).toLocaleDateString(language(), { year: "numeric", month: "short" });
    meta.textContent = `${date} · ${review.language.toUpperCase()}`;
    caption.append(name, meta);
    card.append(rating, body, caption);
    return card;
  }

  function renderWall() {
    const host = byId("review-wall");
    if (wall.reviews.length) {
      host.replaceChildren(...wall.reviews.map(reviewCard));
      return;
    }
    const empty = document.createElement("div");
    empty.className = "review-empty";
    const heading = document.createElement("p");
    heading.className = "review-empty-title";
    heading.textContent = t(`reviews.${wall.state}Title`);
    const copy = document.createElement("p");
    copy.textContent = t(`reviews.${wall.state}Copy`);
    empty.append(heading, copy);
    host.replaceChildren(empty);
  }

  function renderStatus() {
    const box = byId("review-status");
    box.hidden = !mine;
    byId("review-delete").hidden = !mine;
    if (mine) {
      box.dataset.status = mine.status;
      box.textContent = t(`reviews.status.${mine.status}`);
    }
    byId("review-submit").textContent = t(mine ? "reviews.update" : "reviews.submit");
    byId("review-signin-note").hidden = signedIn;
  }

  function render() {
    renderWall();
    renderStatus();
    const key = byId("review-message").dataset.key;
    if (key) byId("review-message").textContent = t(key);
  }

  async function load() {
    try {
      const response = await fetch("/api/reviews");
      const data = await response.json();
      if (!data.ok) throw new Error("unavailable");
      wall = { state: "empty", reviews: data.reviews };
      signedIn = data.signedIn;
      mine = data.mine;
    } catch {
      wall = { state: "unavailable", reviews: [] };
    }
    const draft = readDraft();
    if (draft) {
      fillForm(draft);
      if (signedIn) setMessage("reviews.readyAfterSignIn", "info");
    } else if (mine) {
      fillForm({ ...mine, consent: false });
    }
    render();
  }

  async function submit(event) {
    event.preventDefault();
    const values = formValues();
    const problem = localProblem(values);
    if (problem) {
      setMessage(`reviews.problem.${problem}`, "error");
      return;
    }
    if (!signedIn) {
      saveDraft(values);
      requestLogin(event.submitter || byId("review-submit"));
      return;
    }

    const button = byId("review-submit");
    button.disabled = true;
    setMessage("reviews.sending", "info");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, language: language() }),
      });
      const data = await response.json();
      if (data.anon) {
        signedIn = false;
        saveDraft(values);
        renderStatus();
        requestLogin(button);
      } else if (data.ok) {
        mine = data.mine;
        clearDraft();
        byId("review-form").elements.consent.checked = false;
        setMessage("reviews.sent", "success");
        renderStatus();
      } else {
        setMessage(`reviews.problem.${data.problem || "unavailable"}`, "error");
      }
    } catch {
      setMessage("reviews.problem.unavailable", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function removeMine() {
    if (!window.confirm(t("reviews.deleteConfirm"))) return;
    try {
      const response = await fetch("/api/reviews", { method: "DELETE" });
      if (!(await response.json()).ok) throw new Error("failed");
      mine = null;
      clearDraft();
      fillForm({});
      setMessage("reviews.deleted", "success");
      await load();
    } catch {
      setMessage("reviews.problem.unavailable", "error");
    }
  }

  function mount(options) {
    ({ t, language, requestLogin } = options);
    byId("review-form").addEventListener("submit", submit);
    byId("review-body").addEventListener("input", updateCounter);
    byId("review-delete").addEventListener("click", removeMine);
    updateCounter();
    render();
    load();
  }

  return { mount, render };
})();
