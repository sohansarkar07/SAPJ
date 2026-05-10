// features2.js — Impact, Mentees, Projects, Flashcards
// Loaded after features.js

// ═══════════════════════════════════════
// 3. IMPACT REPORTS
// ═══════════════════════════════════════
async function loadImpact() {
  const data = await api('/impact');
  const el = document.getElementById('impact-list');
  if (!el) return;
  if (!data || !data.length) {
    el.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
      <span class="material-symbols-outlined text-5xl text-slate-300 mb-4">monitoring</span>
      <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">No reports yet</h3>
      <p class="text-sm text-slate-500">Click "Generate New" to synthesize an impact report from your indexed documents.</p>
    </div>`;
    return;
  }
  el.innerHTML = data.map(r => {
    let body = '';
    try {
      const c = JSON.parse(r.content);
      body = Object.entries(c).map(([k,v]) => `
        <div class="mb-5"><h4 class="text-xs font-bold uppercase tracking-wider text-primary mb-2">${k.replace(/_/g,' ')}</h4>
        <p class="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">${v}</p></div>`).join('');
    } catch(e) { body = '<p class="text-sm text-slate-400">No content</p>'; }
    return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <div><h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">Impact Report: ${r.period}</h3>
        <p class="text-xs text-slate-500 mt-1">Generated ${new Date(r.generated_at||Date.now()).toLocaleDateString()}</p></div>
        <button class="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <span class="material-symbols-outlined text-[16px]">download</span> Export
        </button>
      </div>
      <div class="p-8">${body}</div>
    </div>`;
  }).join('');
}

window.openImpactModal = function() { const m=document.getElementById('impact-modal'); m.classList.remove('hidden'); m.style.display='flex'; };

window.generateImpactReport = async function() {
  const period = document.getElementById('imp-period').value.split('(')[0].trim();
  const btn = document.getElementById('gen-impact-btn');
  btn.innerHTML='<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Generating...'; btn.disabled=true;
  document.getElementById('impact-modal').classList.add('hidden');
  document.getElementById('impact-modal').style.display='none';
  const el = document.getElementById('impact-list');
  el.innerHTML = `<div class="flex flex-col items-center justify-center py-20 gap-4">
    <span class="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
    <p class="text-sm text-slate-500 font-medium">Synthesizing data from your documents...</p>
  </div>`;
  const res = await api('/impact/generate',{method:'POST',body:JSON.stringify({period})});
  btn.innerHTML='<span class="material-symbols-outlined text-[16px]">auto_awesome</span> Generate'; btn.disabled=false;
  if(res){toast('Impact report generated!');loadImpact();}else{loadImpact();}
};

// ═══════════════════════════════════════
// 4. MENTEES
// ═══════════════════════════════════════
async function loadMentees() {
  const data = await api('/mentees');
  const el = document.getElementById('mentee-list');
  if (!el || !data) return;
  el.innerHTML = data.map((m,i) => `
    <div class="p-3 rounded-xl cursor-pointer border transition-all ${i===0?'border-primary bg-primary/5 dark:bg-primary/10':'border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'}" onclick="showMentee(${m.mentee_id},this)">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm">${m.name.charAt(0)}</div>
        <div class="min-w-0"><p class="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">${m.name}</p>
        <p class="text-xs text-slate-500 truncate">${m.current_goal}</p></div>
      </div>
    </div>`).join('');
  if(data.length) showMentee(data[0].mentee_id);
}

window.showMentee = async function(id, el) {
  // Highlight active
  document.querySelectorAll('#mentee-list > div').forEach(d => {
    d.className = d.className.replace(/border-primary bg-primary\/5 dark:bg-primary\/10/g, 'border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50');
  });
  if(el) el.className = el.className.replace(/border-slate-200.*hover:bg-slate-50 dark:hover:bg-slate-800\/50/g, 'border-primary bg-primary/5 dark:bg-primary/10');

  const det = document.getElementById('mentee-detail');
  det.innerHTML = `<div class="flex items-center justify-center h-full"><span class="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span></div>`;
  const data = await api(`/mentees/${id}/brief`);
  if(!data){det.innerHTML='<p class="p-8 text-slate-400">Failed to load</p>';return;}
  const m = data.mentee;
  const notes = data.recent_notes || [];
  det.innerHTML = `<div class="p-8 max-w-3xl mx-auto space-y-6">
    <div class="flex items-center gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
      <div class="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-2xl font-bold">${m.name.charAt(0)}</div>
      <div><h2 class="text-2xl font-bold text-slate-800 dark:text-slate-200">${m.name}</h2>
      <p class="text-slate-500 mt-1">🎯 ${m.current_goal}</p></div>
    </div>
    <div>
      <h3 class="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">auto_awesome</span> AI Session Brief</h3>
      <div class="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-6 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">${data.brief}</div>
    </div>
    <div>
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Past Sessions</h3>
      <div class="space-y-3">${notes.map(n => `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div class="text-[10px] font-bold text-slate-400 uppercase mb-2">${n.session_date}</div>
          <p class="text-sm text-slate-700 dark:text-slate-300 mb-3">${n.summary}</p>
          ${n.blockers?`<div class="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs p-2.5 rounded-lg"><strong>Blockers:</strong> ${n.blockers}</div>`:''}
          ${n.action_items_given?`<div class="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs p-2.5 rounded-lg mt-2"><strong>Action items:</strong> ${n.action_items_given}</div>`:''}
        </div>`).join('')}
      </div>
    </div>
  </div>`;
};

