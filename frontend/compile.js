const fs = require('fs');

const pages = {
  'landing': 'landing_orig.html',
  'dashboard': 'dashboard_orig.html',
  'search': 'search_orig.html',
  'sources': 'sources_orig.html',
  'grants': 'grant_orig.html',
  'settings': 'settings_orig.html'
};

// Extract body class and body innerHTML from each page
const pageData = {};
for (const [key, filename] of Object.entries(pages)) {
  const html = fs.readFileSync(filename, 'utf8');

  // Get body tag attributes
  const bodyMatch = html.match(/<body([^>]*)>/);
  const bodyAttrs = bodyMatch ? bodyMatch[1] : '';
  const classMatch = bodyAttrs.match(/class="([^"]+)"/);
  const bodyClass = classMatch ? classMatch[1] : '';

  // Get body inner content
  const bodyTagEnd = html.indexOf('>', html.indexOf('<body')) + 1;
  const bodyCloseStart = html.indexOf('</body>');
  const bodyContent = html.substring(bodyTagEnd, bodyCloseStart);

  // Extract inline <style> blocks from head
  const headStart = html.indexOf('<head>') + 6;
  const headEnd = html.indexOf('</head>');
  const headContent = html.substring(headStart, headEnd);
  const styleBlocks = [];
  const styleRegex = /<style>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = styleRegex.exec(headContent)) !== null) {
    styleBlocks.push(m[1]);
  }

  pageData[key] = { bodyClass, bodyContent, styleBlocks };
}

// Build app.js
let appJs = `// Second Brain AI — SPA (compiled from Stitch MCP originals)
// Auto-generated — do not edit manually

const PAGE_DATA = {};
`;

for (const [key, data] of Object.entries(pageData)) {
  const escaped = data.bodyContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  appJs += `\nPAGE_DATA['${key}'] = {
  bodyClass: \`${data.bodyClass}\`,
  styles: \`${data.styleBlocks.map(s => s.replace(/`/g, '\\`')).join('\n')}\`,
  html: \`${escaped}\`
};\n`;
}

appJs += `
let currentPage = 'landing';

// Dynamic style element for per-page styles
const dynamicStyle = document.createElement('style');
dynamicStyle.id = 'page-styles';
document.head.appendChild(dynamicStyle);

function navigate(page) {
  if (!PAGE_DATA[page]) page = 'landing';
  currentPage = page;
  const pd = PAGE_DATA[page];

  // Update body class for this page
  document.body.className = pd.bodyClass;

  // Update per-page styles
  dynamicStyle.textContent = pd.styles;

  // Set content
  document.body.innerHTML = pd.html;

  // Re-add the script tag so we keep reference (not strictly needed)
  window.scrollTo(0, 0);

// Attach navigation listeners
  attachNavListeners();
  
  // Re-attach theme toggle
  attachThemeToggle();
}

function attachThemeToggle() {
  let toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'theme-toggle-btn';
    toggleBtn.className = 'fixed bottom-6 right-6 z-50 p-3 rounded-full shadow-lg bg-surface-container-high border border-outline-variant text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center';
    toggleBtn.innerHTML = '<span class="material-symbols-outlined">light_mode</span>';
    
    toggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined">dark_mode</span>';
      } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined">light_mode</span>';
      }
    });
    
    document.body.appendChild(toggleBtn);
  }
  
  // Update icon based on current state
  const isDark = document.documentElement.classList.contains('dark');
  toggleBtn.innerHTML = isDark ? '<span class="material-symbols-outlined">light_mode</span>' : '<span class="material-symbols-outlined">dark_mode</span>';
}

function attachNavListeners() {
  // Sidebar nav items — match by text content
  const navMap = {
    'dashboard': 'dashboard',
    'home': 'dashboard',
    'brain map': 'dashboard',
    'smart search': 'search',
    'sources': 'sources',
    'grant writer': 'grants',
    'volunteer schedule': 'dashboard',
    'impact reports': 'dashboard',
    'flashcards': 'dashboard',
    'settings': 'settings',
    'synthesis': 'search',
  };

  const actionMap = {
    'get started free': 'dashboard',
    'start synthesizing': 'dashboard',
    'log in': 'dashboard',
    'features': null,
    'how it works': null,
    'who it\\'s for': null,
    'pricing': null,
  };

  document.querySelectorAll('a, button').forEach(el => {
    // Don't intercept hash links for in-page scroll on landing
    const href = el.getAttribute('href');
    if (currentPage === 'landing' && href && href.startsWith('#') && href.length > 1) {
      return; // let native scroll handle it
    }

    el.addEventListener('click', (e) => {
      const text = el.textContent.trim().toLowerCase();

      // Check nav map
      for (const [label, target] of Object.entries(navMap)) {
        if (text === label || text.includes(label)) {
          e.preventDefault();
          navigate(target);
          return;
        }
      }

      // Check action map
      for (const [label, target] of Object.entries(actionMap)) {
        if (text === label || text.includes(label)) {
          if (target) {
            e.preventDefault();
            navigate(target);
          }
          return;
        }
      }

      // Generic link — prevent default
      if (el.tagName === 'A' && (!href || href === '#')) {
        e.preventDefault();
      }
    });
  });
}

// Boot
// Init theme from local storage or OS preference
if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

document.addEventListener('DOMContentLoaded', () => {
  navigate('landing');
});
`;

fs.writeFileSync('app.js', appJs);
console.log('✅ Compiled app.js (' + (appJs.length / 1024).toFixed(1) + ' KB)');

// Build index.html — use landing's tailwind config (identical across pages)
const landingHtml = fs.readFileSync('landing_orig.html', 'utf8');
const headStart = landingHtml.indexOf('<head>');
const headEnd = landingHtml.indexOf('</head>') + 7;
let headContent = landingHtml.substring(headStart, headEnd);

// Add Inter 700 weight (landing needs it)
headContent = headContent.replace(
  'Inter:wght@400;500;600;700',
  'Inter:wght@400;500;600;700'
);

// Update title
headContent = headContent.replace(
  '<title>Second Brain - Knowledge Synthesizer</title>',
  '<title>Second Brain — Knowledge Synthesizer</title>'
);

const indexHtml = `<!DOCTYPE html>
<html class="scroll-smooth" lang="en">
${headContent}
<body>
  <script src="app.js"><\/script>
</body>
</html>
`;

fs.writeFileSync('index.html', indexHtml);
console.log('✅ Compiled index.html');
