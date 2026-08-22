/* ==========================================================================
   AppLibrary — study-pick document list
   ========================================================================== */

window.AppLibrary = (function () {
  'use strict';

  // Shared by both the library (study-only) and register (edit/delete-only)
  // document lists, so the two screens stay visually consistent.
  async function buildDocumentCardInfoHtml(doc) {
    const best = await window.AppStorage.getDocumentBestAttempt(doc.id);
    const marks = window.AppDomain.buildMarks(doc.sentenceCount || 0, doc.sentencesPerDay || 3);
    const roadmap = await window.AppStorage.getRoadmapProgress(doc.id);
    const doneSteps = (roadmap.completedMarkIndices || []).length;
    const totalSteps = marks.length;
    const progressPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
    const allDone = totalSteps > 0 && doneSteps >= totalSteps;

    const langTag = doc.sourceLang === 'ko'
      ? '<span class="document-card-lang-tag">\ud55c\uad6d\uc5b4 \u2192 \uc601\uc5b4</span>'
      : '';
    const stars = doc.difficultyStars != null
      ? window.AppDomain.clampDifficultyStars(doc.difficultyStars)
      : window.AppDomain.levelToDifficultyStars(doc.difficultyLevel || 2);
    const level = window.AppDomain.starsToDifficultyLevel(stars);
    const diffLabel = window.AppStorage.difficultyStarsLabel(stars);
    const tagsHtml = (doc.tags && doc.tags.length)
      ? `<div class="document-card-tags">${doc.tags.map((t) => `<span class="tag-chip">${window.AppUtils.escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    const badgeClass = allDone ? 'single-status-memorized' : 'single-status-pending';
    const badgeLabel = allDone ? '완료! 😋' : '아직 안 외움';
    const badgeTitle = allDone ? '완료! 맛있게 쩝쩝' : '아직 안 외움';
    const esc = window.AppUtils.escapeHtml;

    return `
      <span class="single-status-ribbon ${badgeClass}" title="${esc(badgeTitle)}" aria-label="${esc(badgeTitle)}">${badgeLabel}</span>
      <div class="document-card-info">
        <h3 class="document-card-title">${esc(doc.title)} ${langTag}
          <span class="difficulty-badge" data-level="${level}" data-stars="${stars}" title="난이도 ${stars}점">${diffLabel}</span>
        </h3>
        <p class="document-card-progress" aria-label="학습 진행률 ${progressPct}퍼센트">
          <span class="document-card-progress-value">${progressPct}%</span>
          <span class="document-card-progress-detail">${doneSteps}/${totalSteps || 0}파트</span>
        </p>
        <p class="document-card-meta">문장 ${doc.sentenceCount || 0}개 &middot; ${window.AppUtils.formatDate(doc.createdAt)} 등록</p>
        ${tagsHtml}
        ${best
          ? `<p class="document-card-best">베스트 기록: ${window.AppUtils.formatDuration(best.durationMs)} &middot; 재시도 ${best.retryCount}회</p>`
          : '<p class="document-card-best document-card-best-empty">아직 학습 기록이 없어요</p>'}
      </div>
    `;
  }

  async function render(ctx) {
    const { state, el } = ctx;
    const allDocs = await window.AppStorage.getDocuments();
    const allCount = allDocs.length;
    const documents = await window.AppStorage.filterSortDocuments({
      query: state.libraryQuery,
      sort: state.librarySort,
    });
    el.libraryList.innerHTML = '';

    if (!allCount) {
      el.libraryEmpty.hidden = false;
      el.libraryEmptyText.textContent = '아직 등록된 지문이 없어요.';
      return;
    }

    el.libraryEmpty.hidden = true;

    if (!documents.length) {
      const empty = document.createElement('p');
      empty.id = 'library-filter-empty';
      empty.className = 'list-filter-empty';
      empty.textContent = '검색 결과가 없어요. 다른 제목이나 태그를 입력해보세요.';
      el.libraryList.appendChild(empty);
      return;
    }

    for (const doc of documents) {
      const card = document.createElement('div');
      card.className = 'document-card';
      card.dataset.id = doc.id;
      const infoHtml = await buildDocumentCardInfoHtml(doc);
      card.innerHTML = `
        ${infoHtml}
        <div class="document-card-actions">
          <button class="btn btn-primary btn-small btn-start-document" type="button" data-id="${doc.id}">\ud559\uc2b5\ud558\uae30</button>
        </div>
      `;
      el.libraryList.appendChild(card);
    }
  }

  return {
    buildDocumentCardInfoHtml,
    render,
  };
})();