window.addMenteePrompt = function() { toast('Feature: Add mentee form (coming soon)'); };

// ═══════════════════════════════════════
// 5. PROJECTS
// ═══════════════════════════════════════
async function loadProjects() {
  const data = await api('/projects');
  const el = document.getElementById('project-grid');
  if (!el) return;
  if (!data || !data.length) { el.innerHTML = '<p class="text-slate-400 text-sm col-span-3 text-center py-12">No projects yet</p>'; return; }
  el.innerHTML = data.map(p => `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col hover:border-primary/50 transition-all cursor-pointer group shadow-sm hover:shadow-md">
      <div class="flex justify-between items-start mb-3">
        <h3 class="font-bold text-slate-800 dark:text-slate-200 text-lg">${p.name}</h3>
        <span class="text-[9px] font-bold uppercase px-2 py-1 rounded-full ${p.status==='active'?'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300':'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}">${p.status}</span>
      </div>
      <p class="text-xs text-slate-500 mb-3">Client: <span class="font-medium text-slate-700 dark:text-slate-300">${p.client_name}</span></p>
      <div class="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed relative overflow-hidden">
        ${p.brief_summary || '<span class="text-slate-400 italic">Click "Sync Comms" to generate AI brief</span>'}
        <div class="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-50 dark:from-slate-800/50 to-transparent"></div>
      </div>
      <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <span class="text-xs text-slate-400">Due: ${p.deadline||'—'}</span>
        <button onclick="event.stopPropagation();syncProject(${p.project_id})" class="text-primary text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 hover:underline">
          <span class="material-symbols-outlined text-[14px]">sync</span> Sync Comms
        </button>
      </div>
    </div>`).join('');
}

window.syncProject = async function(id) {
  toast('Syncing project communications...');
  const res = await api(`/projects/${id}/sync`);
  if(res) { toast('Project brief updated!'); loadProjects(); }
};

window.addProjectPrompt = function() { toast('Feature: Add project form (coming soon)'); };

// ═══════════════════════════════════════
// 6. FLASHCARDS
// ═══════════════════════════════════════
async function loadFlashcards() {
  const data = await api('/flashcards');
  const el = document.getElementById('fc-container');
  if (!el) return;
  if (!data || !data.length) {
    // Try all cards
    const all = await api('/flashcards/all');
    el.innerHTML = `<div class="text-center space-y-4">
      <span class="material-symbols-outlined text-6xl text-green-500">check_circle</span>
      <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-200">You're all caught up!</h2>
      <p class="text-slate-500">${all?.length ? all.length + ' cards in your decks. All reviewed!' : 'No flashcards yet.'}</p>
    </div>`;
    return;
  }
  const c = data[0];
  el.innerHTML = `
    <div class="w-full flex justify-between items-center px-2 text-sm">
      <span class="font-medium text-slate-500"><span class="material-symbols-outlined text-[16px] align-text-bottom">style</span> ${c.deck_name}</span>
      <span class="text-slate-400">${data.length} card${data.length>1?'s':''} due</span>
    </div>
    <div class="w-full h-[380px] perspective-1000 cursor-pointer" onclick="this.querySelector('.flipper').classList.toggle('rotate-y-180')">
      <div class="flipper relative w-full h-full transition-transform duration-500 transform-style-3d">
        <div class="absolute inset-0 backface-hidden bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-3xl shadow-lg flex flex-col items-center justify-center p-10 text-center">
          <span class="material-symbols-outlined text-primary text-4xl mb-6">help</span>
          <h2 class="text-xl font-bold text-slate-800 dark:text-slate-200 leading-relaxed">${c.question}</h2>
          <p class="absolute bottom-6 text-slate-400 text-xs font-medium">Click to reveal answer</p>
        </div>
        <div class="absolute inset-0 backface-hidden rotate-y-180 bg-primary text-white rounded-3xl shadow-lg flex flex-col items-center justify-center p-10 text-center">
          <span class="material-symbols-outlined text-white/50 text-4xl mb-6">lightbulb</span>
          <h2 class="text-xl font-bold leading-relaxed">${c.answer}</h2>
        </div>
      </div>
    </div>
    <div class="flex gap-3 w-full">
      <button onclick="reviewCard(${c.card_id},0)" class="flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-600 py-3 rounded-2xl font-bold text-sm transition-all">Again</button>
      <button onclick="reviewCard(${c.card_id},1)" class="flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-slate-700 dark:text-slate-300 hover:text-orange-600 py-3 rounded-2xl font-bold text-sm transition-all">Hard</button>
      <button onclick="reviewCard(${c.card_id},2)" class="flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-700 dark:text-slate-300 hover:text-green-600 py-3 rounded-2xl font-bold text-sm transition-all">Good</button>
      <button onclick="reviewCard(${c.card_id},3)" class="flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300 hover:text-blue-600 py-3 rounded-2xl font-bold text-sm transition-all">Easy</button>
    </div>`;
}

window.reviewCard = async function(id, q) {
  await api(`/flashcards/${id}/review?quality=${q}`, {method:'PUT'});
  loadFlashcards();
};
