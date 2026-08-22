/* ==========================================================================
   AppStt — Web Speech Recognition wrapper
   ========================================================================== */

window.AppStt = (function () {
  'use strict';

  let recognition = null;
  let active = false;

  function getRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function isSupported() {
    return !!getRecognitionCtor();
  }

  function isListening() {
    return active;
  }

  function stop() {
    if (!recognition) {
      active = false;
      return;
    }
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    } catch (err) {
      // Already stopped.
    }
    recognition = null;
    active = false;
  }

  function cancel() {
    if (!recognition) {
      active = false;
      return;
    }
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    } catch (err) {
      // Already aborted.
    }
    recognition = null;
    active = false;
  }

  /**
   * @param {object} options
   * @param {string} [options.lang] - BCP-47, e.g. 'ko-KR' | 'en-US'
   * @param {function(string, boolean)} [options.onResult] - (transcript, isFinal)
   * @param {function(string)} [options.onError] - error code/message
   * @param {function()} [options.onEnd]
   */
  function start(options) {
    const opts = options || {};
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      if (typeof opts.onError === 'function') opts.onError('unsupported');
      return false;
    }

    stop();

    if (window.AppTts && window.AppTts.cancel) {
      window.AppTts.cancel();
    }

    const rec = new Ctor();
    recognition = rec;
    active = true;

    rec.lang = opts.lang || 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      if (!event || !event.results || !event.results.length) return;
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = (result[0] && result[0].transcript) || '';
        if (result.isFinal) finalText += piece;
        else interim += piece;
      }
      if (typeof opts.onResult === 'function') {
        if (finalText) opts.onResult(finalText.trim(), true);
        else if (interim) opts.onResult(interim.trim(), false);
      }
    };

    rec.onerror = (event) => {
      const code = (event && event.error) || 'error';
      active = false;
      recognition = null;
      if (typeof opts.onError === 'function') opts.onError(code);
      if (typeof opts.onEnd === 'function') opts.onEnd();
    };

    rec.onend = () => {
      active = false;
      recognition = null;
      if (typeof opts.onEnd === 'function') opts.onEnd();
    };

    try {
      rec.start();
      return true;
    } catch (err) {
      active = false;
      recognition = null;
      if (typeof opts.onError === 'function') opts.onError('start-failed');
      if (typeof opts.onEnd === 'function') opts.onEnd();
      return false;
    }
  }

  return {
    isSupported,
    isListening,
    start,
    stop,
    cancel,
  };
})();
