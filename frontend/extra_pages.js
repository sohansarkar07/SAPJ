// extra_pages.js  — registers NEW pages into PAGE_DATA (app.js already loaded)
// Runs after app.js so PAGE_DATA is guaranteed to exist.

// ─────────────────────────────────────────────
// SHARED SIDEBAR builder
// ─────────────────────────────────────────────
function buildSidebar(active) {
  const links = [
    { id:'dashboard', icon:'home',          label:'Home' },
    { id:'search',    icon:'search',         label:'Smart Search' },
    { id:'sources',   icon:'database',       label:'Sources' },
    { id:'grants',    icon:'edit_document',  label:'Grant Writer',         badge:'NEW' },
    { id:'volunteer', icon:'calendar_month', label:'Volunteer Schedule',   badge:'NEW' },
    { id:'impact',    icon:'monitoring',     label:'Impact Reports',       badge:'NEW' },
    { id:'mentees',   icon:'groups',         label:'Mentee Dashboard',     badge:'NEW' },
    { id:'projects',  icon:'cases',          label:'Project Briefs',       badge:'NEW' },
    { id:'flashcards',icon:'style',          label:'Flashcards' },
    { id:'settings',  icon:'settings',       label:'Settings' },
  ];

  const navHtml = links.map(l => {
    const isActive = l.id === active;
    const ac = isActive
      ? "bg-white dark:bg-slate-800 border-[#5645d4] text-[#5645d4] font-semibold"
      : "text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50";
    const badge = l.badge ? `<span class="text-[9px] font-bold bg-primary-container text-on-primary-container px-1.5 py-0.5 rounded-full">${l.badge}</span>` : '';
    return `<a class="flex items-center justify-between px-4 py-2 border-l-[3px] transition-all text-sm font-['Inter'] ${ac}" href="#" data-nav="${l.id}">
      <span class="flex items-center gap-3"><span class="material-symbols-outlined text-[20px]">${l.icon}</span>${l.label}</span>${badge}
    </a>`;
  }).join('');

  return `<nav class="hidden md:flex flex-col bg-[#fafaf9] dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 fixed left-0 top-0 h-screen w-[240px] z-40 overflow-y-auto custom-scrollbar">
    <div class="px-6 py-6 mb-2 cursor-pointer" onclick="navigate('landing')">
      <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">⚡ Second Brain</h1>
      <p class="text-xs text-slate-500 mt-0.5">Knowledge Synthesizer</p>
    </div>
    <div class="flex-1 flex flex-col gap-0.5 pb-4">${navHtml}</div>
    <div class="px-4 py-4 border-t border-slate-200 dark:border-slate-800">
      <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
        <div class="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center font-bold text-sm text-on-primary-container">PS</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">Priya Sharma</p>
          <p class="text-xs text-slate-500">NGO Pro</p>
        </div>
        <button id="theme-toggle-btn-sb" onclick="toggleDarkMode()" class="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
          <span class="material-symbols-outlined text-[18px]">dark_mode</span>
        </button>
      </div>
    </div>
  </nav>`;
}

function hdr(crumb1, crumb2) {
  return `<header class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 py-3 flex items-center justify-between">
    <nav class="flex items-center gap-2 text-sm text-slate-500">
      <span class="font-medium">${crumb1}</span>
      <span class="material-symbols-outlined text-sm">chevron_right</span>
      <span class="font-semibold text-slate-800 dark:text-slate-200">${crumb2}</span>
    </nav>
    <div class="flex items-center gap-3">
      <button onclick="toggleDarkMode()" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
        <span class="material-symbols-outlined text-[18px]">dark_mode</span>
      </button>
      <div class="w-2 h-2 rounded-full bg-green-500 ring-2 ring-green-200"></div>
      <span class="text-xs text-slate-500 font-medium">Live</span>
    </div>
  </header>`;
}

