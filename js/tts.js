/* ==========================================================================
   AppTts — Web Speech API wrapper
   Hardened for Chromium: voice load, cancel→speak gap, no silent warm-up
   that leaves the synth stuck, and single-flight speak requests.
   ========================================================================== */

window.AppTts = (function () {
  'use strict';

  let speakTimer = null;
  let voicesTimer = null;
  let primed = false;
  let speakToken = 0;

  function supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  function synth() {
    return supported() ? window.speechSynthesis : null;
  }

  function refreshVoices() {
    const s = synth();
    if (!s) return [];
    try {
      return s.getVoices() || [];
    } catch (_) {
      return [];
    }
  }

  function ensureVoices() {
    const s = synth();
    if (!s) return;
    refreshVoices();
    if (typeof s.addEventListener === 'function') {
      s.addEventListener('voiceschanged', () => {
        refreshVoices();
      });
    }
  }

  function pickVoice(lang) {
    const voices = refreshVoices();
    if (!voices.length) return null;
    const want = String(lang || 'en-US').toLowerCase();
    const exact = voices.find((v) => (v.lang || '').toLowerCase() === want);
    if (exact) return exact;
    const prefix = want.split('-')[0];
    const byPrefix = voices.find((v) => (v.lang || '').toLowerCase().startsWith(prefix + '-')
      || (v.lang || '').toLowerCase() === prefix);
    if (byPrefix) return byPrefix;
    return voices.find((v) => /^en\b/i.test(v.lang || '')) || null;
  }

  function clearSpeakTimer() {
    if (speakTimer) {
      clearTimeout(speakTimer);
      speakTimer = null;
    }
    if (voicesTimer) {
      clearTimeout(voicesTimer);
      voicesTimer = null;
    }
  }

  // Call synchronously inside a click/tap handler so later async speaks are allowed.
  // Do NOT speak a silent utterance here — cancel/empty speak can brick Chromium.
  function prime() {
    if (!supported()) return;
    primed = true;
    ensureVoices();
    try {
      const s = synth();
      if (s.paused) s.resume();
      s.resume();
    } catch (_) { /* ignore */ }
  }

  function cancel() {
    clearSpeakTimer();
    speakToken += 1;
    const s = synth();
    if (!s) return;
    try {
      s.cancel();
      if (s.paused) s.resume();
    } catch (_) { /* ignore */ }
  }

  function speakNow(text, settings, token) {
    const s = synth();
    if (!s || !text) return;
    if (token != null && token !== speakToken) return;

    const opts = settings || {};
    const lang = opts.lang || 'en-US';
    const rate = Number(opts.rate);
    const safeRate = Number.isFinite(rate) && rate > 0 ? Math.min(2, Math.max(0.5, rate)) : 1;

    try {
      if (s.paused) s.resume();
      s.resume();

      const utterance = new SpeechSynthesisUtterance(String(text).trim());
      if (!utterance.text) return;

      utterance.lang = lang;
      utterance.rate = safeRate;
      utterance.pitch = 1;
      utterance.volume = 1;
      const voice = pickVoice(lang);
      if (voice) {
        utterance.voice = voice;
        if (voice.lang) utterance.lang = voice.lang;
      }

      utterance.onerror = (event) => {
        const err = event && event.error;
        if (err && err !== 'canceled' && err !== 'interrupted') {
          console.warn('[AppTts] utterance error', err);
          if (token === speakToken) {
            setTimeout(() => {
              if (token !== speakToken) return;
              try {
                if (s.paused) s.resume();
                const retry = new SpeechSynthesisUtterance(String(text).trim());
                retry.lang = utterance.lang;
                retry.rate = utterance.rate;
                retry.pitch = 1;
                retry.volume = 1;
                if (utterance.voice) retry.voice = utterance.voice;
                s.speak(retry);
              } catch (_) { /* ignore */ }
            }, 140);
          }
        }
      };

      s.speak(utterance);
    } catch (err) {
      console.warn('[AppTts] speak failed', err);
    }
  }

  function scheduleSpeak(text, settings, delayMs) {
    clearSpeakTimer();
    const token = speakToken;
    const delay = Math.max(0, Number(delayMs) || 0);
    speakTimer = setTimeout(() => {
      speakTimer = null;
      speakNow(text, settings, token);
    }, delay);
  }

  function speakSentence(text, settings) {
    const clean = String(text || '').trim();
    if (!supported() || !clean) return;
    ensureVoices();

    const s = synth();
    try {
      s.cancel();
      if (s.paused) s.resume();
    } catch (_) { /* ignore */ }

    speakToken += 1;
    const token = speakToken;

    // cancel() then speak() in the same turn is often dropped on Chromium.
    const baseDelay = primed ? 90 : 160;

    if (!refreshVoices().length) {
      const onVoices = () => {
        if (token !== speakToken) return;
        scheduleSpeak(clean, settings, 40);
      };
      if (typeof s.addEventListener === 'function') {
        s.addEventListener('voiceschanged', onVoices, { once: true });
      }
      voicesTimer = setTimeout(() => {
        voicesTimer = null;
        if (token !== speakToken) return;
        scheduleSpeak(clean, settings, 40);
      }, 280);
      return;
    }

    scheduleSpeak(clean, settings, baseDelay);
  }

  if (supported()) {
    ensureVoices();
    setTimeout(ensureVoices, 250);
    setTimeout(ensureVoices, 1000);
  }

  return {
    prime,
    speakSentence,
    cancel,
    supported,
  };
})();
