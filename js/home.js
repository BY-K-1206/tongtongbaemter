/* ==========================================================================
   AppHome — level, ranking, recent activity, heatmap, daily report
   ========================================================================== */

window.AppHome = (function () {
  'use strict';

  async function buildTodayStudySummary() {
    const todayKey = window.AppStorage.dateKey();
    const attempts = await window.AppStorage.getAttempts();
    const todayAttempts = (attempts || []).filter((a) => {
      if (!a || !a.finishedAt) return false;
      return window.AppStorage.dateKey(new Date(a.finishedAt)) === todayKey;
    });

    const singles = todayAttempts.filter((a) => window.AppDomain.attemptKind(a) === 'single');
    const singleCount = singles.length;

    const passageAttempts = todayAttempts.filter((a) => {
      const kind = window.AppDomain.attemptKind(a);
      return kind === 'mark' || kind === 'boss' || kind === 'full';
    });

    const byDoc = new Map();
    passageAttempts.forEach((attempt) => {
      const docId = attempt.documentId;
      if (!docId) return;
      if (!byDoc.has(docId)) byDoc.set(docId, []);
      byDoc.get(docId).push(attempt);
    });

    const passages = [];
    for (const [docId, list] of byDoc.entries()) {
      const doc = await window.AppStorage.getDocument(docId);
      const title = (doc && doc.title) || list[0].documentTitle || '지문';
      const perDay = Math.max(1, Math.floor(Number(doc && doc.sentencesPerDay) || 3));
      const totalSentences = Math.max(0, Number(doc && doc.sentenceCount) || 0);
      const marks = window.AppDomain.buildMarks(totalSentences, perDay);
      const progress = doc
        ? await window.AppStorage.getRoadmapProgress(docId)
        : { completedMarkIndices: [] };
      const doneParts = (progress.completedMarkIndices || []).length;

      const todayParts = list
        .filter((a) => {
          const kind = window.AppDomain.attemptKind(a);
          return kind === 'mark' || kind === 'boss';
        })
        .map((a) => ({
          part: (Number(a.markIndex) || 0) + 1,
          sentences: Number(a.sentenceCount) || 0,
          kind: window.AppDomain.attemptKind(a),
        }))
        .sort((a, b) => a.part - b.part);

      const todaySentenceSum = list.reduce((sum, a) => sum + (Number(a.sentenceCount) || 0), 0);
      const hasFull = list.some((a) => window.AppDomain.attemptKind(a) === 'full');

      passages.push({
        title,
        todayParts,
        todaySentenceSum,
        perDay,
        doneParts,
        totalParts: marks.length || 0,
        hasFull,
      });
    }

    passages.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    return { singleCount, passages };
  }

  function renderTodayStudySection(ctx, summary) {
    const { el } = ctx;
    const singleBlock = el.dailyReportStudySingle;
    const singleText = el.dailyReportStudySingleText;
    const passageBlock = el.dailyReportStudyPassage;
    const passageList = el.dailyReportStudyPassageList;
    const empty = el.dailyReportStudyEmpty;
    if (!singleBlock || !passageBlock || !passageList) return;

    const hasSingle = summary.singleCount > 0;
    const hasPassage = summary.passages.length > 0;

    singleBlock.hidden = !hasSingle;
    if (hasSingle && singleText) {
      singleText.textContent = `오늘 ${summary.singleCount}문장 완료`;
    }

    passageBlock.hidden = !hasPassage;
    passageList.innerHTML = '';
    if (hasPassage) {
      const esc = window.AppUtils.escapeHtml;
      summary.passages.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'daily-report-study-passage-item';

        let partLine = '';
        if (item.todayParts.length) {
          partLine = item.todayParts.map((p) => {
            const label = p.kind === 'boss' ? `파트 ${p.part} 보스` : `파트 ${p.part}`;
            return `${label} (문장 ${p.sentences}개)`;
          }).join(', ');
        } else if (item.hasFull) {
          partLine = '전체 학습 완료';
        } else {
          partLine = `문장 ${item.todaySentenceSum}개`;
        }

        const goalLine = `하루 목표 ${item.perDay}문장 중 오늘 ${item.todaySentenceSum}문장`;
        const roadmapLine = item.totalParts > 0
          ? `로드맵 ${item.doneParts}/${item.totalParts}파트 진행`
          : '';

        li.innerHTML = `
          <p class="daily-report-study-passage-title">${esc(item.title)}</p>
          <p class="daily-report-study-passage-meta">${esc(partLine)}</p>
          <p class="daily-report-study-passage-meta">${esc(goalLine)}${roadmapLine ? ` · ${esc(roadmapLine)}` : ''}</p>
        `;
        passageList.appendChild(li);
      });
    }

    if (empty) empty.hidden = hasSingle || hasPassage;
  }

  async function renderDailyReportCard(ctx) {
    const { el } = ctx;
    if (!el.dailyReportCard) return;

    const todayKey = window.AppStorage.dateKey();
    const activity = await window.AppStorage.getDailyActivity();
    const sentenceCount = activity[todayKey] || 0;
    const durationMs = await window.AppStorage.getTodayDurationMs();
    // Same counter as the hero banner ("N회 써봤어요") — every typing submit.
    const attemptCount = await window.AppStorage.getTodayWriteCount();
    const hasData = sentenceCount > 0 || durationMs > 0 || attemptCount > 0;

    if (el.dailyReportEmpty) el.dailyReportEmpty.hidden = hasData;
    if (el.dailyReportCardStage) el.dailyReportCardStage.hidden = !hasData;
    el.dailyReportCard.hidden = !hasData;
    if (el.dailyReportSaveRow) {
      el.dailyReportSaveRow.hidden = !hasData;
      el.dailyReportSaveRow.setAttribute('aria-hidden', hasData ? 'false' : 'true');
    }
    if (el.btnDownloadDailyReport) {
      el.btnDownloadDailyReport.hidden = !hasData;
      el.btnDownloadDailyReport.disabled = !hasData;
    }

    if (!hasData) return;

    const d = new Date();
    el.dailyReportDate.textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    el.dailyReportTime.textContent = window.AppUtils.formatStudyDuration(durationMs);
    el.dailyReportSentences.textContent = `${sentenceCount}개`;
    if (el.dailyReportRetries) {
      el.dailyReportRetries.textContent = `${attemptCount}회`;
    }

    try {
      const summary = await buildTodayStudySummary();
      renderTodayStudySection(ctx, summary);
    } catch (err) {
      console.error(err);
    }

    const cloud = el.dailyReportWordcloud;
    const topWords = await window.AppStorage.getTodayWordMistakes(10);
    if (cloud) cloud.innerHTML = '';
    el.dailyReportWordsEmpty.hidden = topWords.length > 0;

    if (cloud && topWords.length) {
      const maxCount = Math.max.apply(null, topWords.map((w) => Number(w.count) || 1));
      const minCount = Math.min.apply(null, topWords.map((w) => Number(w.count) || 1));
      const span = Math.max(1, maxCount - minCount);
      const tilts = [-8, 6, -4, 9, -7, 5, -3, 8, -5, 4];
      topWords.forEach((entry, index) => {
        const spanEl = document.createElement('span');
        const weight = maxCount === minCount ? 0.55 : ((Number(entry.count) || 1) - minCount) / span;
        const size = 12 + Math.round(weight * 12);
        spanEl.className = 'report-cloud-word';
        spanEl.dataset.rank = String(index + 1);
        spanEl.textContent = entry.word;
        spanEl.title = `${entry.word} ${entry.count}회`;
        spanEl.style.fontSize = `${size}px`;
        spanEl.style.setProperty('--cloud-tilt', `${tilts[index % tilts.length]}deg`);
        spanEl.style.opacity = String(0.72 + weight * 0.28);
        cloud.appendChild(spanEl);
      });
    }

    bindReportCardTilt(ctx);
  }

  function bindReportCardTilt(ctx) {
    const { el } = ctx;
    const card = el.dailyReportCard;
    const stage = el.dailyReportCardStage || document.getElementById('daily-report-card-stage');
    if (!card || !stage || stage.dataset.tiltBound === '1') return;
    stage.dataset.tiltBound = '1';

    let touchMoved = false;
    let startX = 0;
    let startY = 0;

    function reduced() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function setTilt(clientX, clientY) {
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = card.dataset.ratio || '1:1';
      const max = ratio === '16:9' ? 6 : 11;
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      const rx = (0.5 - y) * max * 2;
      const ry = (x - 0.5) * max * 2;
      card.classList.add('is-tilting');
      card.classList.remove('is-spinning');
      card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    }

    function resetTilt() {
      card.classList.remove('is-tilting');
      card.style.transform = '';
    }

    stage.addEventListener('mousemove', (e) => {
      if (reduced() || window.matchMedia('(pointer: coarse)').matches) return;
      setTilt(e.clientX, e.clientY);
    });
    stage.addEventListener('mouseleave', () => {
      if (card.classList.contains('is-spinning')) return;
      resetTilt();
    });

    stage.addEventListener('touchstart', (e) => {
      if (reduced()) return;
      const t = e.touches[0];
      if (!t) return;
      touchMoved = false;
      startX = t.clientX;
      startY = t.clientY;
      setTilt(t.clientX, t.clientY);
    }, { passive: true });

    stage.addEventListener('touchmove', (e) => {
      if (reduced()) return;
      const t = e.touches[0];
      if (!t) return;
      if (Math.hypot(t.clientX - startX, t.clientY - startY) > 10) touchMoved = true;
      setTilt(t.clientX, t.clientY);
    }, { passive: true });

    stage.addEventListener('touchend', () => {
      if (reduced()) {
        resetTilt();
        return;
      }
      if (!touchMoved) {
        card.classList.remove('is-tilting');
        card.style.transform = '';
        card.classList.remove('is-spinning');
        void card.offsetWidth;
        card.classList.add('is-spinning');
        window.setTimeout(() => {
          card.classList.remove('is-spinning');
        }, 720);
        return;
      }
      resetTilt();
    });
  }

  function renderRankingList(ctx, attempts) {
    const { el } = ctx;
    const top = window.AppDomain.getTopAttempts(attempts, 5);
    el.homeRankingList.innerHTML = '';
    el.homeRankingEmpty.hidden = top.length > 0;

    top.forEach((attempt, index) => {
      const li = document.createElement('li');
      li.className = 'ranking-item';
      li.dataset.rank = String(index + 1);
      li.innerHTML = `
        <div class="ranking-item-top">
          <span class="ranking-rank">${index + 1}</span>
          <span class="ranking-score">${attempt.score}점</span>
        </div>
        <span class="ranking-title">${window.AppUtils.escapeHtml(attempt.documentTitle)}</span>
        <span class="ranking-meta">${Math.round(attempt.avgWpm)} WPM &middot; 정확도 ${Math.round(attempt.avgAccuracy)}%</span>
        <span class="ranking-date">${window.AppUtils.formatDate(attempt.finishedAt)}</span>
      `;
      el.homeRankingList.appendChild(li);
    });
  }

  function attemptElapsedMs(attempt) {
    if (!attempt) return 0;
    if (Number.isFinite(attempt.durationMs) && attempt.durationMs >= 0) {
      return attempt.durationMs;
    }
    if (attempt.startedAt && attempt.finishedAt) {
      return Math.max(0, attempt.finishedAt - attempt.startedAt);
    }
    return 0;
  }

  let recentSlideIndex = 0;

  function uniqueRecentAttempts(attempts) {
    const sorted = (attempts || []).slice().sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
    const seen = new Set();
    const out = [];
    sorted.forEach((attempt) => {
      const key = window.AppDomain.buildAttemptSentenceId(attempt);
      if (key) {
        if (seen.has(key)) return;
        seen.add(key);
      }
      out.push(attempt);
    });
    return out.slice(0, 3);
  }

  function syncRecentCarousel(ctx) {
    const { el } = ctx;
    const track = el.homeRecentGrid;
    const cards = track ? track.querySelectorAll('.recent-card') : [];
    const total = cards.length;
    if (!total) {
      recentSlideIndex = 0;
      if (el.homeRecentCarousel) el.homeRecentCarousel.hidden = true;
      return;
    }
    if (el.homeRecentCarousel) el.homeRecentCarousel.hidden = false;
    recentSlideIndex = Math.max(0, Math.min(recentSlideIndex, total - 1));
    if (track) {
      track.style.transform = `translateX(-${recentSlideIndex * 100}%)`;
    }
    if (el.btnRecentPrev) {
      el.btnRecentPrev.disabled = recentSlideIndex <= 0;
      el.btnRecentPrev.hidden = total <= 1;
    }
    if (el.btnRecentNext) {
      el.btnRecentNext.disabled = recentSlideIndex >= total - 1;
      el.btnRecentNext.hidden = total <= 1;
    }
  }

  function slideRecent(ctx, delta) {
    const track = ctx.el.homeRecentGrid;
    const total = track ? track.querySelectorAll('.recent-card').length : 0;
    if (!total) return;
    recentSlideIndex = Math.max(0, Math.min(total - 1, recentSlideIndex + delta));
    syncRecentCarousel(ctx);
  }

  function renderRecentActivity(ctx, attempts) {
    const { el } = ctx;
    const recent = uniqueRecentAttempts(attempts);
    el.homeRecentGrid.innerHTML = '';
    el.homeRecentEmpty.hidden = recent.length > 0;
    if (el.homeRecentCarousel) el.homeRecentCarousel.hidden = recent.length === 0;

    recent.forEach((attempt) => {
      const kind = window.AppDomain.attemptKind(attempt);
      const kindLabel = window.AppDomain.attemptKindLabel(attempt);
      const chipKind = kind === 'single' ? 'single' : 'passage';
      const sentenceLabel = attempt.sentenceCount === 1
        ? '1문장'
        : `${attempt.sentenceCount || 0}문장`;
      const elapsed = window.AppUtils.formatElapsed(attemptElapsedMs(attempt));
      const replayCount = Number(attempt.replayCount) || 0;
      const esc = window.AppUtils.escapeHtml;
      const docId = attempt.documentId || '';
      const markIndex = attempt.markIndex != null ? String(attempt.markIndex) : '';
      // Submits until this learning unit was first memorized (that sentence / part).
      const writeCount = attempt.writeCount != null
        ? Number(attempt.writeCount) || 0
        : (Number(attempt.retryCount) || 0);
      const card = document.createElement('article');
      card.className = 'recent-card';
      card.dataset.kind = kind;
      card.innerHTML = `
        <div class="recent-card-top">
          <span class="recent-card-chip recent-card-chip-${chipKind}">${esc(kindLabel)}</span>
          <span class="recent-card-score">${attempt.score}점</span>
        </div>
        <p class="recent-card-title">${esc(attempt.documentTitle || '학습')}</p>
        <p class="recent-card-meta">${window.AppUtils.formatDate(attempt.finishedAt)} &middot; ${sentenceLabel}</p>
        <div class="recent-card-footer">
          <p class="recent-card-detail">소요 ${esc(elapsed)} &middot; 정확도 ${Math.round(attempt.avgAccuracy || 0)}% &middot; 시도 ${writeCount}회 &middot; 반복학습 ${replayCount}회</p>
          <button
            type="button"
            class="btn btn-primary btn-small btn-recent-replay"
            data-kind="${esc(kind)}"
            data-document-id="${esc(docId)}"
            data-mark-index="${esc(markIndex)}"
            data-vault-id="${kind === 'single' ? esc(docId) : ''}"
          >다시 학습하기</button>
        </div>
      `;
      el.homeRecentGrid.appendChild(card);
    });

    recentSlideIndex = 0;
    syncRecentCarousel(ctx);
  }

  async function replayRecentAttempt(ctx, btn) {
    if (!btn) return;
    const kind = btn.getAttribute('data-kind') || '';
    const documentId = btn.getAttribute('data-document-id') || '';
    const vaultId = btn.getAttribute('data-vault-id') || documentId;
    const markIndex = Number(btn.getAttribute('data-mark-index'));

    if (kind === 'single') {
      if (!vaultId) {
        await window.AppDialog.alert('문장을 찾을 수 없어요.');
        return;
      }
      await window.AppSingle.startMemorize(ctx, vaultId, 'single');
      return;
    }

    if (!documentId) {
      await window.AppDialog.alert('지문을 찾을 수 없어요.');
      return;
    }
    const doc = await window.AppStorage.getDocument(documentId);
    if (!doc) {
      await window.AppDialog.alert('지문을 찾을 수 없어요. 삭제되었을 수 있어요.');
      return;
    }

    if ((kind === 'mark' || kind === 'boss') && Number.isFinite(markIndex)) {
      ctx.state.roadmapDocument = doc;
      try {
        sessionStorage.setItem('ttbt_roadmap_doc_v1', doc.id);
      } catch (_) { /* ignore */ }
      await window.AppRoadmap.openDocument(ctx, doc);
      await window.AppRoadmap.startMark(ctx, markIndex);
      return;
    }

    await window.AppRoadmap.openDocument(ctx, doc);
  }

  async function renderHeatmap(ctx) {
    const { el } = ctx;
    if (!el.homeHeatmapGrid || !el.homeHeatmapMonths) return;

    const activity = await window.AppStorage.getDailyActivity();
    const streak = await window.AppStorage.getStreak();
    if (el.homeStreakBadge) {
      el.homeStreakBadge.textContent = `\uc5f0\uc18d ${streak}\uc77c`;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Recent ~3 months: from the 1st of (current month - 2) through the
    // last day of the current month (future days render as empty gray cells).
    const rangeStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    rangeEnd.setHours(0, 0, 0, 0);
    const padCount = rangeStart.getDay(); // pad so columns start on Sunday
    const cells = [];

    for (let i = 0; i < padCount; i++) {
      cells.push({ key: null, count: -1, date: null });
    }

    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const day = new Date(d);
      const key = window.AppStorage.dateKey(day);
      cells.push({ key, count: activity[key] || 0, date: day });
    }

    const weekCount = Math.ceil(cells.length / 7);
    while (cells.length < weekCount * 7) {
      cells.push({ key: null, count: -1, date: null });
    }

    el.homeHeatmapMonths.innerHTML = '';
    el.homeHeatmapGrid.innerHTML = '';

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    let lastMonthLabel = null;

    for (let w = 0; w < weekCount; w++) {
      const weekCells = cells.slice(w * 7, w * 7 + 7);
      const firstReal = weekCells.find((c) => c.date);
      const monthLabel = document.createElement('span');
      monthLabel.className = 'heatmap-month';

      // Label by the month of day 1 in this week (not the week's first day),
      // so Aug 1 in a week that still has July days still shows "8월".
      const dayOne = weekCells.find((c) => c.date && c.date.getDate() === 1);
      const isRangeStartWeek = weekCells.some(
        (c) => c.date && c.key === window.AppStorage.dateKey(rangeStart)
      );
      let labelMonthDate = null;
      if (dayOne) {
        labelMonthDate = dayOne.date;
      } else if (isRangeStartWeek && firstReal) {
        labelMonthDate = firstReal.date;
      }

      if (labelMonthDate) {
        const label = monthNames[labelMonthDate.getMonth()];
        if (label !== lastMonthLabel) {
          monthLabel.textContent = label;
          lastMonthLabel = label;
        }
      }
      el.homeHeatmapMonths.appendChild(monthLabel);
    }

    cells.forEach((cell) => {
      const div = document.createElement('div');
      if (cell.count < 0) {
        div.className = 'heatmap-cell heatmap-empty';
      } else {
        div.className = `heatmap-cell level-${window.AppUtils.activityLevel(cell.count)}`;
        div.title = `${cell.key} · ${cell.count}문장`;
      }
      el.homeHeatmapGrid.appendChild(div);
    });

    // Keep the current month in view (grid grows left→right).
    if (el.homeHeatmapScroll) {
      requestAnimationFrame(() => {
        el.homeHeatmapScroll.scrollLeft = el.homeHeatmapScroll.scrollWidth;
      });
    }
  }

  async function render(ctx) {
    const { el } = ctx;
    if (window.AppTiers.refresh) await window.AppTiers.refresh();
    const attempts = await window.AppStorage.getAttempts();
    const totalSentences = attempts.reduce((sum, a) => sum + (a.sentenceCount || 0), 0);
    const avgScore = attempts.length
      ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
      : 0;
    const bestWpm = attempts.reduce((max, a) => Math.max(max, a.avgWpm || 0), 0);

    const tierIndex = window.AppTiers.getTierIndex(bestWpm);
    const tier = window.AppTiers.TIERS[tierIndex];
    const nextTier = window.AppTiers.TIERS[tierIndex + 1];

    if (el.homeLevelRing) el.homeLevelRing.dataset.tier = String(tierIndex + 1);
    if (el.homeLevelRingNumber) el.homeLevelRingNumber.textContent = String(tierIndex + 1);
    if (el.homeLevelLabel) el.homeLevelLabel.textContent = tier.label;
    if (el.homeBoa) {
      el.homeBoa.dataset.tier = String(tierIndex + 1);
      const imageUrl = tier && tier.imageDataUrl;
      let img = el.homeBoa.querySelector('#home-boa-image');
      if (imageUrl) {
        if (!img) {
          img = document.createElement('img');
          img.id = 'home-boa-image';
          img.alt = '';
          el.homeBoa.insertBefore(img, el.homeBoa.firstChild);
        }
        img.src = imageUrl;
        el.homeBoa.classList.add('has-image');
      } else {
        if (img) img.remove();
        el.homeBoa.classList.remove('has-image');
      }
    }

    const todaySentences = await window.AppStorage.getTodaySentenceCount();
    const todayWrites = await window.AppStorage.getTodayWriteCount();
    if (el.homeTodaySwallowed) {
      el.homeTodaySwallowed.textContent = `오늘 삼킨 문장 ${todaySentences}개`;
    }
    if (el.homeTodayRetries) {
      el.homeTodayRetries.textContent = `문장을 ${todayWrites}회 써봤어요!`;
    }

    if (el.heroStatSentences) {
      if (window.AppFx) window.AppFx.rollNumber(el.heroStatSentences, totalSentences);
      else el.heroStatSentences.textContent = String(totalSentences);
    }
    if (el.heroStatStreak) {
      const streak = await window.AppStorage.getStreak();
      if (window.AppFx) window.AppFx.rollNumber(el.heroStatStreak, streak);
      else el.heroStatStreak.textContent = String(streak);
    }
    if (el.heroStatScore) {
      if (window.AppFx) window.AppFx.rollNumber(el.heroStatScore, avgScore);
      else el.heroStatScore.textContent = String(avgScore);
    }

    if (el.homeLevelProgressFill && el.homeLevelProgressText) {
      if (!attempts.length) {
        el.homeLevelProgressFill.style.transform = 'scaleX(0)';
        el.homeLevelProgressText.textContent = '보아뱀을 통통하게 살찌워보아요';
      } else if (nextTier) {
        const span = nextTier.min - tier.min;
        const progressed = Math.min(100, Math.max(0, ((bestWpm - tier.min) / span) * 100));
        el.homeLevelProgressFill.style.transform = `scaleX(${Math.max(0, Math.min(1, progressed / 100))})`;
        const remaining = Math.max(0, Math.ceil(nextTier.min - bestWpm));
        el.homeLevelProgressText.textContent = `다음 성장까지 ${remaining} WPM 남음`;
      } else {
        el.homeLevelProgressFill.style.transform = 'scaleX(1)';
        el.homeLevelProgressText.textContent = '전설의 보아뱀이 되었어요!';
      }
    }

    try { renderRankingList(ctx, attempts); } catch (err) { console.error(err); }
    try { renderRecentActivity(ctx, attempts); } catch (err) { console.error(err); }
    try { await renderHeatmap(ctx); } catch (err) { console.error(err); }
    try { await renderDailyReportCard(ctx); } catch (err) { console.error(err); }
  }

  async function downloadDailyReport(ctx) {
    const { el } = ctx;
    if (!window.html2canvas) {
      window.AppDialog.alert('이미지 저장 기능을 불러오는 중이에요. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!el.dailyReportCard || el.dailyReportCard.hidden || (el.dailyReportCardStage && el.dailyReportCardStage.hidden)) {
      window.AppDialog.alert('저장할 리포트가 없어요. 학습을 먼저 진행해 주세요.');
      return;
    }
    const ratio = el.dailyReportCard.dataset.ratio || '1:1';
    const { w: ratioW, h: ratioH } = parseRatio(ratio);
    const btn = el.btnDownloadDailyReport;
    const originalLabel = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '이미지 만드는 중...';
    }

    // Screen stays rounded; export uses square corners.
    el.dailyReportCard.classList.add('is-exporting');
    el.dailyReportCard.classList.remove('is-tilting', 'is-spinning');
    el.dailyReportCard.style.transform = 'none';
    try {
      await window.AppUtils.sleep(40);
      const canvas = await window.html2canvas(el.dailyReportCard, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        onclone(clonedDoc) {
          const clonedCard = clonedDoc.getElementById('home-daily-report-card');
          if (!clonedCard) return;
          clonedCard.classList.add('is-exporting');
          clonedCard.classList.remove('is-tilting', 'is-spinning');
          clonedCard.style.borderRadius = '0';
          clonedCard.style.overflow = 'hidden';
          clonedCard.style.transform = 'none';
        },
      });
      const framed = fitCanvasToRatio(canvas, ratioW, ratioH);
      const link = document.createElement('a');
      const safeRatio = ratio.replace(':', 'x');
      link.download = `nyamnyamboater-report-${window.AppStorage.dateKey()}-${safeRatio}.png`;
      link.href = framed.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      window.AppDialog.alert('이미지 저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      el.dailyReportCard.classList.remove('is-exporting');
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel || '이미지로 저장';
      }
    }
  }

  function setDailyReportRatio(ctx, ratio) {
    const { el } = ctx;
    const allowed = { '1:1': true, '3:4': true, '16:9': true };
    const next = allowed[ratio] ? ratio : '1:1';
    if (el.dailyReportCard) {
      el.dailyReportCard.dataset.ratio = next;
      el.dailyReportCard.classList.remove('is-ratio-swap');
      void el.dailyReportCard.offsetWidth;
      el.dailyReportCard.classList.add('is-ratio-swap');
    }
    const buttons = el.dailyReportRatio
      ? el.dailyReportRatio.querySelectorAll('.daily-report-ratio-btn')
      : [];
    buttons.forEach((btn) => {
      const active = btn.dataset.ratio === next;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function parseRatio(ratio) {
    const parts = String(ratio || '1:1').split(':').map(Number);
    const w = parts[0] > 0 ? parts[0] : 1;
    const h = parts[1] > 0 ? parts[1] : 1;
    return { w, h };
  }

  function fitCanvasToRatio(sourceCanvas, ratioW, ratioH) {
    const targetW = 1080;
    const targetH = Math.round((targetW * ratioH) / ratioW);
    const out = document.createElement('canvas');
    out.width = targetW;
    out.height = targetH;
    const ctx2d = out.getContext('2d');

    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;
    // Contain (not cover) so the hashtag and other edges are never cropped.
    const scale = Math.min(targetW / srcW, targetH / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const dx = (targetW - drawW) / 2;
    const dy = (targetH - drawH) / 2;
    ctx2d.fillStyle = '#6B4A7A';
    ctx2d.fillRect(0, 0, targetW, targetH);
    ctx2d.drawImage(sourceCanvas, dx, dy, drawW, drawH);
    return out;
  }

  return {
    render,
    renderDailyReportCard,
    renderHeatmap,
    setDailyReportRatio,
    downloadDailyReport,
    replayRecentAttempt,
    slideRecent,
  };
})();
