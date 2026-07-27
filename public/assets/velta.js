/* ============================================================
   VeltaCapital — shared front-end state (PROTOTYPE)
   ------------------------------------------------------------
   ⚠️  EVERYTHING IN THIS FILE IS SIMULATED.
   None of this is secure or real. When the backend is built,
   each function marked  // [BACKEND]  gets replaced by a real
   server call (auth, payments, plan checks, credit ledger).

   Why it's fake for now: GitHub Pages serves static files only,
   so login/payment/credits cannot be trusted here. This layer
   lets us design and test the full flow without a server.
   ============================================================ */

const Velta = (() => {
  // Prototype state lives in the browser only. A real build keeps
  // this server-side so users can't edit their own plan/credits.
  const KEY = 'velta_proto_v1';
  const DEFAULTS = { loggedIn:false, name:'', email:'', plan:'none', credits:0, trialRoundsUsed:0 };

  function load(){
    try { return Object.assign({}, DEFAULTS, JSON.parse(sessionStorage.getItem(KEY)||'{}')); }
    catch { return Object.assign({}, DEFAULTS); }
  }
  function save(s){ try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} }
  let state = load();

  // [BACKEND] real version: redirect to Google OAuth, verify on server.
  function fakeLogin(name, email){
    state.loggedIn = true;
    state.name = name || 'Trial User';
    state.email = email || 'you@example.com';
    save(state);
  }
  // [BACKEND] real version: Stripe Checkout → webhook confirms → server sets plan.
  function fakeBuy(plan){
    state.plan = plan;
    // grant the plan's starting credits (Pro/Investor include some)
    const grant = PLANS[plan]?.startCredits || 0;
    state.credits += grant;
    save(state);
  }
  // [BACKEND] real version: server-side credit ledger with an audit trail.
  function addCredits(n){ state.credits += n; save(state); }
  function spendCredits(n){ if(state.credits>=n){ state.credits-=n; save(state); return true; } return false; }

  function useTrialRound(){ state.trialRoundsUsed++; save(state); return state.trialRoundsUsed; }
  function reset(){ state = Object.assign({}, DEFAULTS); save(state); }

  // ---- REAL backend methods (talk to the database via API routes) ----
  // These replace the simulated ones for login/account. They're async.
  // Google sign-in via NextAuth. Redirects away; no return value.
async function apiLogin(){
    const r = await fetch('/api/auth/csrf');
    const { csrfToken } = await r.json();

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/auth/signin/google';

    const csrf = document.createElement('input');
    csrf.type = 'hidden';
    csrf.name = 'csrfToken';
    csrf.value = csrfToken;
    form.appendChild(csrf);

    const cb = document.createElement('input');
    cb.type = 'hidden';
    cb.name = 'callbackUrl';
    cb.value = '/member.html';
    form.appendChild(cb);

    document.body.appendChild(form);
    form.submit();
  }
  async function apiMe(){
    const r = await fetch('/api/auth/me');
    const data = await r.json();
    return data.ok ? data.user : null; // null if not logged in
  }
  // Sign out via NextAuth, then return home.
  function apiLogout(){
    window.location.href = "/api/auth/signout?callbackUrl=/";
  }
  async function apiStats(){
    const r = await fetch('/api/stats');
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Could not load stats');
    return data;
  }
  async function apiBuy(plan){
    const r = await fetch('/api/plan/set', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ plan }),
    });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Could not set plan');
    return data.user;
  }
  async function apiSubmitScore(result){
    const r = await fetch('/api/score/submit', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(result),
    });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Could not save score');
    return data; // { credits: newBalance }
  }
  async function apiLeaderboard(){
    const r = await fetch('/api/leaderboard');
    const data = await r.json();
    return data.ok ? data.rows : [];
  }
  async function apiRedeem(rewardId){
    const r = await fetch('/api/rewards/redeem', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ rewardId }),
    });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Could not redeem');
    return data;
  }

  return {
    get:()=>({...state}),
    fakeLogin, fakeBuy, addCredits, spendCredits, useTrialRound, reset,
    save:()=>save(state),
    apiLogin, apiMe, apiLogout, apiBuy, apiSubmitScore, apiLeaderboard, apiRedeem, apiStats,
  };
})();

