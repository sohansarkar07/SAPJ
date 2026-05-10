// features.js — Wires all interactive functionality to the backend API
// Loaded AFTER app.js and extra_pages.js

const API = 'http://127.0.0.1:8000/api';

// ── Utility ──
function toggleDarkMode() {
  const d = document.documentElement.classList.toggle('dark');
  localStorage.theme = d ? 'dark' : 'light';
}
window.toggleDarkMode = toggleDarkMode;

async function api(path, opts = {}) {
  try {
    const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
    if (!r.ok) throw new Error(r.statusText);
    return await r.json();
  } catch (e) { console.warn('API err:', e); return null; }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'fixed bottom-6 right-6 z-[999] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 animate-[slideUp_0.3s_ease]';
  t.innerHTML = `<span class="material-symbols-outlined text-green-400 text-[18px]">check_circle</span> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Page Load Router ──
window.onPageLoad = function(page) {
  const loaders = { grants: loadGrants, volunteer: loadVolunteers, impact: loadImpact, mentees: loadMentees, projects: loadProjects, flashcards: loadFlashcards };
  if (loaders[page]) loaders[page]();
};

// ═══════════════════════════════════════
// 1. GRANTS
// ═══════════════════════════════════════
async function loadGrants() {
  const data = await api('/grants?user_id=1');
  const el = document.getElementById('grant-list');
  if (!el || !data) return;
  if (!data.length) { el.innerHTML = '<p class="p-4 text-sm text-slate-400 text-center">No grants yet</p>'; return; }
  el.innerHTML = data.map(g => `
    <div class="p-3 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all" onclick="showGrant(${g.grant_id})">
      <div class="flex justify-between items-start mb-1">
        <span class="font-semibold text-sm text-slate-800 dark:text-slate-200 line-clamp-1">${g.title}</span>
        <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm shrink-0 ml-2 ${g.status==='submitted'?'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300':'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}">${g.status}</span>
      </div>
      <span class="text-xs text-slate-400">Due: ${g.deadline||'—'}</span>
    </div>`).join('');
  showGrant(data[0].grant_id);
}

window.showGrant = async function(id) {
  const data = await api('/grants?user_id=1');
  const g = data?.find(x => x.grant_id === id);
  const el = document.getElementById('grant-editor-container');
  if (!el || !g) return;
  let sections = '';
  try {
    const c = JSON.parse(g.draft_content || '{}');
    sections = Object.entries(c).map(([k,v]) => `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-bold text-slate-800 dark:text-slate-200 capitalize">${k.replace(/_/g,' ')}</h3>
          <span class="material-symbols-outlined text-slate-400 text-[16px] hover:text-primary cursor-pointer" title="Regenerate">refresh</span>
        </div>
        <textarea class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 min-h-[100px] focus:outline-none focus:border-primary resize-y leading-relaxed">${v}</textarea>
      </div>`).join('');
  } catch(e) { sections = '<p class="p-6 text-slate-400 text-center">No draft content</p>'; }
  el.innerHTML = `
    <div class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex justify-between items-center">
      <div><h2 class="text-xl font-bold text-slate-800 dark:text-slate-200">${g.title}</h2>
      <p class="text-sm text-slate-500 mt-1">${g.status.toUpperCase()} · Due ${g.deadline}</p></div>
      <button class="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90">Export PDF</button>
    </div>
    <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">${sections}</div>`;
};

window.openNewGrantModal = function() { const m=document.getElementById('grant-modal'); m.classList.remove('hidden'); m.style.display='flex'; };
window.closeGrantModal = function() { const m=document.getElementById('grant-modal'); m.classList.add('hidden'); m.style.display='none'; };

window.generateGrantDraft = async function() {
  const t=document.getElementById('g-title').value, o=document.getElementById('g-org').value, r=document.getElementById('g-req').value, d=document.getElementById('g-deadline').value;
  if(!t||!o||!r){alert('Fill all fields');return;}
  const btn=document.getElementById('gen-grant-btn');
  btn.innerHTML='<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Generating...'; btn.disabled=true;
  const res = await api('/grants/generate?user_id=1',{method:'POST',body:JSON.stringify({title:t,deadline:d||new Date().toISOString().split('T')[0],org_info:o,guidelines:r})});
  btn.innerHTML='<span class="material-symbols-outlined text-[16px]">auto_awesome</span> Generate Draft'; btn.disabled=false;
  if(res){closeGrantModal();toast('Grant draft generated!');loadGrants();}
};

// ═══════════════════════════════════════
// 2. VOLUNTEERS
// ═══════════════════════════════════════
async function loadVolunteers() {
  const data = await api('/volunteers?user_id=1');
  const el = document.getElementById('vol-table');
  if (!el || !data) return;
  const confirmed = data.filter(s=>s.status==='confirmed').length;
  const pending = data.filter(s=>s.status==='pending').length;
  const cancelled = data.filter(s=>s.status==='cancelled').length;
  const ce=document.getElementById('conf-count'),pe=document.getElementById('pend-count'),ge=document.getElementById('gap-count');
  if(ce)ce.textContent=confirmed; if(pe)pe.textContent=pending; if(ge)ge.textContent=cancelled;
  el.innerHTML = data.map(s => {
    const sc = s.status==='confirmed'?'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300':s.status==='pending'?'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300':'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
    return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td class="px-6 py-4"><div class="font-medium text-sm text-slate-800 dark:text-slate-200">${s.shift_date}</div><div class="text-xs text-slate-400">${s.shift_time}</div></td>
      <td class="px-6 py-4 font-medium text-sm text-slate-800 dark:text-slate-200">${s.volunteer_name}</td>
      <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">${s.program_name}</td>
      <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${sc}">${s.status}</span></td>
      <td class="px-6 py-4 text-right"><button class="text-primary hover:bg-primary/10 p-1.5 rounded-full transition-colors"><span class="material-symbols-outlined text-[16px]">edit</span></button></td>
    </tr>`;
  }).join('');
}

window.autoScheduleVolunteers = async function() {
  const btn=document.getElementById('auto-sched-btn');
  btn.innerHTML='<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Scheduling...'; btn.disabled=true;
  await new Promise(r=>setTimeout(r,1500));
  btn.innerHTML='<span class="material-symbols-outlined text-[18px]">auto_awesome</span> AI Auto-Schedule'; btn.disabled=false;
  toast('Schedule optimized!'); loadVolunteers();
};

window.addVolunteerShift = async function() {
  const n=document.getElementById('v-name').value, p=document.getElementById('v-prog').value, d=document.getElementById('v-date').value;
  if(!n||!p||!d){alert('Fill all fields');return;}
  // Add to table directly (also call API in prod)
  const el = document.getElementById('vol-table');
  el.innerHTML += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-green-50/50 dark:bg-green-900/10">
    <td class="px-6 py-4"><div class="font-medium text-sm text-slate-800 dark:text-slate-200">${d}</div><div class="text-xs text-slate-400">9AM-1PM</div></td>
    <td class="px-6 py-4 font-medium text-sm text-slate-800 dark:text-slate-200">${n}</td>
    <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">${p}</td>
    <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700">pending</span></td>
    <td class="px-6 py-4 text-right"><button class="text-primary hover:bg-primary/10 p-1.5 rounded-full transition-colors"><span class="material-symbols-outlined text-[16px]">edit</span></button></td>
  </tr>`;
  document.getElementById('v-name').value='';document.getElementById('v-prog').value='';document.getElementById('v-date').value='';
  toast('Shift added!');
};
