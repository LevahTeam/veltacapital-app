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
  async function apiLogin(email, name){
    const r = await fetch('/api/auth/login', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, name }),
    });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Login failed');
    return data.user; // { id, email, name, plan, credits }
  }
  async function apiMe(){
    const r = await fetch('/api/auth/me');
    const data = await r.json();
    return data.ok ? data.user : null; // null if not logged in
  }
  async function apiLogout(){
    await fetch('/api/auth/logout', { method:'POST' });
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
  async function apiRedeem(rewardName, creditCost){
    const r = await fetch('/api/rewards/redeem', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ rewardName, creditCost }),
    });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Could not redeem');
    return data; // { credits: newBalance }
  }

  return {
    get:()=>({...state}),
    fakeLogin, fakeBuy, addCredits, spendCredits, useTrialRound, reset,
    save:()=>save(state),
    apiLogin, apiMe, apiLogout, apiBuy, apiSubmitScore, apiLeaderboard, apiRedeem,
  };
})();

/* ---- Plan definitions (shared across pages) ----
   Designed per the owner's spec; Investor tier proposed.
   Pricing shown as placeholders [P] — owner to confirm. */
const PLANS = {
  basic: {
    name:'Basic',
    price:'$24.99', cadence:'/ course',
    blurb:'Everything you need to start reading charts.',
    gameRoundsDaily:10,
    videos:5,
    startCredits:0,
    creditsNote:'Earn credits by playing — redeem for practice packs & badges.',
    features:[
      '5 core course videos',
      '10 prediction rounds per day',
      'Full scoring & "what the chart showed" breakdowns',
      'Earn credits from gameplay',
      'Community leaderboard access',
    ],
  },
  pro: {
    name:'Pro',
    price:'$49.99', cadence:'/ course',
    blurb:'Go deeper, play more, unlock rewards.',
    gameRoundsDaily:20,
    videos:10,
    startCredits:2500,
    creditsNote:'Includes 2,500 starter credits toward rewards.',
    features:[
      'All 10 course videos',
      '20 prediction rounds per day',
      '2,500 starter credits',
      'Replay-with-hints mode',
      'Progress tracking by skill (trend, volume, support/resistance)',
      'Priority leaderboard placement',
    ],
  },
  investor: {
    name:'Investor',
    price:'$129.99', cadence:'/ course',
    blurb:'The full mentorship experience.',
    gameRoundsDaily:9999,
    videos:9999,
    startCredits:8000,
    creditsNote:'Includes 8,000 starter credits + monthly credit drops.',
    features:[
      'Everything in Pro',
      'Unlimited daily rounds',
      'All current + future course videos',
      '8,000 starter credits',
      'Monthly live Q&A session with Saechan',
      'One 1-on-1 chart-review session',
      'Certificate of completion',
      'Early access to new lessons',
    ],
  },
};

/* ---- Reward ladder (shared) — internal rewards only, no cash/gift cards.
   Conversion mirrors the game: ~1,000 credits ≈ $1 of internal value. */
const REWARDS = [
  { name:'Profile badge',                 credits:500 },
  { name:'Extra practice pack (10 rounds)',credits:1200 },
  { name:'Replay-with-hints unlock',       credits:2000 },
  { name:'$5 course-credit toward next tier',credits:5000 },
  { name:'Instructor feedback ticket',     credits:9000 },
  { name:'1-on-1 chart review session',    credits:20000 },
];

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
