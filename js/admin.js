/* ==========================================================================
   AppAdmin — users + boa growth states (admin only)
   ========================================================================== */

window.AppAdmin = (function () {
  'use strict';

  let boaDraft = [];

  function esc(text) {
    return window.AppUtils.escapeHtml(String(text == null ? '' : text));
  }

  function setStatusEl(el, message, isError) {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.classList.remove('is-error');
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
  }

  function setStatus(ctx, message, isError) {
    setStatusEl(ctx.el.adminStatus, message, isError);
  }

  function setBoaStatus(ctx, message, isError) {
    setStatusEl(ctx.el.adminBoaStatus, message, isError);
  }

  function formatDate(ms) {
    if (!ms) return '—';
    try {
      return new Date(ms).toLocaleDateString('ko-KR');
    } catch (_) {
      return '—';
    }
  }

  function rangeLabel(row, index, total) {
    if (index === total - 1) return `${row.min}+ WPM`;
    return `${row.min}–${row.max} WPM`;
  }

  function renderBoaList(ctx) {
    const listEl = ctx.el.adminBoaList;
    if (!listEl) return;
    const rows = boaDraft;
    listEl.innerHTML = rows.map((row, i) => {
      const hasImage = !!row.imageDataUrl;
      const minDisabled = i === 0 ? ' disabled' : '';
      return `
      <article class="admin-boa-row" data-boa-index="${i}" id="admin-boa-row-${i + 1}">
        <div class="admin-boa-preview-wrap" id="admin-boa-preview-wrap-${i + 1}">
          <div class="admin-boa-preview-shapes" id="admin-boa-preview-shapes-${i + 1}" data-tier="${i + 1}" aria-hidden="true">
            <span class="admin-boa-preview-body"></span>
            <span class="admin-boa-preview-head"></span>
          </div>
        </div>
        <div class="admin-boa-fields">
          <p class="admin-boa-row-label">상태 ${i + 1} · ${esc(rangeLabel(row, i, rows.length))}</p>
          <label class="admin-boa-field" for="admin-boa-name-${i + 1}">이름
            <input type="text" id="admin-boa-name-${i + 1}" class="admin-boa-name" data-boa-index="${i}" value="${esc(row.name)}" maxlength="24" autocomplete="off">
          </label>
          <label class="admin-boa-field" for="admin-boa-min-${i + 1}">이 상태부터 (WPM)
            <input type="number" id="admin-boa-min-${i + 1}" class="admin-boa-min" data-boa-index="${i}" value="${row.min}" min="0" step="1"${minDisabled}>
          </label>
          <div class="admin-boa-image-row">
            <input type="file" class="admin-boa-file" id="admin-boa-file-${i + 1}" data-boa-index="${i}" accept="image/*" hidden>
            <button type="button" class="btn btn-secondary btn-small admin-boa-pick" data-boa-index="${i}" id="btn-admin-boa-pick-${i + 1}">이미지 올리기</button>
            <button type="button" class="btn btn-ghost btn-small admin-boa-clear" data-boa-index="${i}" id="btn-admin-boa-clear-${i + 1}" ${hasImage ? '' : 'hidden'}>이미지 지우기</button>
          </div>
        </div>
      </article>`;
    }).join('');
    rows.forEach((_, i) => updateBoaPreview(ctx, i));
  }

  function readBoaForm(ctx) {
    const listEl = ctx.el.adminBoaList;
    if (!listEl || !boaDraft.length) return boaDraft;
    boaDraft.forEach((row, i) => {
      const nameInput = listEl.querySelector(`#admin-boa-name-${i + 1}`);
      const minInput = listEl.querySelector(`#admin-boa-min-${i + 1}`);
      if (nameInput) row.name = nameInput.value;
      if (minInput && i > 0) row.min = minInput.value;
    });
    boaDraft = window.AppDomain.normalizeBoaStates(boaDraft);
    return boaDraft;
  }

  function updateBoaPreview(ctx, index) {
    const row = boaDraft[index];
    if (!row) return;
    const wrap = ctx.el.adminBoaList && ctx.el.adminBoaList.querySelector(`#admin-boa-preview-wrap-${index + 1}`);
    const shapes = ctx.el.adminBoaList && ctx.el.adminBoaList.querySelector(`#admin-boa-preview-shapes-${index + 1}`);
    const clearBtn = ctx.el.adminBoaList && ctx.el.adminBoaList.querySelector(`#btn-admin-boa-clear-${index + 1}`);
    const hasImage = !!row.imageDataUrl;
    if (wrap) {
      let img = wrap.querySelector('#admin-boa-preview-' + (index + 1));
      if (hasImage) {
        if (!img) {
          img = document.createElement('img');
          img.className = 'admin-boa-preview-img';
          img.id = 'admin-boa-preview-' + (index + 1);
          img.alt = '';
          wrap.insertBefore(img, wrap.firstChild);
        }
        img.src = row.imageDataUrl;
      } else if (img) {
        img.remove();
      }
    }
    if (shapes) shapes.hidden = hasImage;
    if (clearBtn) clearBtn.hidden = !hasImage;
  }

  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('파일을 선택해 주세요.'));
        return;
      }
      if (!String(file.type || '').startsWith('image/')) {
        reject(new Error('이미지 파일만 올릴 수 있어요.'));
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('이미지를 읽지 못했어요.'));
      };
      img.src = url;
    });
  }

  function compressBoaImage(img) {
    const max = 512;
    const scale = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    let data = canvas.toDataURL('image/png');
    if (data.length > 360000) {
      data = canvas.toDataURL('image/webp', 0.84);
    }
    if (!data.startsWith('data:image/') || data.length > 420000) {
      ctx.fillStyle = '#1C2D48';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      data = canvas.toDataURL('image/jpeg', 0.82);
    }
    return data;
  }

  async function onBoaFileChange(ctx, index, file) {
    setBoaStatus(ctx, '이미지를 준비하는 중…');
    try {
      const img = await loadImageFile(file);
      const dataUrl = compressBoaImage(img);
      readBoaForm(ctx);
      boaDraft[index].imageDataUrl = dataUrl;
      updateBoaPreview(ctx, index);
      setBoaStatus(ctx, '이미지를 담았어요. 저장을 눌러 반영하세요.');
    } catch (err) {
      setBoaStatus(ctx, (err && err.message) || '이미지를 올리지 못했어요.', true);
    }
  }

  async function saveBoa(ctx) {
    setBoaStatus(ctx, '저장 중…');
    try {
      const next = readBoaForm(ctx);
      const saved = await window.AppStorage.saveBoaStates(next);
      boaDraft = saved;
      if (window.AppTiers.refresh) await window.AppTiers.refresh();
      renderBoaList(ctx);
      setBoaStatus(ctx, '보아뱀 상태를 저장했습니다.');
    } catch (err) {
      setBoaStatus(ctx, (err && err.message) || '저장에 실패했습니다.', true);
    }
  }

  async function resetBoa(ctx) {
    const ok = await window.AppDialog.confirm('보아뱀 이름·기준·이미지를 처음 값으로 되돌릴까요?', {
      title: '기본값으로',
      okLabel: '되돌리기',
      cancelLabel: '취소',
    });
    if (!ok) return;
    setBoaStatus(ctx, '저장 중…');
    try {
      const saved = await window.AppStorage.saveBoaStates(window.AppDomain.DEFAULT_BOA_STATES);
      boaDraft = saved;
      if (window.AppTiers.refresh) await window.AppTiers.refresh();
      renderBoaList(ctx);
      setBoaStatus(ctx, '기본값으로 되돌렸습니다.');
    } catch (err) {
      setBoaStatus(ctx, (err && err.message) || '되돌리기에 실패했습니다.', true);
    }
  }

  async function renderUsers(ctx) {
    setStatus(ctx, '');
    const listEl = ctx.el.adminUserList;
    const emptyEl = ctx.el.adminEmpty;
    if (!listEl) return;

    let users = [];
    try {
      users = await window.AppAuth.listUsers();
    } catch (err) {
      setStatus(ctx, (err && err.message) || '목록을 불러오지 못했습니다.', true);
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    if (!users.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    listEl.innerHTML = users.map((u) => `
      <div class="admin-user-row" data-user-id="${esc(u.userId)}">
        <div class="admin-user-meta">
          <span class="admin-user-email">${esc(u.email)}</span>
          <span class="admin-user-date">${esc(formatDate(u.createdAt))}</span>
        </div>
        <label class="admin-role-label">
          <span class="sr-only">역할</span>
          <select class="admin-role-select" data-user-id="${esc(u.userId)}" aria-label="${esc(u.email)} 역할">
            <option value="user"${u.role === 'user' ? ' selected' : ''}>user</option>
            <option value="admin"${u.role === 'admin' ? ' selected' : ''}>admin</option>
          </select>
        </label>
      </div>
    `).join('');
  }

  async function render(ctx) {
    setStatus(ctx, '');
    setBoaStatus(ctx, '');
    const session = await window.AppAuth.getSession();
    if (!window.AppAuth.isAdmin(session)) {
      await ctx.showScreen('home', { replace: true });
      return;
    }

    try {
      boaDraft = await window.AppStorage.getBoaStates();
    } catch (_) {
      boaDraft = window.AppDomain.normalizeBoaStates(null);
    }
    renderBoaList(ctx);
    await renderUsers(ctx);
  }

  async function onRoleChange(ctx, userId, role) {
    setStatus(ctx, '저장 중…');
    try {
      await window.AppAuth.setUserRole(userId, role);
      setStatus(ctx, '역할을 저장했습니다.');
      if (ctx.refreshAccountUi) ctx.refreshAccountUi();
      await renderUsers(ctx);
    } catch (err) {
      setStatus(ctx, (err && err.message) || '역할 변경에 실패했습니다.', true);
      await renderUsers(ctx);
    }
  }

  function onBoaListClick(ctx, e) {
    const pick = e.target.closest && e.target.closest('.admin-boa-pick');
    if (pick) {
      const index = Number(pick.dataset.boaIndex);
      const file = ctx.el.adminBoaList.querySelector(`#admin-boa-file-${index + 1}`);
      if (file) file.click();
      return;
    }
    const clear = e.target.closest && e.target.closest('.admin-boa-clear');
    if (clear) {
      const index = Number(clear.dataset.boaIndex);
      readBoaForm(ctx);
      if (boaDraft[index]) boaDraft[index].imageDataUrl = '';
      const file = ctx.el.adminBoaList.querySelector(`#admin-boa-file-${index + 1}`);
      if (file) file.value = '';
      updateBoaPreview(ctx, index);
      setBoaStatus(ctx, '이미지를 지웠어요. 저장을 눌러 반영하세요.');
    }
  }

  function onBoaListChange(ctx, e) {
    const file = e.target.closest && e.target.closest('.admin-boa-file');
    if (!file) return;
    const index = Number(file.dataset.boaIndex);
    const picked = file.files && file.files[0];
    file.value = '';
    if (picked) onBoaFileChange(ctx, index, picked);
  }

  return {
    render,
    onRoleChange,
    setStatus,
    saveBoa,
    resetBoa,
    onBoaListClick,
    onBoaListChange,
  };
})();
