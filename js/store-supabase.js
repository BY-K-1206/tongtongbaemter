/* ==========================================================================
   SupabaseStore — AppDataStore adapter
   게스트(세션 없음) → localStorage만
   로그인됨 → 해당 계정 Supabase만 (로컬에 쓰지 않음)
   첫 로그인 때 클라우드 지문이 0개면 로컬 데이터를 한 번만 올립니다.
   ========================================================================== */

window.createSupabaseStore = function createSupabaseStore(client) {
  'use strict';

  const local = window.createLocalStore();
  let userId = null;
  let sessionReady = null;
  let mergedFor = null;

  function throwIf(error, fallback) {
    if (!error) return;
    const msg = String(error.message || '');
    if (/row-level security/i.test(msg)) {
      throw new Error('권한이 없습니다. 로그인 상태를 확인해 주세요.');
    }
    if (/Failed to fetch|NetworkError|CORS/i.test(msg)) {
      throw new Error('Supabase에 연결하지 못했어요. URL과 키를 확인해 주세요.');
    }
    throw new Error(fallback || msg || '저장에 실패했습니다.');
  }

  function newId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function dateKey(date) {
    return window.AppDomain.dateKey(date);
  }

  async function ensureSession() {
    if (userId) return userId;
    if (!sessionReady) {
      sessionReady = client.auth.getSession().then(({ data }) => {
        const user = data && data.session && data.session.user;
        userId = user ? user.id : null;
        return userId;
      }).catch(() => {
        userId = null;
        return null;
      });
    }
    return sessionReady;
  }

  function useCloud() {
    return !!(client && userId);
  }

  function buildNewDocument(doc) {
    const Domain = window.AppDomain;
    let difficultyStars;
    let difficultyLevel;
    let difficultyScore;
    if (doc.difficultyStars != null) {
      difficultyStars = Domain.clampDifficultyStars(doc.difficultyStars);
      difficultyLevel = Domain.starsToDifficultyLevel(difficultyStars);
      difficultyScore = difficultyStars;
    } else if (doc.difficultyScore != null) {
      difficultyScore = doc.difficultyScore;
      difficultyLevel = doc.difficultyLevel || 2;
      difficultyStars = Domain.levelToDifficultyStars(difficultyLevel);
    } else {
      const computed = Domain.computeDifficultyFromEnglishText(doc.rawText, doc.sentenceCount);
      difficultyScore = computed.difficultyScore;
      difficultyLevel = computed.difficultyLevel;
      difficultyStars = Domain.levelToDifficultyStars(difficultyLevel);
    }
    return Domain.normalizeDocument({
      id: newId(),
      title: doc.title,
      rawText: doc.rawText,
      lang: doc.lang,
      rate: doc.rate,
      createdAt: Date.now(),
      sentenceCount: doc.sentenceCount,
      sourceLang: doc.sourceLang || 'en',
      cachedSentences: doc.sourceLang === 'ko' ? (doc.cachedSentences || []) : null,
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      difficultyScore,
      difficultyLevel,
      difficultyStars,
      sentencesPerDay: Math.max(1, Math.floor(Number(doc.sentencesPerDay) || 3)),
      translateGuidance: Domain.normalizeTranslateGuidance(doc.translateGuidance),
    });
  }

  function docFromRow(row) {
    if (!row) return null;
    return window.AppDomain.normalizeDocument({
      id: row.id,
      title: row.title,
      rawText: row.raw_text,
      lang: row.lang,
      rate: row.rate,
      createdAt: row.created_at,
      sentenceCount: row.sentence_count,
      sourceLang: row.source_lang,
      cachedSentences: row.cached_sentences,
      tags: row.tags,
      difficultyScore: row.difficulty_score,
      difficultyLevel: row.difficulty_level,
      difficultyStars: row.difficulty_stars,
      sentencesPerDay: row.sentences_per_day,
      translateGuidance: row.translate_guidance,
      updatedAt: row.updated_at,
    });
  }

  function docToRow(doc, uid) {
    return {
      id: doc.id,
      user_id: uid,
      title: doc.title,
      raw_text: doc.rawText,
      lang: doc.lang,
      rate: doc.rate,
      created_at: doc.createdAt || Date.now(),
      sentence_count: doc.sentenceCount,
      source_lang: doc.sourceLang || 'en',
      cached_sentences: doc.sourceLang === 'ko' ? (doc.cachedSentences || []) : null,
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      difficulty_score: doc.difficultyScore,
      difficulty_level: doc.difficultyLevel,
      difficulty_stars: doc.difficultyStars,
      sentences_per_day: doc.sentencesPerDay,
      translate_guidance: doc.translateGuidance,
      updated_at: doc.updatedAt || null,
    };
  }

  function attemptFromRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      documentId: row.document_id,
      sentenceId: row.sentence_id,
      kind: row.kind,
      markIndex: row.mark_index,
      documentTitle: row.document_title,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationMs: row.duration_ms,
      sentenceCount: row.sentence_count,
      retryCount: row.retry_count,
      writeCount: row.write_count,
      replayCount: row.replay_count,
      avgWpm: row.avg_wpm,
      avgAccuracy: row.avg_accuracy,
      score: row.score,
      tierLabel: row.tier_label,
      createdAt: row.created_at,
    };
  }

  function attemptToRow(attempt, uid, id) {
    return {
      id,
      user_id: uid,
      document_id: attempt.documentId || null,
      sentence_id: attempt.sentenceId || null,
      kind: attempt.kind || null,
      mark_index: attempt.markIndex != null ? Number(attempt.markIndex) : null,
      document_title: attempt.documentTitle || null,
      started_at: attempt.startedAt || null,
      finished_at: attempt.finishedAt || null,
      duration_ms: attempt.durationMs || null,
      sentence_count: attempt.sentenceCount || null,
      retry_count: attempt.retryCount || null,
      write_count: attempt.writeCount || null,
      replay_count: attempt.replayCount || 0,
      avg_wpm: attempt.avgWpm || null,
      avg_accuracy: attempt.avgAccuracy || null,
      score: attempt.score || null,
      tier_label: attempt.tierLabel || null,
      created_at: attempt.createdAt || Date.now(),
    };
  }

  function vaultFromRow(row) {
    return window.AppDomain.normalizeVaultSentence({
      id: row.id,
      enText: row.en_text,
      koText: row.ko_text,
      sourceLang: row.source_lang,
      status: row.status,
      translateGuidance: row.translate_guidance,
      createdAt: row.created_at,
      memorizedAt: row.memorized_at,
      updatedAt: row.updated_at,
    });
  }

  async function bumpDaily(field, amount, extra) {
    const uid = userId;
    const key = dateKey();
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n && !extra) return;
    const { data, error } = await client
      .from('daily_stats')
      .select('*')
      .eq('user_id', uid)
      .eq('date_key', key)
      .maybeSingle();
    throwIf(error, '일일 기록을 읽지 못했습니다.');
    const row = data || {
      user_id: uid,
      date_key: key,
      sentences: 0,
      duration_ms: 0,
      retries: 0,
      memorized_retries: 0,
      writes: 0,
      word_mistakes: {},
    };
    if (field && n) row[field] = (Number(row[field]) || 0) + n;
    if (extra) extra(row);
    const { error: upErr } = await client.from('daily_stats').upsert(row);
    throwIf(upErr, '일일 기록을 저장하지 못했습니다.');
  }

  async function listDocuments() {
    await ensureSession();
    if (!useCloud()) return local.listDocuments();
    const { data, error } = await client
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    throwIf(error, '지문을 불러오지 못했습니다.');
    return (data || []).map(docFromRow);
  }

  async function getDocument(id) {
    await ensureSession();
    if (!useCloud()) return local.getDocument(id);
    const { data, error } = await client.from('documents').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    throwIf(error, '지문을 불러오지 못했습니다.');
    return docFromRow(data);
  }

  async function saveDocument(doc) {
    await ensureSession();
    if (!useCloud()) return local.saveDocument(doc);
    const built = await local.saveDocument(doc);
    const row = docToRow(built, userId);
    const { error } = await client.from('documents').insert(row);
    throwIf(error, '지문을 저장하지 못했습니다.');
    return built;
  }

  async function updateDocument(id, updates) {
    await ensureSession();
    if (!useCloud()) return local.updateDocument(id, updates);
    const current = await getDocument(id);
    if (!current) return null;
    const merged = window.AppDomain.normalizeDocument(Object.assign({}, current, updates, { updatedAt: Date.now() }));
    const { error } = await client.from('documents').update(docToRow(merged, userId)).eq('id', id).eq('user_id', userId);
    throwIf(error, '지문을 수정하지 못했습니다.');
    return merged;
  }

  async function deleteDocument(id) {
    await ensureSession();
    if (!useCloud()) return local.deleteDocument(id);
    const { error } = await client.from('documents').delete().eq('id', id).eq('user_id', userId);
    throwIf(error, '지문을 삭제하지 못했습니다.');
    await client.from('attempts').delete().eq('document_id', id).eq('user_id', userId);
    await client.from('roadmap_progress').delete().eq('document_id', id).eq('user_id', userId);
  }

  async function listAttempts(documentId) {
    await ensureSession();
    if (!useCloud()) return local.listAttempts(documentId);
    let q = client.from('attempts').select('*').eq('user_id', userId);
    if (documentId) q = q.eq('document_id', documentId);
    const { data, error } = await q;
    throwIf(error, '학습 기록을 불러오지 못했습니다.');
    return (data || []).map(attemptFromRow);
  }

  async function saveAttempt(attempt) {
    await ensureSession();
    if (!useCloud()) return local.saveAttempt(attempt);
    const sentenceId = (attempt && attempt.sentenceId)
      || (window.AppDomain.buildAttemptSentenceId && window.AppDomain.buildAttemptSentenceId(attempt))
      || null;
    let existing = null;
    if (sentenceId) {
      const found = await client
        .from('attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('sentence_id', sentenceId)
        .maybeSingle();
      throwIf(found.error);
      existing = found.data;
    }
    if (existing) {
      const next = attemptToRow(Object.assign({}, attempt, {
        sentenceId,
        replayCount: (Number(existing.replay_count) || 0) + 1,
        writeCount: existing.write_count != null ? existing.write_count : attempt.writeCount,
        createdAt: existing.created_at,
      }), userId, existing.id);
      const { data, error } = await client.from('attempts').update(next).eq('id', existing.id).select('*').single();
      throwIf(error, '학습 기록을 저장하지 못했습니다.');
      return attemptFromRow(data);
    }
    const record = attemptToRow(Object.assign({}, attempt, { sentenceId }), userId, newId());
    const { data, error } = await client.from('attempts').insert(record).select('*').single();
    throwIf(error, '학습 기록을 저장하지 못했습니다.');
    return attemptFromRow(data);
  }

  async function mapDaily(column) {
    await ensureSession();
    if (!useCloud()) return null;
    const { data, error } = await client.from('daily_stats').select(`date_key, ${column}`).eq('user_id', userId);
    throwIf(error);
    const map = {};
    (data || []).forEach((row) => { map[row.date_key] = Number(row[column]) || 0; });
    return map;
  }

  async function getDailyActivity() {
    const mapped = await mapDaily('sentences');
    return mapped || local.getDailyActivity();
  }

  async function recordActivity(count, durationMs) {
    await ensureSession();
    if (!useCloud()) return local.recordActivity(count, durationMs);
    if (!count) return;
    await bumpDaily('sentences', count, (row) => {
      if (durationMs) row.duration_ms = (Number(row.duration_ms) || 0) + durationMs;
    });
  }

  async function getTodayDurationMs() {
    await ensureSession();
    if (!useCloud()) return local.getTodayDurationMs();
    const { data, error } = await client
      .from('daily_stats')
      .select('duration_ms')
      .eq('user_id', userId)
      .eq('date_key', dateKey())
      .maybeSingle();
    throwIf(error);
    return (data && data.duration_ms) || 0;
  }

  async function recordRetry(count) {
    await ensureSession();
    if (!useCloud()) return local.recordRetry(count);
    await bumpDaily('retries', count);
  }

  async function getDailyRetries() {
    const mapped = await mapDaily('retries');
    return mapped || local.getDailyRetries();
  }

  async function getTodayRetryCount() {
    const all = await getDailyRetries();
    return all[dateKey()] || 0;
  }

  async function recordMemorizedRetries(count) {
    await ensureSession();
    if (!useCloud()) return local.recordMemorizedRetries(count);
    await bumpDaily('memorized_retries', count);
  }

  async function getDailyMemorizedRetries() {
    const mapped = await mapDaily('memorized_retries');
    return mapped || local.getDailyMemorizedRetries();
  }

  async function getTodayMemorizedRetryCount() {
    const all = await getDailyMemorizedRetries();
    return all[dateKey()] || 0;
  }

  async function recordWrite(count) {
    await ensureSession();
    if (!useCloud()) return local.recordWrite(count);
    await bumpDaily('writes', count);
  }

  async function getDailyWrites() {
    const mapped = await mapDaily('writes');
    return mapped || local.getDailyWrites();
  }

  async function getTodayWriteCount() {
    const all = await getDailyWrites();
    return all[dateKey()] || 0;
  }

  async function getTodaySentenceCount() {
    const all = await getDailyActivity();
    return all[dateKey()] || 0;
  }

  async function recordWordMistake(word) {
    await ensureSession();
    if (!useCloud()) return local.recordWordMistake(word);
    const clean = window.AppUtils.normalizeWord(word);
    if (!clean || window.AppUtils.isMistakeStopword(clean)) return;
    await bumpDaily(null, 0, (row) => {
      const map = row.word_mistakes && typeof row.word_mistakes === 'object' ? row.word_mistakes : {};
      map[clean] = (Number(map[clean]) || 0) + 1;
      row.word_mistakes = map;
    });
  }

  async function getTodayWordMistakes(limit) {
    await ensureSession();
    if (!useCloud()) return local.getTodayWordMistakes(limit);
    const { data, error } = await client
      .from('daily_stats')
      .select('word_mistakes')
      .eq('user_id', userId)
      .eq('date_key', dateKey())
      .maybeSingle();
    throwIf(error);
    const todayMap = (data && data.word_mistakes) || {};
    return Object.keys(todayMap)
      .filter((w) => !window.AppUtils.isMistakeStopword(w))
      .map((w) => ({ word: w, count: todayMap[w] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit || 5);
  }

  async function getRoadmapProgress(documentId) {
    await ensureSession();
    if (!useCloud()) return local.getRoadmapProgress(documentId);
    const { data, error } = await client
      .from('roadmap_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('document_id', documentId)
      .maybeSingle();
    throwIf(error);
    return window.AppDomain.normalizeRoadmapProgress(data && {
      completedMarkIndices: data.completed_mark_indices,
      markDurations: data.mark_durations,
      updatedAt: data.updated_at,
    });
  }

  async function completeRoadmapMark(documentId, markIndex, durationMs) {
    await ensureSession();
    if (!useCloud()) return local.completeRoadmapMark(documentId, markIndex, durationMs);
    const current = await getRoadmapProgress(documentId);
    const idx = Number(markIndex);
    if (!Number.isFinite(idx) || idx < 0) return current;
    if (!current.completedMarkIndices.includes(idx)) {
      current.completedMarkIndices.push(idx);
      current.completedMarkIndices.sort((a, b) => a - b);
    }
    const ms = Number(durationMs);
    if (Number.isFinite(ms) && ms >= 0) {
      current.markDurations = current.markDurations || {};
      const prev = current.markDurations[String(idx)];
      if (prev == null || ms < prev) current.markDurations[String(idx)] = ms;
    }
    current.updatedAt = Date.now();
    const { error } = await client.from('roadmap_progress').upsert({
      user_id: userId,
      document_id: documentId,
      completed_mark_indices: current.completedMarkIndices,
      mark_durations: current.markDurations,
      updated_at: current.updatedAt,
    });
    throwIf(error, '로드맵을 저장하지 못했습니다.');
    return current;
  }

  async function listVaultSentences() {
    await ensureSession();
    if (!useCloud()) return local.listVaultSentences();
    const { data, error } = await client
      .from('vault_sentences')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    throwIf(error, '문장함을 불러오지 못했습니다.');
    return (data || []).map(vaultFromRow).filter(Boolean);
  }

  async function getVaultSentence(id) {
    await ensureSession();
    if (!useCloud()) return local.getVaultSentence(id);
    const { data, error } = await client.from('vault_sentences').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    throwIf(error);
    return data ? vaultFromRow(data) : null;
  }

  async function saveVaultSentence(item) {
    await ensureSession();
    if (!useCloud()) return local.saveVaultSentence(item);
    const record = window.AppDomain.normalizeVaultSentence({
      id: newId(),
      enText: item.enText,
      koText: item.koText,
      sourceLang: item.sourceLang,
      status: item.status || 'pending',
      translateGuidance: item.translateGuidance,
      createdAt: Date.now(),
      memorizedAt: item.status === 'memorized' ? Date.now() : null,
    });
    const { error } = await client.from('vault_sentences').insert({
      id: record.id,
      user_id: userId,
      en_text: record.enText,
      ko_text: record.koText,
      source_lang: record.sourceLang,
      status: record.status,
      translate_guidance: record.translateGuidance,
      created_at: record.createdAt,
      memorized_at: record.memorizedAt,
      updated_at: record.updatedAt,
    });
    throwIf(error, '문장함에 저장하지 못했습니다.');
    return record;
  }

  async function updateVaultSentence(id, patch) {
    await ensureSession();
    if (!useCloud()) return local.updateVaultSentence(id, patch);
    const existing = await getVaultSentence(id);
    if (!existing) return null;
    const nextStatus = patch.status != null
      ? (patch.status === 'memorized' ? 'memorized' : 'pending')
      : existing.status;
    const record = window.AppDomain.normalizeVaultSentence({
      ...existing,
      enText: patch.enText != null ? patch.enText : existing.enText,
      koText: patch.koText != null ? patch.koText : existing.koText,
      sourceLang: patch.sourceLang != null ? patch.sourceLang : existing.sourceLang,
      status: nextStatus,
      translateGuidance: patch.translateGuidance != null ? patch.translateGuidance : existing.translateGuidance,
      memorizedAt: nextStatus === 'memorized'
        ? (patch.memorizedAt != null ? patch.memorizedAt : (existing.memorizedAt || Date.now()))
        : null,
      updatedAt: Date.now(),
    });
    const { error } = await client.from('vault_sentences').update({
      en_text: record.enText,
      ko_text: record.koText,
      source_lang: record.sourceLang,
      status: record.status,
      translate_guidance: record.translateGuidance,
      memorized_at: record.memorizedAt,
      updated_at: record.updatedAt,
    }).eq('id', id).eq('user_id', userId);
    throwIf(error, '문장함을 수정하지 못했습니다.');
    return record;
  }

  async function deleteVaultSentence(id) {
    await ensureSession();
    if (!useCloud()) return local.deleteVaultSentence(id);
    const { error } = await client.from('vault_sentences').delete().eq('id', id).eq('user_id', userId);
    throwIf(error, '문장을 삭제하지 못했습니다.');
  }

  async function getSettingsRow() {
    const { data, error } = await client.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
    throwIf(error);
    return data;
  }

  async function getSingleTranslateGuidance() {
    await ensureSession();
    if (!useCloud()) return local.getSingleTranslateGuidance();
    const row = await getSettingsRow();
    return window.AppDomain.normalizeTranslateGuidance(row && row.single_translate_guidance);
  }

  async function saveSingleTranslateGuidance(guidance) {
    await ensureSession();
    if (!useCloud()) return local.saveSingleTranslateGuidance(guidance);
    const normalized = window.AppDomain.normalizeTranslateGuidance(guidance);
    const { error } = await client.from('user_settings').upsert({
      user_id: userId,
      single_translate_guidance: normalized,
    });
    throwIf(error);
    return normalized;
  }

  async function getTranslateSettings() {
    await ensureSession();
    if (!useCloud()) return local.getTranslateSettings();
    const row = await getSettingsRow();
    return window.AppDomain.normalizeTranslateSettings(row && row.translate_settings);
  }

  async function saveTranslateSettings(settings) {
    await ensureSession();
    if (!useCloud()) return local.saveTranslateSettings(settings);
    const normalized = window.AppDomain.normalizeTranslateSettings(settings);
    const { error } = await client.from('user_settings').upsert({
      user_id: userId,
      translate_settings: normalized,
    });
    throwIf(error);
    return normalized;
  }

  async function getBoaStates() {
    const { data, error } = await client.from('app_settings').select('boa_states').eq('id', 'global').maybeSingle();
    if (!error && data && data.boa_states) {
      return window.AppDomain.normalizeBoaStates(data.boa_states);
    }
    return local.getBoaStates();
  }

  async function saveBoaStates(states) {
    await ensureSession();
    const normalized = window.AppDomain.normalizeBoaStates(states);
    const payload = normalized.map((row) => ({
      name: row.name,
      min: row.min,
      imageDataUrl: row.imageDataUrl || '',
    }));
    const { error } = await client
      .from('app_settings')
      .update({ boa_states: payload, updated_at: new Date().toISOString() })
      .eq('id', 'global');
    throwIf(error, '보아 상태를 저장하지 못했습니다. 관리자 계정으로 로그인해 주세요.');
    return window.AppDomain.normalizeBoaStates(payload);
  }

  async function mergeLocalIfCloudEmpty() {
    if (!useCloud() || mergedFor === userId) return;
    mergedFor = userId;
    const { count, error } = await client
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error || count > 0) return;

    const docs = await local.listDocuments();
    for (let i = 0; i < docs.length; i++) {
      const { error: insErr } = await client.from('documents').upsert(docToRow(docs[i], userId));
      if (insErr) console.warn('[SupabaseStore] merge document', insErr);
    }
    const attempts = await local.listAttempts();
    for (let i = 0; i < attempts.length; i++) {
      const row = attemptToRow(attempts[i], userId, attempts[i].id || newId());
      const { error: insErr } = await client.from('attempts').upsert(row);
      if (insErr) console.warn('[SupabaseStore] merge attempt', insErr);
    }
    const vault = await local.listVaultSentences();
    for (let i = 0; i < vault.length; i++) {
      const v = vault[i];
      const { error: insErr } = await client.from('vault_sentences').upsert({
        id: v.id,
        user_id: userId,
        en_text: v.enText,
        ko_text: v.koText,
        source_lang: v.sourceLang,
        status: v.status,
        translate_guidance: v.translateGuidance,
        created_at: v.createdAt,
        memorized_at: v.memorizedAt,
        updated_at: v.updatedAt,
      });
      if (insErr) console.warn('[SupabaseStore] merge vault', insErr);
    }
  }

  async function onAuthSessionChange(session) {
    sessionReady = Promise.resolve(session && session.userId ? session.userId : null);
    userId = session && session.userId ? session.userId : null;
    if (userId) {
      try { await mergeLocalIfCloudEmpty(); } catch (err) {
        console.warn('[SupabaseStore] merge skipped', err);
      }
    }
    return null;
  }

  return {
    listDocuments,
    getDocument,
    saveDocument,
    updateDocument,
    deleteDocument,
    listAttempts,
    saveAttempt,
    getDailyActivity,
    recordActivity,
    getTodayDurationMs,
    recordRetry,
    getDailyRetries,
    getTodayRetryCount,
    recordMemorizedRetries,
    getDailyMemorizedRetries,
    getTodayMemorizedRetryCount,
    recordWrite,
    getDailyWrites,
    getTodayWriteCount,
    getTodaySentenceCount,
    recordWordMistake,
    getTodayWordMistakes,
    getRoadmapProgress,
    completeRoadmapMark,
    listVaultSentences,
    getVaultSentence,
    saveVaultSentence,
    updateVaultSentence,
    deleteVaultSentence,
    getSingleTranslateGuidance,
    saveSingleTranslateGuidance,
    getTranslateSettings,
    saveTranslateSettings,
    getBoaStates,
    saveBoaStates,
    onAuthSessionChange,
  };
};