/* ---- Plan definitions (shared across pages) ----
   Designed per the owner's spec; Investor tier proposed.
   Pricing shown as placeholders [P] — owner to confirm. */
const PLANS = {
  trial: {
    name:'Course Trial',
    price:'$9', cadence:'one-time',
    blurb:'Try the course and see how the simulator works.',
    simRuns:5, unlimited:false, canRedeem:false, earnMult:1.0,
    startCredits:0,
    creditsNote:'Earn credits by playing. Redemption unlocks at Standard.',
    features:[
      'Full written course',
      '5 simulation runs',
      'Full scoring & "why it moved" breakdowns',
      'Earn credits from gameplay',
    ],
  },
  starter: {
    name:'Starter',
    price:'$19', cadence:'one-time',
    blurb:'Enough practice to build a real habit.',
    simRuns:15, unlimited:false, canRedeem:false, earnMult:1.0,
    startCredits:0,
    creditsNote:'Earn credits by playing. Redemption unlocks at Standard.',
    features:[
      'Full written course',
      '15 simulation runs',
      'Full scoring & "why it moved" breakdowns',
      'Earn credits from gameplay',
      'Community leaderboard access',
    ],
  },
  standard: {
    name:'Standard',
    price:'$39', cadence:'one-time',
    blurb:'The full experience \u2014 practice, rewards, and progress.',
    simRuns:50, unlimited:false, canRedeem:true, earnMult:1.0,
    startCredits:0,
    creditsNote:'Credit redemption unlocked \u2014 spend credits on extra runs, modules, and badges.',
    features:[
      'Full written course',
      '50 simulation runs',
      'Credit redemption unlocked',
      'Progress tracking by skill (trend, volume, support/resistance)',
      'Community leaderboard access',
    ],
  },
  premium: {
    name:'Premium',
    price:'$69', cadence:'one-time',
    blurb:'Unlimited practice and the fastest way to earn.',
    simRuns:0, unlimited:true, canRedeem:true, earnMult:1.5,
    startCredits:0,
    creditsNote:'Earn credits 1.5\u00d7 faster on every round.',
    features:[
      'Full written course',
      'Unlimited simulation runs',
      '1.5\u00d7 credit earning rate',
      'Credit redemption unlocked',
      'Progress tracking by skill',
      'Priority leaderboard placement',
      'Early access to new lessons',
    ],
  },
};

/* ---- Reward ladder (shared) — internal rewards only, no cash/gift cards.
   Conversion mirrors the game: ~1,000 credits ≈ $1 of internal value. */


/* ---- shared UI helpers ---- */
function el(tag, attrs={}, html){
  const e=document.createElement(tag);
  for(const k in attrs){ if(k==='class')e.className=attrs[k]; else e.setAttribute(k,attrs[k]); }
  if(html!==undefined)e.innerHTML=html;
  return e;
}
function fmt(n){ return n.toLocaleString(); }

/* ---- VeltaCapital wordmark / candle motif (inline SVG) ---- */
function veltaMark(){
  return `<svg class="mark" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <rect x="3"  y="9"  width="4" height="10" rx="1" fill="#16A36A"/>
    <line x1="5"  y1="5"  x2="5"  y2="9"  stroke="#16A36A" stroke-width="1.4"/>
    <line x1="5"  y1="19" x2="5"  y2="22" stroke="#16A36A" stroke-width="1.4"/>
    <rect x="11" y="6"  width="4" height="8"  rx="1" fill="#D8503C"/>
    <line x1="13" y1="3"  x2="13" y2="6"  stroke="#D8503C" stroke-width="1.4"/>
    <line x1="13" y1="14" x2="13" y2="18" stroke="#D8503C" stroke-width="1.4"/>
    <rect x="19" y="8"  width="4" height="11" rx="1" fill="#E0A21A"/>
    <line x1="21" y1="4"  x2="21" y2="8"  stroke="#E0A21A" stroke-width="1.4"/>
    <line x1="21" y1="19" x2="21" y2="23" stroke="#E0A21A" stroke-width="1.4"/>
  </svg>`;
}
