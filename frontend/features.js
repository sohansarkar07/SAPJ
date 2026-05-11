// features.js — Wires interactive functionality to the backend API (config-driven, no hardcoded user IDs)

function resolveApiBase() {
  const m = document.querySelector('meta[name="second-brain-api"]');
  const meta = m && m.getAttribute('content');
  if (meta && meta.trim()) return meta.trim().replace(/\/$/, '');
  if (typeof window.SECOND_BRAIN_API_BASE === 'string' && window.SECOND_BRAIN_API_BASE.trim()) {
    return window.SECOND_BRAIN_API_BASE.trim().replace(/\/$/, '');
  }
  return '';
}

const API_ROOT = resolveApiBase();
const API = API_ROOT ? `${API_ROOT}/api` : '/api';

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let sbSession = null;
let sbSessionPromise = null;

async function fetchSession() {
  if (window.SecondBrainAPI) {
    const { data, error } = await window.SecondBrainAPI.get('/api/session');
    if (error) throw new Error(`Session error: ${error}`);
    return data;
  }
  const r = await fetch(`${API}/session`, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`Session ${r.status}`);
  return r.json();
}

async function ensureSession() {
  if (sbSession) return sbSession;
  if (!sbSessionPromise) {
    sbSessionPromise = fetchSession().then((s) => {
      sbSession = s;
      return s;
    });
  }
  return sbSessionPromise;
}

function updateSidebarFromSession() {
  if (!sbSession) return;
  const n = document.getElementById('sb-user-name');
  const rEl = document.getElementById('sb-user-role');
  const a = document.getElementById('sb-user-avatar');
  if (n) n.textContent = sbSession.name || 'User';
  if (rEl) {
    const role = (sbSession.role || '').trim();
    rEl.textContent = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member';
  }
  if (a) {
    const parts = (sbSession.name || '?').trim().split(/\s+/).filter(Boolean);
    const ini = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2);
    a.textContent = ini.toUpperCase();
  }
}

// ── Utility ──
function toggleDarkMode() {
  const d = document.documentElement.classList.toggle('dark');
  localStorage.theme = d ? 'dark' : 'light';
}
window.toggleDarkMode = toggleDarkMode;

async function api(path, opts = {}) {
  try {
    if (window.SecondBrainAPI) {
      // features.js paths don't include /api, so we must prepend it
      const fullPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
      const { data, error } = await window.SecondBrainAPI.request(fullPath, opts);
      if (error) {
        console.warn('API err:', error);
        return null;
      }
      return data || true;
    }

    const r = await fetch(API + path, {
      ...opts,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...opts.headers },
    });
    if (r.status === 204) return true;
    const text = await r.text();
    if (!r.ok) {
      console.warn('API err:', r.status, text);
      return null;
    }
    if (!text) return true;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (e) {
    console.warn('API err:', e);
    return null;
  }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'fixed bottom-6 right-6 z-[999] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 animate-[slideUp_0.3s_ease]';
  t.innerHTML = `<span class="material-symbols-outlined text-green-400 text-[18px]">check_circle</span> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Page Load Router ──
window.onPageLoad = function (page) {
  void (async () => {
    try {
      await ensureSession();
      updateSidebarFromSession();
    } catch (e) {
      console.warn('Session:', e);
    }
    const loaders = {
      sources: loadSources,
      grants: loadGrants,
      volunteer: loadVolunteers,
      impact: loadImpact,
      mentees: loadMentees,
      projects: loadProjects,
      flashcards: loadFlashcards,
      search: loadSearch,
      dashboard: loadDashboard,
    };
    const fn = loaders[page];
    if (fn) await fn();
  })();
};

// ═══════════════════════════════════════
// 1. GRANTS
// ═══════════════════════════════════════
async function loadGrants() {
  const data = await api('/grants');
  const el = document.getElementById('grant-list');
  if (!el || !data) return;
  if (!data.length) {
    el.innerHTML = '<p class="p-4 text-sm text-slate-400 text-center">No grants yet</p>';
    return;
  }
  el.innerHTML = data
    .map(
      (g) => `
    <div class="p-3 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all" onclick="showGrant(${g.grant_id})">
      <div class="flex justify-between items-start mb-1">
        <span class="font-semibold text-sm text-slate-800 dark:text-slate-200 line-clamp-1">${escHtml(g.title)}</span>
        <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm shrink-0 ml-2 ${g.status === 'submitted' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}">${g.status}</span>
      </div>
      <span class="text-xs text-slate-400">Due: ${g.deadline || '—'}</span>
    </div>`
    )
    .join('');
  showGrant(data[0].grant_id);
}

window.showGrant = async function (id) {
  const data = await api('/grants');
  const g = data?.find((x) => Number(x.grant_id) === Number(id));
  const el = document.getElementById('grant-editor-container');
  if (!el || !g) return;
  let sections = '';
  try {
    const c = JSON.parse(g.draft_content || '{}');
    sections = Object.entries(c)
      .map(
        ([k, v]) => `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-bold text-slate-800 dark:text-slate-200 capitalize">${escHtml(k.replace(/_/g, ' '))}</h3>
          <span class="material-symbols-outlined text-slate-400 text-[16px] hover:text-primary cursor-pointer" title="Regenerate">refresh</span>
        </div>
        <textarea class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 min-h-[100px] focus:outline-none focus:border-primary resize-y leading-relaxed">${escHtml(v)}</textarea>
      </div>`
      )
      .join('');
  } catch (e) {
    sections = '<p class="p-6 text-slate-400 text-center">No draft content</p>';
  }
  el.innerHTML = `
    <div class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex justify-between items-center">
      <div><h2 class="text-xl font-bold text-slate-800 dark:text-slate-200">${escHtml(g.title)}</h2>
      <p class="text-sm text-slate-500 mt-1">${String(g.status).toUpperCase()} · Due ${g.deadline}</p></div>
      <button class="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90">Export PDF</button>
    </div>
    <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">${sections}</div>`;
};

