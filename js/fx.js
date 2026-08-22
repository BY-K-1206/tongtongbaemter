/* ==========================================================================
   AppFx — Little-Prince motion: number roll, typing sparks, haptic / soft click
   ========================================================================== */

window.AppFx = (function () {
  'use strict';

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function haptic(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern || 12);
    } catch (_) { /* ignore */ }
  }

  let audioCtx = null;
  function softClick(kind) {
    if (prefersReducedMotion()) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = kind === 'success' ? 660 : kind === 'miss' ? 220 : 440;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === 'miss' ? 0.04 : 0.06, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'success' ? 0.18 : 0.1));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (_) { /* ignore */ }
  }

  function rollNumber(el, endValue, options) {
    if (!el) return;
    const opts = options || {};
    const duration = opts.duration || 700;
    const suffix = opts.suffix != null ? opts.suffix : '';
    const prefix = opts.prefix != null ? opts.prefix : '';
    const end = Math.max(0, Math.round(Number(endValue) || 0));
    if (prefersReducedMotion()) {
      el.textContent = `${prefix}${end}${suffix}`;
      return;
    }
    const start = Number(el.dataset.rollValue) || 0;
    el.dataset.rollValue = String(end);
    const t0 = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(start + (end - start) * eased);
      el.textContent = `${prefix}${current}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function sparkAt(x, y, root) {
    if (prefersReducedMotion()) return;
    const host = root || document.body;
    const n = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const spark = document.createElement('span');
      spark.className = 'fx-spark';
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 18 + Math.random() * 28;
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      spark.style.setProperty('--sx', `${Math.cos(angle) * dist}px`);
      spark.style.setProperty('--sy', `${Math.sin(angle) * dist}px`);
      spark.style.setProperty('--hue', String(38 + Math.random() * 40));
      host.appendChild(spark);
      setTimeout(() => spark.remove(), 520);
    }
  }

  function sparkFromEvent(e, root) {
    if (!e) return;
    const rect = (root || document.body).getBoundingClientRect
      ? (root.getBoundingClientRect ? root.getBoundingClientRect() : { left: 0, top: 0 })
      : { left: 0, top: 0 };
    const host = root && root.appendChild ? root : document.body;
    const x = (e.clientX != null ? e.clientX : 0) - (host === document.body ? 0 : rect.left);
    const y = (e.clientY != null ? e.clientY : 0) - (host === document.body ? 0 : rect.top);
    sparkAt(x + (host === document.body ? window.scrollX : 0), y + (host === document.body ? window.scrollY : 0), host);
  }

  function sparkFromElement(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    sparkAt(r.left + r.width / 2 + window.scrollX, r.top + r.height * 0.35 + window.scrollY, document.body);
  }

  function celebrate(el) {
    if (el) el.classList.add('fx-celebrate');
    softClick('success');
    haptic([10, 40, 14]);
    if (el) setTimeout(() => el.classList.remove('fx-celebrate'), 600);
  }

  function miss() {
    softClick('miss');
    haptic(8);
  }

  const SPARK_CLICK_SEL = [
    '.ranking-item',
    '.recent-card',
    '.document-card',
    '.heatmap-cell:not(.heatmap-empty)',
    '.hero-stat',
    '.roadmap-mark',
    '.settings-provider-card',
    '.daily-report-ratio-btn',
    '.btn-primary',
  ].join(',');

  document.addEventListener('click', (e) => {
    if (prefersReducedMotion()) return;
    const hit = e.target.closest(SPARK_CLICK_SEL);
    if (!hit) return;
    sparkFromEvent(e);
  }, true);

  return {
    prefersReducedMotion,
    haptic,
    softClick,
    rollNumber,
    sparkAt,
    sparkFromEvent,
    sparkFromElement,
    celebrate,
    miss,
  };
})();
