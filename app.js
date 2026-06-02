/* ═══════════════════════════════════════════════════════════════
   Dynamic Tree Service — front-end add-ons
   1) Staff login overlay for internal pages (retry-able)
   2) Plug-and-play demo booking overlay (auto-upgrades to Calendly)
   Edit STAFF_PASSWORD below to change the crew password.
   NOTE: the login is a front-end deterrent for the back-office UI,
   not data security. Protect real customer data with Supabase RLS.
═══════════════════════════════════════════════════════════════ */
(function () {
  var STAFF_PASSWORD = 'treecrew2026';
  var INTERNAL = ['dashboard', 'schedule', 'crew', 'login'];
  var page = (location.pathname.split('/').pop() || 'index').toLowerCase().replace(/\.html$/, '');
  var needsLogin = INTERNAL.indexOf(page) !== -1 && sessionStorage.getItem('dts_staff') !== '1';

  /* Hide page body immediately on locked internal pages (prevents content flash) */
  if (needsLogin) {
    try {
      var st = document.createElement('style');
      st.id = 'dts-lock';
      st.textContent = 'body{display:none !important;}';
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }

  function buildLogin() {
    var ov = document.createElement('div');
    ov.id = 'dts-login';
    ov.setAttribute('style', [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:linear-gradient(160deg,#0b2616,#052e16)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif', 'padding:24px'
    ].join(';'));
    ov.innerHTML =
      '<div style="width:100%;max-width:360px;background:#0f3d22;border:1px solid #1d6b3a;border-radius:18px;padding:30px 26px;box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center">' +
        '<div style="font-size:30px;margin-bottom:8px">🌲</div>' +
        '<div style="color:#eafff1;font-size:18px;font-weight:700;margin-bottom:4px">Staff sign-in</div>' +
        '<div style="color:#8fd3a6;font-size:13px;margin-bottom:18px">Dynamic Tree Service — crew access</div>' +
        '<input id="dts-pw" type="password" placeholder="Crew password" autocomplete="current-password" ' +
          'style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:10px;border:1px solid #2a7d49;background:#08230f;color:#fff;font-size:15px;outline:none" />' +
        '<div id="dts-err" style="color:#ff9b9b;font-size:12.5px;height:16px;margin:8px 0 4px"></div>' +
        '<button id="dts-go" style="width:100%;padding:13px;border:none;border-radius:10px;cursor:pointer;' +
          'background:linear-gradient(90deg,#5EEAD4,#2DD4BF);color:#053; font-size:15px;font-weight:700">Enter →</button>' +
        '<div style="color:#5f9d77;font-size:11px;margin-top:14px">Customers don\'t need this — ' +
          '<a href="/" style="color:#9ff0c2">back to site</a></div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(ov);
    var input = ov.querySelector('#dts-pw');
    var err = ov.querySelector('#dts-err');
    var go = ov.querySelector('#dts-go');
    function submit() {
      if (input.value === STAFF_PASSWORD) {
        sessionStorage.setItem('dts_staff', '1');
        var lock = document.getElementById('dts-lock'); if (lock) lock.remove();
        ov.remove();
      } else {
        err.textContent = 'Incorrect password — try again.';
        input.value = ''; input.focus();
      }
    }
    go.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    setTimeout(function () { input.focus(); }, 50);
  }

  /* ---------- Demo booking overlay (auto-upgrades to Calendly) ---------- */
  function calendlyConfigured() {
    try {
      var u = (typeof CONFIG !== 'undefined' && CONFIG.CALENDLY_URL) || '';
      return /calendly\.com/.test(u) && !/YOUR_USERNAME/i.test(u);
    } catch (e) { return false; }
  }

  function nextSlots() {
    var days = [], d = new Date(), added = 0;
    while (added < 4) {
      d.setDate(d.getDate() + 1);
      var dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // weekdays only
      days.push(new Date(d)); added++;
    }
    return days;
  }

  function openDemoBooking() {
    if (document.getElementById('dts-booking')) return;
    var slots = nextSlots();
    var times = ['8:00 AM', '11:00 AM', '2:00 PM'];
    var dayBtns = slots.map(function (dt, i) {
      var label = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      return '<button class="dts-day" data-i="' + i + '" style="flex:1;min-width:84px;padding:10px 6px;border-radius:10px;border:1px solid #d5e6db;background:#fff;cursor:pointer;font-size:12.5px;font-weight:600;color:#14432a">' + label + '</button>';
    }).join('');
    var timeBtns = times.map(function (t) {
      return '<button class="dts-time" data-t="' + t + '" style="flex:1;padding:11px 6px;border-radius:10px;border:1px solid #d5e6db;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#14432a">' + t + '</button>';
    }).join('');

    var ov = document.createElement('div');
    ov.id = 'dts-booking';
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:2147483646;background:rgba(5,20,11,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif');
    ov.innerHTML =
      '<div style="width:100%;max-width:420px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45)">' +
        '<div style="background:linear-gradient(120deg,#225431,#2f7d4f);color:#fff;padding:18px 22px;position:relative">' +
          '<div style="font-size:17px;font-weight:800">Book your service</div>' +
          '<div style="font-size:12.5px;color:#cdeedb;margin-top:2px">Pick a day &amp; time — we confirm within 1 hour</div>' +
          '<button id="dts-x" style="position:absolute;top:14px;right:16px;background:transparent;border:none;color:#cdeedb;font-size:22px;cursor:pointer;line-height:1">×</button>' +
        '</div>' +
        '<div id="dts-bk-body" style="padding:20px 22px">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6c8a78;font-weight:700;margin-bottom:8px">Choose a day</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">' + dayBtns + '</div>' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6c8a78;font-weight:700;margin-bottom:8px">Choose a time</div>' +
          '<div style="display:flex;gap:8px;margin-bottom:20px">' + timeBtns + '</div>' +
          '<button id="dts-confirm" disabled style="width:100%;padding:14px;border:none;border-radius:11px;cursor:not-allowed;opacity:.5;background:linear-gradient(90deg,#5EEAD4,#2DD4BF);color:#053;font-size:15px;font-weight:800">Confirm booking</button>' +
          '<div style="text-align:center;font-size:11px;color:#9aa8a0;margin-top:12px">Demo scheduler — switches to live Calendly once a booking link is added.</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    var chosen = { day: null, time: null };
    function refresh() {
      var c = ov.querySelector('#dts-confirm');
      var ok = chosen.day !== null && chosen.time !== null;
      c.disabled = !ok;
      c.style.opacity = ok ? '1' : '.5';
      c.style.cursor = ok ? 'pointer' : 'not-allowed';
    }
    function pick(sel, cls, key, val, el) {
      ov.querySelectorAll(sel).forEach(function (b) { b.style.background = '#fff'; b.style.color = '#14432a'; b.style.borderColor = '#d5e6db'; });
      el.style.background = '#225431'; el.style.color = '#fff'; el.style.borderColor = '#225431';
      chosen[key] = val; refresh();
    }
    ov.querySelectorAll('.dts-day').forEach(function (b) {
      b.addEventListener('click', function () { pick('.dts-day', 'day', 'day', slots[+b.dataset.i], b); });
    });
    ov.querySelectorAll('.dts-time').forEach(function (b) {
      b.addEventListener('click', function () { pick('.dts-time', 'time', 'time', b.dataset.t, b); });
    });
    ov.querySelector('#dts-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('#dts-confirm').addEventListener('click', function () {
      if (chosen.day === null || chosen.time === null) return;
      var label = chosen.day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      ov.querySelector('#dts-bk-body').innerHTML =
        '<div style="text-align:center;padding:24px 8px">' +
          '<div style="width:58px;height:58px;border-radius:50%;background:#e7f7ee;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:28px">✅</div>' +
          '<div style="font-size:18px;font-weight:800;color:#14432a;margin-bottom:6px">Booking requested</div>' +
          '<div style="font-size:13.5px;color:#4d6357;line-height:1.5">' + label + ' at ' + chosen.time + '.<br>We\'ll text or call to confirm within 1 hour.</div>' +
          '<button id="dts-done" style="margin-top:18px;padding:12px 22px;border:none;border-radius:10px;cursor:pointer;background:#225431;color:#fff;font-size:14px;font-weight:700">Done</button>' +
        '</div>';
      ov.querySelector('#dts-done').addEventListener('click', function () { ov.remove(); });
    });
  }

  function handleBookClick(e) {
    var t = e.target.closest ? e.target.closest('#book-btn') : null;
    if (!t) return;
    if (calendlyConfigured() && window.Calendly && typeof window.Calendly.initPopupWidget === 'function') {
      e.preventDefault(); e.stopPropagation();
      window.Calendly.initPopupWidget({ url: CONFIG.CALENDLY_URL });
      return;
    }
    e.preventDefault(); e.stopPropagation();
    openDemoBooking();
  }

  function init() {
    if (needsLogin) buildLogin();
    document.addEventListener('click', handleBookClick, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
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

  // ← Plug-and-play: paste the owner's Calendly link here to switch from the
  //    built-in demo scheduler to a live Calendly popup. No other change needed.
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