window.openNewGrantModal = function () {
  const m = document.getElementById('grant-modal');
  m.classList.remove('hidden');
  m.style.display = 'flex';
};
window.closeGrantModal = function () {
  const m = document.getElementById('grant-modal');
  m.classList.add('hidden');
  m.style.display = 'none';
};

window.generateGrantDraft = async function () {
  const t = document.getElementById('g-title').value,
    o = document.getElementById('g-org').value,
    r = document.getElementById('g-req').value,
    d = document.getElementById('g-deadline').value;
  if (!t || !o || !r) {
    alert('Fill all fields');
    return;
  }
  const btn = document.getElementById('gen-grant-btn');
  btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Generating...';
  btn.disabled = true;
  const res = await api('/grants/generate', {
    method: 'POST',
    body: JSON.stringify({
      title: t,
      deadline: d || new Date().toISOString().split('T')[0],
      org_info: o,
      guidelines: r,
    }),
  });
  btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">auto_awesome</span> Generate Draft';
  btn.disabled = false;
  if (res) {
    closeGrantModal();
    toast('Grant draft generated!');
    loadGrants();
  }
};

// ═══════════════════════════════════════
// 2. VOLUNTEERS
// ═══════════════════════════════════════
async function loadVolunteers() {
  const data = await api('/volunteers');
  const el = document.getElementById('vol-table');
  if (!el) return;
  if (!data || !data.length) {
    el.innerHTML =
      '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400 text-sm">No shifts scheduled yet</td></tr>';
    const ce = document.getElementById('conf-count'),
      pe = document.getElementById('pend-count'),
      ge = document.getElementById('gap-count'),
      ve = document.getElementById('vol-count');
    if (ce) ce.textContent = '0';
    if (pe) pe.textContent = '0';
    if (ge) ge.textContent = '0';
    if (ve) ve.textContent = '0';
    return;
  }
  const confirmed = data.filter((s) => s.status === 'confirmed').length;
  const pending = data.filter((s) => s.status === 'pending').length;
  const cancelled = data.filter((s) => s.status === 'cancelled').length;
  const uniqueVolunteers = new Set(data.map((s) => s.volunteer_name)).size;
  const ce = document.getElementById('conf-count'),
    pe = document.getElementById('pend-count'),
    ge = document.getElementById('gap-count'),
    ve = document.getElementById('vol-count');
  if (ce) ce.textContent = confirmed;
  if (pe) pe.textContent = pending;
  if (ge) ge.textContent = cancelled;
  if (ve) ve.textContent = String(uniqueVolunteers);

  el.innerHTML = data
    .map((s) => {
      const sc =
        s.status === 'confirmed'
          ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
          : s.status === 'pending'
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
      return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-schedule-id="${s.schedule_id}">
      <td class="px-6 py-4"><div class="font-medium text-sm text-slate-800 dark:text-slate-200">${s.shift_date}</div><div class="text-xs text-slate-400">${s.shift_time}</div></td>
      <td class="px-6 py-4 font-medium text-sm text-slate-800 dark:text-slate-200">${s.volunteer_name}</td>
      <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">${s.program_name}</td>
      <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${sc}">${s.status}</span></td>
      <td class="px-6 py-4 text-right">
        <button class="text-primary hover:bg-primary/10 p-1.5 rounded-full transition-colors"><span class="material-symbols-outlined text-[16px]">edit</span></button>
        <button class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-full transition-colors ml-1" onclick="deleteVolunteerShift(${s.schedule_id}, this)" title="Delete"><span class="material-symbols-outlined text-[16px]">delete</span></button>
      </td>
    </tr>`;
    })
    .join('');
}

window.deleteVolunteerShift = async function (scheduleId, btn) {
  const row = btn && btn.closest ? btn.closest('tr') : null;
  const res = await api(`/volunteers/${scheduleId}`, { method: 'DELETE' });
  if (res) {
    if (row) row.remove();
    toast('Shift removed');
    loadVolunteers();
  } else toast('Could not remove shift');
};

window.autoScheduleVolunteers = async function () {
  const btn = document.getElementById('auto-sched-btn');
  btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Scheduling...';
  btn.disabled = true;
  const res = await api('/volunteers/schedule', {
    method: 'POST',
    body: JSON.stringify({ availability_data: '', programs: '' }),
  });
  btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">auto_awesome</span> AI Auto-Schedule';
  btn.disabled = false;
  if (res) {
    toast('New shifts generated from AI');
    loadVolunteers();
  } else toast('Scheduling failed — check API and GROQ_API_KEY');
};

window.addVolunteerShift = async function () {
  const n = document.getElementById('v-name').value,
    p = document.getElementById('v-prog').value,
    d = document.getElementById('v-date').value;
  if (!n || !p || !d) {
    alert('Fill all fields');
    return;
  }
  const res = await api('/volunteers', {
    method: 'POST',
    body: JSON.stringify({
      volunteer_name: n,
      program_name: p,
      shift_date: d,
      shift_time: '9AM-1PM',
      status: 'pending',
    }),
  });
  if (res) {
    document.getElementById('v-name').value = '';
    document.getElementById('v-prog').value = '';
    document.getElementById('v-date').value = '';
    toast('Shift added');
    loadVolunteers();
  } else toast('Could not add shift');
};

// ═══════════════════════════════════════
// 3. SOURCES / INTEGRATIONS
// ═══════════════════════════════════════
function relTime(iso) {
  if (!iso) return 'Never synced';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Unknown';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min > 1 ? 's' : ''} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr > 1 ? 's' : ''} ago`;
  const d = Math.floor(hr / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

function sourceCard(title, icon, source, actions = '') {
  const status = source?.connection_status || 'paused';
  const account = source?.provider_account || source?.name || 'Not connected';
  const synced = source?.last_synced_at ? `Last sync: ${relTime(source.last_synced_at)}` : source?.last_error || 'Not synced yet';
  const badgeCls = status === 'connected' ? 'bg-green-100 text-green-800' : status === 'syncing' ? 'bg-blue-100 text-blue-800' : status === 'error' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800';
  const badgeTxt = status.charAt(0).toUpperCase() + status.slice(1);
  return `<div class="bg-surface-container-lowest border border-outline-variant/50 rounded-DEFAULT p-md flex flex-col justify-between hover:border-primary-container/50 transition-colors group min-h-[170px]">
    <div class="flex justify-between items-start gap-2">
      <div class="w-[40px] h-[40px] rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
        <span class="material-symbols-outlined">${icon}</span>
      </div>
      <span class="${badgeCls} text-[10px] font-bold px-2 py-1 rounded-full">${escHtml(badgeTxt)}</span>
    </div>
    <div>
      <h3 class="font-h3 text-[16px] font-semibold text-on-surface">${escHtml(title)}</h3>
      <p class="text-[12px] text-on-surface-variant mt-1">${escHtml(synced)}</p>
      <p class="text-[12px] text-outline mt-xs truncate">${escHtml(account)}</p>
    </div>
    <div class="pt-2">${actions}</div>
  </div>`;
}

async function loadSources() {
  const wrap = document.querySelector('main div.flex-1.p-xl.overflow-y-auto');
  if (!wrap) return;
  const documents = await api('/documents') || [];

  // Update Local Documents card
  const h3s = Array.from(wrap.querySelectorAll('h3'));
  const pdfTitle = h3s.find(h => h.textContent.trim() === 'Local Documents');
  if (pdfTitle) {
    const card = pdfTitle.closest('div.bg-surface-container-lowest');
    if (card) {
      const det = card.querySelector('div:last-child');
      const pdfCount = documents.filter(d => d.doc_type === 'pdf').length;
      if (det) det.innerHTML = `<h3 class="font-h3 text-[16px] font-semibold text-on-surface">Local Documents</h3><p class="text-[12px] text-on-surface-variant mt-1">${pdfCount} document${pdfCount !== 1 ? 's' : ''} uploaded</p><p class="text-[12px] text-outline mt-xs truncate">${pdfCount ? 'AI-processed & searchable' : 'Upload PDFs to get started'}</p>`;
      const badge = card.querySelector('span[class*="rounded-full"]');
      if (badge && pdfCount > 0) { badge.className = 'bg-green-100 text-green-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1'; badge.innerHTML = '<span class="w-[6px] h-[6px] rounded-full bg-green-500 block"></span>Connected'; }
    }
  }

  // Remove old dynamic sections
  document.getElementById('pdf-upload-section')?.remove();
  document.getElementById('documents-section')?.remove();

  // Upload Zone
  const upSec = document.createElement('section');
  upSec.id = 'pdf-upload-section';
  upSec.className = 'mb-section';
  upSec.innerHTML = `<h3 class="font-h3 text-h3 text-on-surface mb-md flex items-center gap-2"><span class="material-symbols-outlined text-primary">upload_file</span> Upload Documents</h3>
    <div id="pdf-dropzone" class="bg-surface-container-lowest border-2 border-dashed border-outline-variant/60 rounded-xl p-8 text-center hover:border-primary/50 transition-all cursor-pointer group relative">
      <input type="file" id="pdf-file-input" accept=".pdf" multiple class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
      <div class="flex flex-col items-center gap-3">
        <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors"><span class="material-symbols-outlined text-primary text-3xl">cloud_upload</span></div>
        <div><p class="font-semibold text-on-surface text-base">Drop PDF files here or click to browse</p><p class="text-sm text-on-surface-variant mt-1">AI will automatically summarize and extract key information</p></div>
      </div>
    </div>
    <div id="upload-progress" class="hidden mt-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-4">
      <div class="flex items-center gap-3"><span class="material-symbols-outlined text-primary animate-spin">progress_activity</span>
        <div class="flex-1"><p id="upload-filename" class="text-sm font-medium text-on-surface">Uploading...</p><div class="w-full bg-surface-variant rounded-full h-2 mt-2"><div id="upload-bar" class="bg-primary h-2 rounded-full transition-all duration-300" style="width:0%"></div></div></div>
        <span id="upload-pct" class="text-xs text-outline font-mono">0%</span>
      </div>
    </div>`;

  // Documents List
  const docSec = document.createElement('section');
  docSec.id = 'documents-section';
  docSec.className = 'mb-section';
  docSec.innerHTML = `<div class="flex justify-between items-center mb-md"><h3 class="font-h3 text-h3 text-on-surface flex items-center gap-2"><span class="material-symbols-outlined text-primary">description</span> Your Documents <span class="text-sm font-normal text-on-surface-variant">(${documents.length})</span></h3></div>
    <div class="grid grid-cols-1 gap-3" id="documents-grid">${documents.length ? documents.map(d => _docCard(d)).join('') : '<div class="bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-8 text-center"><span class="material-symbols-outlined text-outline text-4xl mb-3 block">folder_open</span><p class="text-on-surface-variant">No documents yet. Upload a PDF above to get started.</p></div>'}</div>`;

  const firstSec = wrap.querySelector('section');
  if (firstSec && firstSec.nextSibling) { wrap.insertBefore(upSec, firstSec.nextSibling); wrap.insertBefore(docSec, upSec.nextSibling); }
  else { wrap.appendChild(upSec); wrap.appendChild(docSec); }

  // Wire file input
  const fi = document.getElementById('pdf-file-input');
  if (fi) fi.addEventListener('change', async (e) => { for (const f of Array.from(e.target.files)) await _uploadPdf(f); fi.value = ''; });

  // Wire drag-drop
  const dz = document.getElementById('pdf-dropzone');
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('border-primary', 'bg-primary/5'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('border-primary', 'bg-primary/5'));
    dz.addEventListener('drop', async (e) => { e.preventDefault(); dz.classList.remove('border-primary', 'bg-primary/5'); const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'); if (!files.length) { toast('Please drop PDF files only'); return; } for (const f of files) await _uploadPdf(f); });
  }
}

function _docCard(d) {
  let ai = []; try { ai = JSON.parse(d.action_items_json || '[]'); } catch(e) {}
  return `<div class="bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-4 flex gap-4 shadow-sm hover:border-primary/50 transition-colors group">
    <div class="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 shrink-0 mt-1"><span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">picture_as_pdf</span></div>
    <div class="flex-1 min-w-0">
          <p>${formattedHtml}</p>
        </div>
      </div>
    `;
  }
}