// ─────────────────────────────────────────────
// 1. GRANT WRITER
// ─────────────────────────────────────────────
PAGE_DATA['grants'] = {
  bodyClass: 'bg-background text-on-background font-body text-body min-h-screen flex',
  styles: '',
  html: `
    ${buildSidebar('grants')}
    <main class="flex-1 md:ml-[240px] flex flex-col h-screen">
      ${hdr('NGO Tools', 'Grant Writer')}
      <div class="flex flex-1 overflow-hidden">

        <!-- Left: Grant list -->
        <aside class="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span class="font-semibold text-on-surface text-sm">Your Grants</span>
            <button onclick="openNewGrantModal()" class="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">add</span> New
            </button>
          </div>
          <div class="flex-1 overflow-y-auto custom-scrollbar p-2" id="grant-list">
            <div class="shimmer h-16 rounded-xl mb-2"></div>
            <div class="shimmer h-16 rounded-xl mb-2"></div>
            <div class="shimmer h-16 rounded-xl"></div>
          </div>
        </aside>

        <!-- Right: Editor -->
        <div class="flex-1 bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden" id="grant-editor-container">
          <div class="flex-1 flex items-center justify-center flex-col gap-4 text-slate-400">
            <span class="material-symbols-outlined text-7xl text-slate-300">edit_document</span>
            <p class="text-sm">Select a grant to edit or create a new one</p>
          </div>
        </div>
      </div>
    </main>

    <!-- New Grant Modal -->
    <div id="grant-modal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 hidden items-center justify-center">
      <div class="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 class="text-lg font-bold text-on-surface flex items-center gap-2"><span class="material-symbols-outlined text-primary">auto_awesome</span> Generate Grant Draft</h2>
          <button onclick="closeGrantModal()" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><span class="material-symbols-outlined text-slate-500">close</span></button>
        </div>
        <div class="p-6 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Grant / Funder Name</label>
            <input id="g-title" class="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:border-primary text-on-surface" placeholder="e.g. CSIR Science & Society Programme 2026">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Submission Deadline</label>
            <input type="date" id="g-deadline" class="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:border-primary text-on-surface">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Your Organisation Context</label>
            <textarea id="g-org" rows="3" class="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:border-primary text-on-surface resize-none" placeholder="GreenHope Foundation is a registered non-profit working on digital literacy and clean water access in West Bengal..."></textarea>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Grant Requirements / Guidelines</label>
            <textarea id="g-req" rows="4" class="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:border-primary text-on-surface resize-none" placeholder="Paste the funder's guidelines here. What sections do they require? Budget range? Eligible activities?"></textarea>
          </div>
        </div>
        <div class="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button onclick="closeGrantModal()" class="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
          <button id="gen-grant-btn" onclick="generateGrantDraft()" class="px-6 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">auto_awesome</span> Generate Draft
          </button>
        </div>
      </div>
    </div>
  `
};

