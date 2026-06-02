/* ═══════════════════════════════════════════════════════════════
   Staff password gate — protects internal pages only.
   Client estimate page (index.html) stays public.
   Change the password by editing STAFF_PASSWORD below.
   Note: this is a front-end deterrent for the back-office UI, not
   data security. Protect customer data with Supabase RLS + real auth.
═══════════════════════════════════════════════════════════════ */
(function () {
  try {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var INTERNAL = ['dashboard.html', 'schedule.html', 'crew.html', 'login.html'];
    if (INTERNAL.indexOf(page) === -1) return;            // public pages: do nothing
    if (sessionStorage.getItem('dts_staff') === '1') return; // already unlocked this session

    var STAFF_PASSWORD = 'treecrew2026';
    var entry = window.prompt('Dynamic Tree Service — staff access\nEnter the crew password:');
    if (entry === STAFF_PASSWORD) {
      sessionStorage.setItem('dts_staff', '1');
    } else {
      document.documentElement.style.display = 'none';
      location.replace('/');
    }
  } catch (e) { /* fail open only on unexpected errors */ }
})();

/* ═══════════════════════════════════════════════════════════════
   TreeVision — Shared app bootstrap
   Loaded on every page after the Supabase UMD bundle.
═══════════════════════════════════════════════════════════════ */

/* Global CONFIG — referenced by client.html and dashboard.html inline scripts */
const CONFIG = {
  PROXY_URL:      "https://hydlxwjtdkzcnxxukakt.supabase.co/functions/v1/analyze",
  SAVE_URL:       "https://hydlxwjtdkzcnxxukakt.supabase.co/functions/v1/save-estimate",
  SUPABASE_URL:   "https://hydlxwjtdkzcnxxukakt.supabase.co",
  SUPABASE_KEY:   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZGx4d2p0ZGt6Y254eHVrYWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODcyNjQsImV4cCI6MjA5NTI2MzI2NH0.vXLOWjXh_6z8sSoBVqKA6wwwEKKMozjhRoIIUffwnzI",

  // ← Only needed if NOT using the Worker proxy (direct browser call — local testing only)
  ANTHROPIC_API_KEY: "",

  CALENDLY_URL: "https://calendly.com/YOUR_USERNAME/tree-service",
  COMPANY_NAME: "Dynamic Tree Service",
  PHONE: "(555) 000-0000",
  ISA_CERT: "",
  FOUNDED: "2010",
};

/* Legacy aliases used by the manager / dashboard inline script */
const SUPABASE_URL  = CONFIG.SUPABASE_URL;
const SUPABASE_ANON = CONFIG.SUPABASE_KEY;

/* Shared Supabase client. The Supabase UMD bundle is loaded before this file. */
let db = null;
if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
  db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
}

/* Highlight the nav link matching the current page */
function setActiveNav() {
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.site-nav a[data-nav]').forEach(a => {
    const target = (a.getAttribute('data-nav') || '').toLowerCase();
    if (target === path || (path === '' && target === 'index.html')) {
      a.classList.add('nav-active');
    } else {
      a.classList.remove('nav-active');
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setActiveNav);
  } else {
    setActiveNav();
  }
}
