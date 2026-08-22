/* ==========================================================================
   AppLogin — login / signup screen
   ========================================================================== */

window.AppLogin = (function () {
  'use strict';

  function setStatus(ctx, message, isError) {
    const el = ctx.el.loginStatus;
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
  }

  async function render(ctx) {
    setStatus(ctx, '');
    const session = await window.AppAuth.getSession();
    if (session && ctx.el.loginHeading) {
      ctx.el.loginHeading.textContent = '로그인됨';
      if (ctx.el.loginSubtitle) {
        ctx.el.loginSubtitle.textContent = `${session.email} · ${session.role}`;
      }
    } else if (ctx.el.loginHeading) {
      ctx.el.loginHeading.textContent = '로그인';
      if (ctx.el.loginSubtitle) {
        ctx.el.loginSubtitle.textContent = '기기 간 동기화를 위해 로그인하세요. 지금은 이 브라우저에만 저장됩니다.';
      }
    }
  }

  async function submitLogin(ctx) {
    const email = ctx.el.loginEmail && ctx.el.loginEmail.value;
    const password = ctx.el.loginPassword && ctx.el.loginPassword.value;
    setStatus(ctx, '로그인 중…');
    try {
      await window.AppAuth.signInEmail(email, password);
      setStatus(ctx, '로그인했어요.');
      if (ctx.refreshAccountUi) ctx.refreshAccountUi();
      await ctx.showScreen('home');
    } catch (err) {
      setStatus(ctx, (err && err.message) || '로그인에 실패했습니다.', true);
    }
  }

  async function submitSignup(ctx) {
    const email = ctx.el.loginEmail && ctx.el.loginEmail.value;
    const password = ctx.el.loginPassword && ctx.el.loginPassword.value;
    setStatus(ctx, '가입 중…');
    try {
      await window.AppAuth.signUpEmail(email, password);
      setStatus(ctx, '가입했어요.');
      if (ctx.refreshAccountUi) ctx.refreshAccountUi();
      await ctx.showScreen('home');
    } catch (err) {
      setStatus(ctx, (err && err.message) || '가입에 실패했습니다.', true);
    }
  }

  return { render, submitLogin, submitSignup, setStatus };
})();
