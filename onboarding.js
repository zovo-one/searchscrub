/* ============================================================
   SearchScrub - Onboarding controller (Zovo serif design)
   6-step flow. Works in the extension (chrome.*) and standalone
   (graceful mock fallback for manual preview). NASA-clean:
   bounded loops, guarded returns, no globals leaked.
   ============================================================ */
(function () {
  'use strict';

  const TOTAL = 6;
  const UPGRADE_URL = 'https://zovo.one/pricing?src=onboarding&product=searchscrub';
  const hasChrome = typeof chrome !== 'undefined' && chrome.tabs && chrome.storage;

  let current = 1;
  let plan = 'monthly';

  const $ = (id) => document.getElementById(id);
  const steps = Array.from(document.querySelectorAll('.step'));
  const dots = Array.from(document.querySelectorAll('.dot'));
  const nextBtn = $('nextBtn'), backBtn = $('backBtn'), nextLabel = $('nextLabel');
  const counter = $('counter'), fill = $('progressFill');

  const NEXT = {
    1: () => 'Show me',
    2: () => 'Looks good',
    3: () => 'Save & continue',
    4: () => 'See pricing',
    5: () => (plan === 'lifetime' ? 'Get Lifetime for $99' : 'Start 7-day free trial'),
    6: () => 'Start searching'
  };

  /* ---------- render ---------- */
  function render() {
    steps.forEach((s) => s.classList.toggle('active', +s.dataset.step === current));
    dots.forEach((d) => {
      const n = +d.dataset.step;
      d.classList.toggle('active', n === current);
      d.classList.toggle('done', n < current);
    });
    counter.textContent = String(current).padStart(2, '0') + ' / ' + String(TOTAL).padStart(2, '0');
    fill.style.width = (current / TOTAL) * 100 + '%';
    backBtn.hidden = current === 1;
    nextLabel.textContent = NEXT[current]();
    nextBtn.querySelector('svg').style.display = current === 6 ? 'none' : '';
    if (current === 2) resetDemo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function go(n) { current = Math.max(1, Math.min(TOTAL, n)); render(); }

  nextBtn.addEventListener('click', () => {
    if (current === 3) persistSetup();
    if (current === 5) { convert(); return; }
    if (current === 6) { finish(); return; }
    go(current + 1);
  });
  backBtn.addEventListener('click', () => go(current - 1));
  dots.forEach((d) => d.addEventListener('click', () => go(+d.dataset.step)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && current < TOTAL) go(current + 1);
    if (e.key === 'ArrowLeft' && current > 1) go(current - 1);
  });

  /* ---------- Step 2: instant-win demo (scrub the SERP) ---------- */
  let demoRan = false;
  function resetDemo() {
    demoRan = false;
    const num = $('demoNum'), cap = $('demoCap'), btn = $('scrubBtn');
    const dcounter = document.querySelector('.demo-counter');
    if (num) num.textContent = '0';
    if (cap) cap.textContent = 'Tap scrub to clean this page';
    if (dcounter) dcounter.classList.remove('done');
    document.querySelectorAll('#demoSerp .result-spam').forEach((r) => {
      r.classList.remove('blocked');
      const tag = r.querySelector('.blocked-tag'); if (tag) tag.hidden = true;
    });
    document.querySelectorAll('#demoSerp .result-sponsored').forEach((r) => {
      r.classList.remove('collapsed');
    });
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
  const scrubBtn = $('scrubBtn');
  if (scrubBtn) scrubBtn.addEventListener('click', () => {
    if (demoRan) return; demoRan = true;
    const spamRows = Array.from(document.querySelectorAll('#demoSerp .result-spam'));
    const sponsored = Array.from(document.querySelectorAll('#demoSerp .result-sponsored'));

    // 1) stagger the spam rows into blocked state (300ms each)
    spamRows.forEach((row, i) => {
      setTimeout(() => {
        row.classList.add('blocked');
        const tag = row.querySelector('.blocked-tag'); if (tag) tag.hidden = false;
      }, 300 * (i + 1));
    });

    // 2) collapse the sponsored row after spam starts
    setTimeout(() => {
      sponsored.forEach((r) => r.classList.add('collapsed'));
    }, 200);

    // 3) animate the counter 0 -> 3 (sponsored=1, spam=2 => 3 total)
    const totalBlocked = sponsored.length + spamRows.length;
    setTimeout(() => {
      countTo($('demoNum'), 0, totalBlocked, 900, (v) => Math.round(v).toString());
      const cap = $('demoCap'), dcounter = document.querySelector('.demo-counter');
      if (cap) cap.textContent = 'spam hidden on this page';
      if (dcounter) dcounter.classList.add('done');
    }, 300);

    scrubBtn.style.opacity = '.55'; scrubBtn.disabled = true;
  });

  /* ---------- Step 3: setup ---------- */
  const SENS = ['Strict (block aggressively)', 'Balanced', 'Permissive (block only obvious spam)'];
  const sv = $('setupSensitivity'), svv = $('sensitivityValue');
  if (sv) sv.addEventListener('input', () => {
    const idx = +sv.value;
    // Show the label but trim to the lead word for the chip-style readout
    svv.textContent = SENS[idx] || 'Balanced';
  });
  function persistSetup() {
    // Route through the same SAVE_SETTINGS message settings.js uses so the config
    // (stored in chrome.storage.sync['searchScrubSettings']) actually applies.
    const settings = {
      categories: Array.from(document.querySelectorAll('.chip input[data-cat]:checked'))
        .map((c) => c.dataset.cat).filter(Boolean),
      sensitivity: SENS[+sv.value] || 'Balanced',
      hideSponsored: $('setupSponsored').checked,
      hideAIO: $('setupAIO').checked,
      showCounterBadge: $('setupBadge').checked
    };
    if (!hasChrome) return;
    try { chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings }); }
    catch (e) { console.warn('[onboarding] persistSetup failed:', e && e.message); }
  }

  /* ---------- Step 5: pricing toggle + FAQ + convert ---------- */
  const PLANS = {
    monthly: { amt: '$4.99', per: '/ month', sub: '7-day free trial, no card to start', r1: 'No card to start' },
    lifetime: { amt: '$99', per: 'once', sub: 'One payment, Pro unlocked for good', r1: 'One-time payment' }
  };
  const seg = $('planSeg');
  if (seg) seg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-plan]'); if (!btn) return;
    plan = btn.dataset.plan;
    Array.from(seg.querySelectorAll('button')).forEach((b) => b.classList.toggle('on', b === btn));
    const p = PLANS[plan] || PLANS.monthly;
    $('priceAmt').textContent = p.amt;
    $('pricePer').textContent = p.per;
    $('priceSub').textContent = p.sub;
    $('reassure1').textContent = p.r1;
    if (current === 5) nextLabel.textContent = NEXT[5]();
  });
  // FAQ accordion (bounded to the items present)
  Array.from(document.querySelectorAll('#faq .faq-item')).forEach((item) => {
    const q = item.querySelector('.faq-q'), a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', () => {
      const open = item.classList.toggle('open');
      a.style.maxHeight = open ? a.scrollHeight + 'px' : '0';
    });
  });
  function convert() {
    if (hasChrome) { try { chrome.storage.local.set({ upgradeIntentAt: Date.now(), upgradePlan: plan }); } catch (_) {} }
    openUpgrade();
    go(6);
  }
  function openUpgrade() {
    const url = UPGRADE_URL + '&plan=' + encodeURIComponent(plan);
    if (hasChrome && chrome.tabs && chrome.tabs.create) { try { chrome.tabs.create({ url }); return; } catch (_) {} }
    window.open(url, '_blank');
  }

  /* ---------- Step 6: finish ---------- */
  function finish() {
    if (!hasChrome) { nextLabel.textContent = 'Done'; return; }
    try {
      chrome.storage.local.set({ onboardingComplete: true, onboardingAt: Date.now() });
      window.close();
    } catch (_) {}
  }

  /* ---------- helper: bounded RAF counter ---------- */
  function countTo(el, from, to, dur, fmt) {
    if (!el) return;
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
      el.textContent = fmt(v);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------- deep-link a step (preview/screenshots): ?step=4 ---------- */
  try {
    const q = +new URLSearchParams(location.search).get('step');
    if (q >= 1 && q <= TOTAL) current = q;
  } catch (_) {}

  render();
})();
