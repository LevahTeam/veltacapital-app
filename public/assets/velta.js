/* ============================================================
   VeltaCapital: shared front-end state
   ============================================================ */

const Velta = (() => {
  const KEY = 'velta_proto_v1';
  const DEFAULTS = { loggedIn:false, name:'', email:'', plan:'none', trialRoundsUsed:0 };

  function load(){
    try { return Object.assign({}, DEFAULTS, JSON.parse(sessionStorage.getItem(KEY)||'{}')); }
    catch { return Object.assign({}, DEFAULTS); }
  }
  function save(s){ try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} }
  let state = load();

  function fakeLogin(name, email){
    state.loggedIn = true;
    state.name = name || 'Trial User';
    state.email = email || 'you@example.com';
    save(state);
  }
  function useTrialRound(){ state.trialRoundsUsed++; save(state); return state.trialRoundsUsed; }
  function reset(){ state = Object.assign({}, DEFAULTS); save(state); }

  // ---- REAL backend methods (talk to the database via API routes) ----
  async function apiLogin(callbackUrl){
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
    cb.value = typeof callbackUrl === 'string' && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
      ? callbackUrl
      : '/member.html';
    form.appendChild(cb);

    document.body.appendChild(form);
    form.submit();
  }
  async function apiMe(){
    const r = await fetch('/api/auth/me');
    const data = await r.json();
    return data.ok ? data.user : null;
  }
  function apiLogout(){
    window.location.href = "/api/auth/signout?callbackUrl=/";
  }
  async function apiStats(){
    const r = await fetch('/api/stats');
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Could not load stats');
    return data;
  }
  async function apiSubmitScore(result){
    const r = await fetch('/api/score/submit', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(result),
    });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Could not save score');
    return data;
  }
  async function apiRedeem(rewardId){
    const r = await fetch('/api/rewards/redeem', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ rewardId }),
    });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Could not redeem reward');
    return data;
  }
  async function apiBuy(plan,knownUser){
    const selected=PLANS[plan];
    if(!selected || !selected.paymentLink)throw new Error('This payment option is not configured');
    const user=knownUser||await apiMe();
    if(!user)throw new Error('Sign in before choosing a plan');
    if(user.plan&&user.plan!=='none')throw new Error('This account already has course access. Contact support before buying another plan.');
    if(!user.id||!user.email)throw new Error('Your account is missing the information required for checkout');
    const checkout=new URL(selected.paymentLink);
    checkout.searchParams.set('client_reference_id',user.id);
    checkout.searchParams.set('locked_prefilled_email',user.email);
    window.location.assign(checkout.toString());
  }
  async function apiConfirmCheckout(sessionId){
    const r=await fetch('/api/stripe/confirm',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sessionId}),
    });
    const data=await r.json();
    if(!data.ok)throw new Error(data.error||'Could not confirm payment');
    return data;
  }
  async function apiPortfolio(){
    const r=await fetch('/api/portfolio');
    const data=await r.json();
    if(!data.ok)throw new Error(data.error||'Could not load simulation portfolio');
    return data;
  }
  return {
    get:()=>({...state}),
    fakeLogin, useTrialRound, reset,
    save:()=>save(state),
    apiLogin, apiMe, apiLogout, apiSubmitScore, apiRedeem, apiBuy, apiConfirmCheckout, apiPortfolio, apiStats,
  };
})();

/* ---- Plan definitions (shared across pages) ---- */
const PLANS = {
  trial: {
    name:'Course Trial',
    price:'$9', cadence:'one-time',
    blurb:'A low-cost introduction to the written course and historical chart practice.',
    paymentLink:'https://buy.stripe.com/5kQ3cv06e2zEfSHfil5sA01',
    simRuns:5, unlimited:false,
    features:[
      'First 5 course chapters',
      '5 historical chart exercises',
      '$100 option comparisons and portfolio history',
      'Earn and redeem non-cash learning credits',
    ],
  },
  starter: {
    name:'Starter',
    price:'$19', cadence:'one-time',
    blurb:'More lessons and practice for learners building their foundation.',
    paymentLink:'https://buy.stripe.com/bJeeVdg5cgqufSHb255sA03',
    simRuns:15, unlimited:false,
    features:[
      'First 10 course chapters',
      '15 historical chart exercises',
      '$100 option comparisons and portfolio history',
      'Earn and redeem non-cash learning credits',
    ],
  },
  standard: {
    name:'Standard',
    price:'$39', cadence:'one-time',
    blurb:'The full written curriculum with enough practice for structured repetition.',
    paymentLink:'https://buy.stripe.com/aFadR9aKS2zEaynfil5sA04',
    simRuns:50, unlimited:false,
    features:[
      'All 15 course chapters',
      '50 historical chart exercises',
      '$100 option comparisons and lifetime portfolio',
      'Certificate eligibility and learning rewards',
    ],
  },
  premium: {
    name:'Premium',
    price:'$69', cadence:'one-time',
    blurb:'Full curriculum access with unlimited historical chart practice.',
    paymentLink:'https://buy.stripe.com/28E5kD9GOdei8qfdad5sA05',
    simRuns:0, unlimited:true,
    features:[
      'All 15 course chapters',
      'Unlimited historical chart exercises',
      '$100 option comparisons and lifetime portfolio',
      'Certificate eligibility and learning rewards',
    ],
  },
};

/* ---- shared UI helpers ---- */
function el(tag, attrs={}, html){
  const e=document.createElement(tag);
  for(const k in attrs){ if(k==='class')e.className=attrs[k]; else e.setAttribute(k,attrs[k]); }
  if(html!==undefined)e.innerHTML=html;
  return e;
}
function fmt(n){ return n.toLocaleString(); }


function veltaMark(){
  return '<img src="assets/img/logo-mark.png" alt="VeltaCapital" ' +
         'style="height:36px;width:auto;display:block" />';
}
