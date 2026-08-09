/* ============================================================
   VeltaCapital — shared front-end state
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
  return {
    get:()=>({...state}),
    fakeLogin, useTrialRound, reset,
    save:()=>save(state),
    apiLogin, apiMe, apiLogout, apiSubmitScore, apiRedeem, apiStats,
  };
})();

/* ---- Plan definitions (shared across pages) ---- */
const PLANS = {
  trial: {
    name:'Legacy Trial',
    price:'Enrollment closed', cadence:'',
    blurb:'A legacy access tier retained for existing accounts.',
    paymentLink:'',
    simRuns:5, unlimited:false,
    features:[
      'Full written course',
      '5 simulation runs',
      'Path scoring and descriptive chart observations',
    ],
  },
  starter: {
    name:'Legacy Starter',
    price:'Enrollment closed', cadence:'',
    blurb:'A legacy access tier retained for existing accounts.',
    paymentLink:'',
    simRuns:15, unlimited:false,
    features:[
      'Full written course',
      '15 simulation runs',
      'Path scoring and descriptive chart observations',
    ],
  },
  standard: {
    name:'Complete Course',
    price:'Price pending review', cadence:'',
    blurb:'One complete learning path with written lessons, practice, and assessments.',
    paymentLink:'',
    simRuns:50, unlimited:false,
    features:[
      'Full written course',
      '50 simulation runs',
      'Progress tracking by skill (trend, volume, support/resistance)',
      'Reflection history and assessments',
    ],
  },
  premium: {
    name:'Legacy Premium',
    price:'Enrollment closed', cadence:'',
    blurb:'A legacy unlimited-practice tier retained for existing accounts.',
    paymentLink:'',
    simRuns:0, unlimited:true,
    features:[
      'Full written course',
      'Unlimited simulation runs',
      'Progress tracking by skill',
      'Early access to new lessons',
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