// ─────────────────────────────────────────────
// 2. VOLUNTEER SCHEDULE
// ─────────────────────────────────────────────
PAGE_DATA['volunteer'] = {
  bodyClass: 'bg-background text-on-background font-body text-body min-h-screen flex',
  styles: '',
  html: `
    ${buildSidebar('volunteer')}
    <main class="flex-1 md:ml-[240px] flex flex-col min-h-screen">
      ${hdr('NGO Tools', 'Volunteer Schedule')}
      <div class="flex-1 p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto custom-scrollbar">
        <div class="max-w-5xl mx-auto space-y-6">

          <!-- Stats row -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-3xl font-bold text-primary" id="vol-count">48</div>
              <div class="text-xs text-slate-500 mt-1 font-medium">Active Volunteers</div>
            </div>
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-3xl font-bold text-green-600" id="conf-count">3</div>
              <div class="text-xs text-slate-500 mt-1 font-medium">Shifts Confirmed</div>
            </div>
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-3xl font-bold text-yellow-600" id="pend-count">1</div>
              <div class="text-xs text-slate-500 mt-1 font-medium">Pending Confirm</div>
            </div>
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-3xl font-bold text-red-500" id="gap-count">2</div>
              <div class="text-xs text-slate-500 mt-1 font-medium">Gaps / Dropouts</div>
            </div>
          </div>

          <!-- Toolbar -->
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-bold text-on-surface">Upcoming Shifts</h2>
            <button onclick="autoScheduleVolunteers()" id="auto-sched-btn" class="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              <span class="material-symbols-outlined text-[18px]">auto_awesome</span> AI Auto-Schedule
            </button>
          </div>

          <!-- Schedule table -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table class="w-full text-left">
              <thead class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th class="px-6 py-4">Date & Time</th>
                  <th class="px-6 py-4">Volunteer</th>
                  <th class="px-6 py-4">Program</th>
                  <th class="px-6 py-4">Status</th>
                  <th class="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody id="vol-table" class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr><td colspan="5" class="px-6 py-8 text-center text-slate-400 text-sm">Loading schedule...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Add volunteer form -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 class="font-semibold text-on-surface mb-4">Add Volunteer Shift Manually</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input id="v-name" class="border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-on-surface focus:outline-none focus:border-primary" placeholder="Volunteer name">
              <input id="v-prog" class="border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-on-surface focus:outline-none focus:border-primary" placeholder="Program name">
              <input type="date" id="v-date" class="border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-on-surface focus:outline-none focus:border-primary">
              <button onclick="addVolunteerShift()" class="bg-surface-container-low border border-slate-300 dark:border-slate-700 text-on-surface text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-surface-container transition-colors flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[16px]">add</span> Add Shift
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  `
};

// ─────────────────────────────────────────────
// 3. IMPACT REPORTS
// ─────────────────────────────────────────────
PAGE_DATA['impact'] = {
  bodyClass: 'bg-background text-on-background font-body text-body min-h-screen flex',
  styles: '',
  html: `
    ${buildSidebar('impact')}
    <main class="flex-1 md:ml-[240px] flex flex-col min-h-screen">
      ${hdr('NGO Tools', 'Impact Reports')}
      <div class="flex-1 p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto custom-scrollbar">
        <div class="max-w-4xl mx-auto space-y-6">

          <!-- Generate toolbar -->
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-xl font-bold text-on-surface">Donor Reports</h2>
              <p class="text-sm text-slate-500 mt-0.5">AI synthesizes your data into polished, donor-ready reports</p>
            </div>
            <button onclick="openImpactModal()" class="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              <span class="material-symbols-outlined text-[18px]">add</span> Generate New
            </button>
          </div>

          <!-- Report list -->
          <div id="impact-list" class="space-y-4">
            <div class="shimmer h-48 rounded-2xl"></div>
          </div>
        </div>
      </div>
    </main>

    <!-- Generate Report Modal -->
    <div id="impact-modal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 hidden items-center justify-center">
      <div class="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 class="text-lg font-bold text-on-surface">Generate Impact Report</h2>
          <button onclick="document.getElementById('impact-modal').classList.add('hidden')" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><span class="material-symbols-outlined text-slate-500">close</span></button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Report Period</label>
            <select id="imp-period" class="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:border-primary text-on-surface">
              <option>Q1 2026 (Jan – Mar)</option>
              <option>Q2 2026 (Apr – Jun)</option>
              <option selected>Q3 2026 (Jul – Sep)</option>
              <option>Q4 2026 (Oct – Dec)</option>
              <option>Annual Report 2026</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Data Sources to Include</label>
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm text-on-surface cursor-pointer"><input type="checkbox" checked class="rounded"> Programme activity data (emails + drive)</label>
              <label class="flex items-center gap-2 text-sm text-on-surface cursor-pointer"><input type="checkbox" checked class="rounded"> Financial reports (PDFs)</label>
              <label class="flex items-center gap-2 text-sm text-on-surface cursor-pointer"><input type="checkbox" checked class="rounded"> Volunteer hours (schedule data)</label>
              <label class="flex items-center gap-2 text-sm text-on-surface cursor-pointer"><input type="checkbox" class="rounded"> Field survey responses</label>
            </div>
          </div>
        </div>
        <div class="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button onclick="document.getElementById('impact-modal').classList.add('hidden')" class="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
          <button id="gen-impact-btn" onclick="generateImpactReport()" class="px-6 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">auto_awesome</span> Generate
          </button>
        </div>
      </div>
    </div>
  `
};

