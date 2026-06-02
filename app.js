/* ═══════════════════════════════════════════════════════════════
TreeVision — Shared app bootstrap
Loaded on every page after the Supabase UMD bundle.
═══════════════════════════════════════════════════════════════ */

/* Global CONFIG — referenced by index.html and dashboard.html inline scripts */
const CONFIG = {
  // ── Supabase project ──────────────────────────────────────────
  SUPABASE_URL:  "https://hydlxwjtdkzcnxxukakt.supabase.co",
  SUPABASE_KEY:  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZGx4d2p0ZGt6Y254eHVrYWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODcyNjQsImV4cCI6MjA5NTI2MzI2NH0.vXLOWjXh_6z8sSoBVqKA6wwwEKKMozjhRoIIUffwnzI",

  // ── Edge Function URLs ────────────────────────────────────────
  // analyze  : POST { imageBase64, mimeType, treeType?, desiredWork? }
  PROXY_URL:      "https://hydlxwjtdkzcnxxukakt.supabase.co/functions/v1/analyze",
  // save-estimate: POST { analysis, service, photo_url, contact, internal_notes }
  SAVE_URL:       "https://hydlxwjtdkzcnxxukakt.supabase.co/functions/v1/save-estimate",
  // send-quote : POST { estimate_id, approvedBy? }
  SEND_QUOTE_URL: "https://hydlxwjtdkzcnxxukakt.supabase.co/functions/v1/send-quote",

  // ── Direct API key (only for local dev WITHOUT a worker proxy) ─
  // Leave empty in production — use PROXY_URL instead.
  ANTHROPIC_API_KEY: "",

  // ── Business config ───────────────────────────────────────────
  CALENDLY_URL:  "https://calendly.com/YOUR_USERNAME/tree-service",
  COMPANY_NAME:  "Dynamic Tree Service",
  PHONE:         "(555) 000-0000",
  ISA_CERT:      "",
  FOUNDED:       "2010",
};

/* Legacy aliases used by the manager / dashboard inline script */
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON = CONFIG.SUPABASE_KEY;

/* ── Shared Supabase client ────────────────────────────────────────────────
   The Supabase UMD bundle must be loaded BEFORE this file on every page:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="app.js"></script>
*/
let db = null;
if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
  db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
}

/* ── sendQuoteEmail() ──────────────────────────────────────────────────────
   Calls the send-quote Edge Function for a given estimate UUID.
   Used by dashboard.html's "Send quote to customer" button.

   @param {string}  estimateId  - UUID (primary key) of the estimate row
   @param {string}  [approvedBy] - Name of the approving manager
   @returns {Promise<{success:boolean, emailId?:string, error?:string}>}
*/
async function sendQuoteEmail(estimateId, approvedBy) {
  const resp = await fetch(CONFIG.SEND_QUOTE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
    },
    body: JSON.stringify({
      estimate_id: estimateId,
      approvedBy:  approvedBy || 'Manager',
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'send-quote failed: ' + resp.status);
  return data;
}

/* ── Highlight the nav link matching the current page ──────────────────── */
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
