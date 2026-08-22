/* ==========================================================================
   AppRoadmap — Duolingo-style day steps for a passage
   ========================================================================== */

window.AppRoadmap = (function () {
  'use strict';

  let resizeObserver = null;

  function clearConnectors(pathEl) {
    const svg = pathEl.querySelector('.roadmap-connectors-svg');
    if (svg) svg.remove();
  }

  function drawConnectors(pathEl) {
    const marks = Array.from(pathEl.querySelectorAll('.roadmap-mark'));
    clearConnectors(pathEl);
    if (marks.length < 2) return;

    const pathWidth = pathEl.clientWidth;
    const pathHeight = pathEl.scrollHeight;
    if (pathWidth <= 0 || pathHeight <= 0) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('roadmap-connectors-svg');
    svg.setAttribute('width', String(pathWidth));
    svg.setAttribute('height', String(pathHeight));
    svg.setAttribute('viewBox', `0 0 ${pathWidth} ${pathHeight}`);
    svg.setAttribute('aria-hidden', 'true');

    const pathRect = pathEl.getBoundingClientRect();
    const scrollTop = pathEl.scrollTop || 0;
    const scrollLeft = pathEl.scrollLeft || 0;

    for (let i = 0; i < marks.length - 1; i++) {
      const a = marks[i].querySelector('.roadmap-mark-badge');
      const b = marks[i + 1].querySelector('.roadmap-mark-badge');
      if (!a || !b) continue;

      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();

      const x1 = ar.left + ar.width / 2 - pathRect.left + scrollLeft;
      const y1 = ar.top + ar.height / 2 - pathRect.top + scrollTop;
      const x2 = br.left + br.width / 2 - pathRect.left + scrollLeft;
      const y2 = br.top + br.height / 2 - pathRect.top + scrollTop;

      const fromDone = marks[i].classList.contains('roadmap-mark-completed');
      const toOpen = marks[i + 1].classList.contains('roadmap-mark-completed')
        || marks[i + 1].classList.contains('roadmap-mark-current');
      const lit = fromDone && toOpen;

      const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', lit ? 'roadmap-connector-path is-lit' : 'roadmap-connector-path');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      tick.setAttribute('cx', mx.toFixed(1));
      tick.setAttribute('cy', my.toFixed(1));
      tick.setAttribute('r', lit ? '2.6' : '2');
      tick.setAttribute('class', lit ? 'roadmap-connector-star is-lit' : 'roadmap-connector-star');
      svg.appendChild(tick);
    }

    pathEl.insertBefore(svg, pathEl.firstChild);
  }

  function observePath(pathEl) {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (!pathEl || typeof ResizeObserver === 'undefined') return;
    resizeObserver = new ResizeObserver(() => {
      drawConnectors(pathEl);
    });
    resizeObserver.observe(pathEl);
  }

  function sentenceKo(sentence) {
    if (!sentence) return '';
    const raw = sentence.koTranslation;
    if (raw == null || raw === '') return '';
    if (typeof raw === 'object') {
      return String(raw.koText || raw.text || '').trim();
    }
    return String(raw).trim();
  }

  function getDocumentSentences(doc) {
    if (!doc) return [];
    if (doc.sourceLang === 'ko' && Array.isArray(doc.cachedSentences) && doc.cachedSentences.length) {
      return doc.cachedSentences.map((s) => ({
        en: String((s && s.originalText) || '').trim(),
        ko: sentenceKo(s),
      }));
    }
    const parsed = window.AppParse.parseDocument(doc.rawText || '');
    return (parsed.sentences || []).map((s) => ({
      en: String((s && s.originalText) || '').trim(),
      ko: sentenceKo(s),
    }));
  }

  function joinProseWithHighlights(sentences, memorizedIndex, field) {
    const esc = window.AppUtils.escapeHtml;
    let html = '';
    let inHl = false;
    sentences.forEach((row, i) => {
      const text = esc((row && row[field]) || '');
      if (!text) return;
      const memorized = memorizedIndex.has(i);
      const gap = html ? ' ' : '';
      if (memorized && !inHl) {
        html += `${gap}<mark class="roadmap-book-hl">${text}`;
        inHl = true;
      } else if (memorized && inHl) {
        html += `${gap}${text}`;
      } else if (!memorized && inHl) {
        html += `</mark>${gap}${text}`;
        inHl = false;
      } else {
        html += `${gap}${text}`;
      }
    });
    if (inHl) html += '</mark>';
    return html;
  }

  function renderSentenceList(ctx, marks, completed) {
    const { el } = ctx;
    const list = el.roadmapSentencesList;
    if (!list) return;

    const sentences = getDocumentSentences(ctx.state.roadmapDocument);
    const done = new Set((completed || []).map(Number));
    const memorizedIndex = new Set();
    (marks || []).forEach((mark) => {
      if (!done.has(mark.index)) return;
      for (let i = mark.start; i < mark.end; i++) memorizedIndex.add(i);
    });

    list.innerHTML = '';

    const enHtml = joinProseWithHighlights(sentences, memorizedIndex, 'en');
    const koHtml = joinProseWithHighlights(sentences, memorizedIndex, 'ko');
    if (!enHtml) {
      const empty = document.createElement('p');
      empty.className = 'roadmap-sentences-empty';
      empty.textContent = '이 지문에 표시할 문장이 없어요.';
      list.appendChild(empty);
      return;
    }

    const book = document.createElement('div');
    book.id = 'roadmap-book';
    book.className = koHtml ? 'roadmap-book has-ko' : 'roadmap-book';

    const enPage = document.createElement('div');
    enPage.className = 'roadmap-book-page';
    enPage.id = 'roadmap-book-page-en';
    enPage.innerHTML = `<p class="roadmap-book-prose" id="roadmap-book-prose-en">${enHtml}</p>`;
    book.appendChild(enPage);

    if (koHtml) {
      const koPage = document.createElement('div');
      koPage.className = 'roadmap-book-page';
      koPage.id = 'roadmap-book-page-ko';
      koPage.innerHTML = `<p class="roadmap-book-prose" id="roadmap-book-prose-ko">${koHtml}</p>`;
      book.appendChild(koPage);
    }

    list.appendChild(book);
  }

  function setSentencesOpen(ctx, open) {
    const { el } = ctx;
    if (el.roadmapSentencesPanel) {
      el.roadmapSentencesPanel.hidden = !open;
    }
    if (el.btnRoadmapSentences) {
      el.btnRoadmapSentences.setAttribute('aria-expanded', open ? 'true' : 'false');
      el.btnRoadmapSentences.textContent = open ? '문장 닫기' : '전체 문장 보기';
    }
  }

  function toggleSentences(ctx) {
    const panel = ctx.el.roadmapSentencesPanel;
    const willOpen = !panel || panel.hidden;
    setSentencesOpen(ctx, willOpen);
    if (willOpen && ctx.el.roadmapSentencesPanel) {
      ctx.el.roadmapSentencesPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  async function render(ctx) {
    const { state, el } = ctx;
    const doc = state.roadmapDocument;
    if (!doc) {
      ctx.showScreen('library');
      return;
    }

    const perDay = doc.sentencesPerDay || 3;
    const marks = window.AppDomain.buildMarks(doc.sentenceCount || 0, perDay);
    const progress = await window.AppStorage.getRoadmapProgress(doc.id);
    const completed = progress.completedMarkIndices || [];
    const markDurations = progress.markDurations || {};
    const doneCount = completed.length;

    el.roadmapDocTitle.textContent = doc.title || '제목 없는 지문';
    el.roadmapMeta.textContent = `하루 ${perDay}문장씩 · ${doneCount}/${marks.length} 별 통과`;
    el.roadmapPath.innerHTML = '';
    renderSentenceList(ctx, marks, completed);
    setSentencesOpen(ctx, false);

    if (!marks.length) {
      const empty = document.createElement('p');
      empty.className = 'roadmap-empty';
      empty.textContent = '이 지문에 학습할 문장이 없어요.';
      el.roadmapPath.appendChild(empty);
      return;
    }

    const lockSvg = `
      <svg class="roadmap-lock-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm9 14H6V10h12v10zm-6-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
      </svg>
    `;

    marks.forEach((mark, i) => {
      const status = window.AppDomain.getMarkStatus(mark.index, completed);
      const side = i % 2 === 0 ? 'left' : 'right';
      const clearMs = markDurations[String(mark.index)];
      const hasTime = Number.isFinite(Number(clearMs)) && Number(clearMs) >= 0;
      const timeLabel = hasTime
        ? window.AppUtils.formatCompactDuration(clearMs)
        : '';
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `roadmap-mark roadmap-mark-${status} roadmap-mark-side-${side}`;
      node.dataset.markIndex = String(mark.index);
      node.dataset.status = status;
      node.setAttribute(
        'aria-label',
        `파트 ${mark.index + 1}, 문장 ${mark.sentenceCount}개`
        + (status === 'completed' ? ', 완료' : '')
        + (timeLabel ? `, 소요 ${timeLabel}` : '')
      );

      if (status === 'locked') {
        node.disabled = true;
      }

      const badge = document.createElement('span');
      badge.className = 'roadmap-mark-badge';
      if (status === 'completed') {
        badge.innerHTML = '<span class="roadmap-mark-star" aria-hidden="true">★</span>';
      } else if (status === 'current') {
        badge.textContent = String(mark.index + 1);
      } else {
        badge.innerHTML = lockSvg;
      }

      const meta = document.createElement('span');
      meta.className = 'roadmap-mark-meta';

      const label = document.createElement('span');
      label.className = 'roadmap-mark-label';
      label.textContent = `파트 ${mark.index + 1}`;

      const sub = document.createElement('span');
      sub.className = 'roadmap-mark-sub';
      if (status === 'completed' && timeLabel) {
        sub.textContent = timeLabel;
        sub.classList.add('roadmap-mark-time');
      } else if (status === 'completed') {
        sub.textContent = '통과';
      } else {
        sub.textContent = `문장 ${mark.sentenceCount}개`;
      }

      meta.appendChild(label);
      meta.appendChild(sub);
      node.appendChild(badge);
      node.appendChild(meta);

      if (status === 'current' || status === 'completed') {
        node.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          startMark(ctx, mark.index);
        });
      }

      el.roadmapPath.appendChild(node);
    });

    requestAnimationFrame(() => {
      drawConnectors(el.roadmapPath);
      observePath(el.roadmapPath);
    });
  }

  async function openDocument(ctx, doc) {
    ctx.state.roadmapDocument = doc;
    ctx.state.roadmapMarkIndex = null;
    try {
      if (doc && doc.id) sessionStorage.setItem('ttbt_roadmap_doc_v1', doc.id);
    } catch (_) { /* ignore */ }
    await ctx.showScreen('roadmap');
  }

  async function startMark(ctx, markIndex) {
    const doc = ctx.state.roadmapDocument;
    if (!doc) return;

    const marks = window.AppDomain.buildMarks(doc.sentenceCount || 0, doc.sentencesPerDay || 3);
    const mark = marks[markIndex];
    if (!mark) return;

    // Unlock speech in this click turn so auto-play still works after awaits.
    if (window.AppTts && window.AppTts.prime) window.AppTts.prime();

    const progress = await window.AppStorage.getRoadmapProgress(doc.id);
    const status = window.AppDomain.getMarkStatus(mark.index, progress.completedMarkIndices);
    // Current = start learning; completed = replay. Locked stays blocked.
    if (status !== 'current' && status !== 'completed') {
      if (window.AppDialog) {
        window.AppDialog.alert('아직 잠긴 파트예요. 앞 파트를 먼저 완료해 주세요.');
      }
      return;
    }

    const indices = window.AppDomain.getMarkSentenceIndices(mark);
    ctx.state.roadmapMarkIndex = mark.index;
    await window.AppStudy.startMarkSession(ctx, doc, {
      markIndex: mark.index,
      sentenceIndices: indices,
    });
  }

  return {
    render,
    openDocument,
    startMark,
    toggleSentences,
  };
})();