// ─────────────────────────────────────────────
// 4. MENTEE DASHBOARD
// ─────────────────────────────────────────────
PAGE_DATA['mentees'] = {
  bodyClass: 'bg-background text-on-background font-body text-body min-h-screen flex',
  styles: '',
  html: `
    ${buildSidebar('mentees')}
    <main class="flex-1 md:ml-[240px] flex flex-col h-screen">
      ${hdr('The Ascent Circle', 'Mentee Dashboard')}
      <div class="flex flex-1 overflow-hidden">

        <!-- Left: Mentee list -->
        <aside class="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span class="font-semibold text-on-surface text-sm">Your Mentees (3)</span>
            <button onclick="addMenteePrompt()" class="text-primary hover:bg-primary/5 p-1.5 rounded-lg transition-colors">
              <span class="material-symbols-outlined text-[18px]">person_add</span>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2" id="mentee-list">
            <div class="shimmer h-20 rounded-xl"></div>
            <div class="shimmer h-20 rounded-xl"></div>
          </div>
        </aside>

        <!-- Right: AI Brief -->
        <div class="flex-1 bg-slate-50 dark:bg-slate-950 overflow-y-auto custom-scrollbar" id="mentee-detail">
          <div class="flex items-center justify-center h-full flex-col gap-4 text-slate-400">
            <span class="material-symbols-outlined text-6xl text-slate-300">groups</span>
            <p class="text-sm">Select a mentee to view their AI Brief</p>
          </div>
        </div>
      </div>
    </main>
  `
};

// ─────────────────────────────────────────────
// 5. PROJECT BRIEFS (Agency)
// ─────────────────────────────────────────────
PAGE_DATA['projects'] = {
  bodyClass: 'bg-background text-on-background font-body text-body min-h-screen flex',
  styles: '',
  html: `
    ${buildSidebar('projects')}
    <main class="flex-1 md:ml-[240px] flex flex-col min-h-screen">
      ${hdr('Webcraftzs Agency', 'Project Briefs')}
      <div class="flex-1 p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto custom-scrollbar">
        <div class="max-w-6xl mx-auto space-y-6">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-xl font-bold text-on-surface">Active Projects</h2>
              <p class="text-sm text-slate-500 mt-0.5">AI synthesises all client emails into one living brief per project</p>
            </div>
            <button onclick="addProjectPrompt()" class="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              <span class="material-symbols-outlined text-[18px]">add</span> New Project
            </button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" id="project-grid">
            <div class="shimmer h-56 rounded-2xl"></div>
            <div class="shimmer h-56 rounded-2xl"></div>
          </div>
        </div>
      </div>
    </main>
  `
};

// ─────────────────────────────────────────────
// 6. FLASHCARDS (Spaced Repetition)
// ─────────────────────────────────────────────
PAGE_DATA['flashcards'] = {
  bodyClass: 'bg-background text-on-background font-body text-body min-h-screen flex',
  styles: '',
  html: `
    ${buildSidebar('flashcards')}
    <main class="flex-1 md:ml-[240px] flex flex-col h-screen">
      ${hdr('Study', 'Flashcards')}
      <div class="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 overflow-y-auto">
        <div class="w-full max-w-2xl flex flex-col items-center gap-8" id="fc-container">
          <div class="shimmer h-80 w-full rounded-3xl"></div>
        </div>
      </div>
    </main>
  `
};
