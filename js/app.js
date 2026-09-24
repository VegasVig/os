/* =========================================================
   VEGAS OS — APLICAÇÃO
   Tema, roteador (hash), login, layout (menu lateral + topo)
   e controle de acesso por papel.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;
  const app = () => document.getElementById('app');

  /* ---------- TEMA ---------- */
  const Theme = {
    get: () => S().getTheme(),
    apply(t) {
      const root = document.documentElement;
      root.classList.add('theme-anim');
      root.setAttribute('data-theme', t);
      const meta = document.querySelector('meta[name=theme-color]');
      if (meta) meta.setAttribute('content', t === 'light' ? '#f3f4f6' : '#000000');
      clearTimeout(Theme._t);
      Theme._t = setTimeout(() => root.classList.remove('theme-anim'), 450);
      VG.$$('[data-theme-toggle]').forEach((b) => (b.innerHTML = Theme.label(t, b.dataset.compact === '1')));
    },
    set(t) { S().setTheme(t); Theme.apply(t); },
    toggle() { Theme.set(Theme.get() === 'dark' ? 'light' : 'dark'); },
    label(t, compact) {
      const dark = t === 'dark';
      // mostra a ação disponível
      return compact ? `<span aria-hidden="true">${dark ? '☀️' : '🌙'}</span><span class="sr-only">${dark ? 'Modo claro' : 'Modo escuro'}</span>`
        : `<span aria-hidden="true">${dark ? '☀️' : '🌙'}</span><span>${dark ? 'Modo claro' : 'Modo escuro'}</span>`;
    },
    button(compact = false) {
      return `<button type="button" class="btn ${compact ? 'btn-ghost btn-icon' : 'btn-sm'} theme-toggle" data-theme-toggle data-compact="${compact ? 1 : 0}" title="Alternar tema" aria-label="Alternar modo claro/escuro">${Theme.label(Theme.get(), compact)}</button>`;
    },
    bind(root) { VG.$$('[data-theme-toggle]', root).forEach((b) => (b.onclick = Theme.toggle)); },
  };
  VG.Theme = Theme;

  /* ---------- ROTEAMENTO ---------- */
  function parseHash() {
    const raw = (location.hash || '#/').slice(1) || '/';
    const [path, qs] = raw.split('?');
    const params = {};
    new URLSearchParams(qs || '').forEach((v, k) => (params[k] = v));
    const parts = path.split('/').filter(Boolean);
    return { path: '/' + parts.join('/'), parts, params };
  }

  // [padrão, título, permissão, render(el, match, params), item de menu ativo]
  const ROUTES = [
    [/^\/dashboard$/, 'Dashboard', 'dashboard', (el) => VG.Dashboard.render(el), 'dashboard'],
    [/^\/os$/, 'Ordens de serviço', 'os.todas', (el, m, p) => VG.OS.renderList(el, p), 'os'],
    [/^\/os\/nova$/, 'Nova OS', 'os.criar', (el, m, p) => VG.OS.renderForm(el, null, p), 'nova'],
    [/^\/os\/editar\/([\w-]+)$/, 'Editar OS', 'os.editar', (el, m) => VG.OS.renderForm(el, m[1]), 'os'],
    [/^\/os\/ver\/([\w-]+)$/, 'Detalhe da OS', 'os.todas', (el, m) => VG.OS.renderDetail(el, m[1]), 'os'],
    [/^\/clientes$/, 'Clientes', 'clientes', (el) => VG.Clientes.render(el), 'clientes'],
    [/^\/tecnicos$/, 'Técnicos', 'tecnicos', (el) => VG.Tecnicos.render(el), 'tecnicos'],
    [/^\/relatorios$/, 'Relatórios', 'relatorios', (el) => VG.Relatorios.render(el), 'relatorios'],
    [/^\/configuracoes$/, 'Configurações', 'config', (el) => VG.Configuracoes.render(el), 'config'],
    [/^\/minhas-os$/, 'Minhas OS', 'os.proprias', (el) => VG.OS.renderMinhas(el), 'minhas'],
    [/^\/atendimento\/([\w-]+)$/, 'Atendimento', 'atendimento', (el, m) => atendimentoLogado(el, m[1]), 'minhas'],
  ];
  const PUBLIC_LINK = /^\/os\/(\d+)\/([A-Za-z0-9]+)$/;

  let routeSeq = 0;
  const bootHTML = (txt) => `<div class="boot">${VG.logoImg('boot__logo')}<span class="spinner"></span><span class="boot__txt">${VG.esc(txt)}</span></div>`;
  const homeFor = (s) => (s && s.papel === 'tecnico' ? '#/minhas-os' : '#/dashboard');

  function route() {
    closeDrawer();
    VG.Portal && VG.Portal.cleanup();
    document.getElementById('modal-root').innerHTML = '';
    const { path, params } = parseHash();
    const sess = VG.Auth.current();

    // 1) Link exclusivo da OS (técnico/cliente) — não exige login; validado no servidor
    const pub = path.match(PUBLIC_LINK);
    if (pub) {
      shellMounted = false;
      const seq = ++routeSeq;
      app().innerHTML = bootHTML('Abrindo ordem de serviço…');
      VG.Auth.resolveLink(pub[1], pub[2]).then((r) => {
        if (seq !== routeSeq) return;
        document.title = r.os ? `OS #${r.os.numero} · Vegas` : 'Link da OS · Vegas';
        if (r.erro) return VG.Portal.renderErro(app(), r.erro);
        VG.Portal.render(app(), r.os.id, r.papel);
      });
      return;
    }
    routeSeq++;
    if (VG.Store.isPublic()) {
      VG.Store.setPublic(null);
      // ao sair de um link público sem login, os dados daquela OS não ficam na memória
      if (!sess) VG.Store.clear();
    }

    // 2) Login
    if (path === '/login' || !sess) {
      if (sess) return go(homeFor(sess));
      shellMounted = false;
      return renderLogin();
    }

    // 3) Rotas internas
    if (path === '/' || path === '') return go(homeFor(sess));
    for (const [re, title, perm, fn, nav] of ROUTES) {
      const m = path.match(re);
      if (!m) continue;
      if (!VG.Auth.can(perm)) return go(homeFor(sess));
      const el = mountShell(sess);
      setActive(nav, title);
      window.scrollTo(0, 0);
      try { fn(el, m, params); }
      catch (err) {
        console.error(err);
        el.innerHTML = VG.empty('alert', 'Algo deu errado', 'Não foi possível abrir esta tela. Recarregue a página e tente novamente.', `<a class="btn" href="${homeFor(sess)}">Voltar ao início</a>`);
      }
      return;
    }
    go(homeFor(sess));
  }
  function go(hash) { if (location.hash !== hash) location.hash = hash; else route(); }

  function atendimentoLogado(el, id) {
    const sess = VG.Auth.current();
    const os = S().get('ordens', id);
    if (!os || os.tecnicoId !== sess.tecnicoId) {
      el.innerHTML = VG.empty('lock', 'OS não disponível', 'Esta ordem de serviço não está atribuída a você.', '<a class="btn" href="#/minhas-os">Minhas OS</a>');
      return;
    }
    VG.Portal.render(el, id, 'tecnico', { embedded: true });
  }

  /* ---------- LOGIN ---------- */
  function renderLogin() {
    document.title = 'Entrar · Vegas OS';
    app().innerHTML = `
      <main class="login">
        <div class="login__card">
          <div class="login__logo">${VG.logoImg('logo--fixed-dark')}</div>
          <p class="login__title">Controle de Ordens de Serviço</p>
          <form id="login-form" novalidate autocomplete="on">
            <div class="field"><label for="lg-user">Usuário</label>
              <div class="input-group">${VG.icon('user')}<input id="lg-user" class="input" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div></div>
            <div class="field"><label for="lg-pass">Senha</label>
              <div class="input-group">${VG.icon('lock')}<input id="lg-pass" class="input" type="password" name="password" autocomplete="current-password" required style="padding-right:2.9rem">
                <button type="button" class="btn btn-ghost btn-icon pw-toggle" id="lg-eye" aria-label="Mostrar senha" title="Mostrar senha">${VG.icon('eye')}</button></div></div>
            <div class="login__error" id="lg-err" role="alert"></div>
            <button type="submit" class="btn btn-primary btn-lg" id="lg-btn">${VG.icon('lock')}<span>Entrar</span></button>
          </form>
          <div class="login__foot">${VG.icon('shield')}<span>Acesso restrito · ${VG.esc(S().getConfig().empresa.nome)}</span></div>
        </div>
      </main>`;
    const user = VG.$('#lg-user'), pass = VG.$('#lg-pass'), err = VG.$('#lg-err'), eye = VG.$('#lg-eye');
    const last = S().read('last_user', '');
    if (last) { user.value = last; pass.focus(); } else user.focus();
    eye.onclick = () => {
      const show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      eye.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      eye.title = show ? 'Ocultar senha' : 'Mostrar senha';
      eye.style.opacity = show ? '1' : '.7';
      pass.focus();
    };
    VG.$('#login-form').onsubmit = (e) => {
      e.preventDefault();
      err.textContent = '';
      if (!user.value.trim() || !pass.value) { err.textContent = 'Informe usuário e senha.'; return; }
      const btn = VG.$('#lg-btn');
      VG.setBusy(btn, true, 'Entrando…');
      (async () => {
        const r = await VG.Auth.login(user.value.trim(), pass.value);
        if (!r.ok) {
          VG.setBusy(btn, false);
          err.textContent = r.erro;
          pass.value = ''; pass.focus();
          VG.$('.login__card').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 260 });
          return;
        }
        S().write('last_user', r.session.usuario);
        VG.toast(`Bem-vinda(o), ${r.session.nome.split(' ')[0]}.`, 'success');
        shellMounted = false;
        go(homeFor(r.session));
      })();
    };
  }

  /* ---------- SHELL ---------- */
  let shellMounted = false;

  function navHTML(sess) {
    const ordens = S().list('ordens');
    const item = (key, href, icon, label, count) =>
      `<a class="nav-item" data-nav="${key}" href="${href}">${VG.icon(icon)}<span>${label}</span>${count ? `<span class="count">${count}</span>` : ''}</a>`;
    if (sess.papel === 'tecnico') {
      const pend = ordens.filter((o) => o.tecnicoId === sess.tecnicoId && ['aguardando_tecnico', 'em_atendimento', 'aberta'].includes(o.status)).length;
      return `<div class="nav__group">Atendimentos</div>${item('minhas', '#/minhas-os', 'wrench', 'Minhas OS', pend)}`;
    }
    const ativas = ordens.filter((o) => !['concluida', 'cancelada'].includes(o.status)).length;
    return `
      <div class="nav__group">Operação</div>
      ${item('dashboard', '#/dashboard', 'grid', 'Dashboard')}
      ${item('os', '#/os', 'os', 'Ordens de Serviço', ativas)}
      ${item('nova', '#/os/nova', 'plus', 'Nova OS')}
      <div class="nav__group">Cadastros</div>
      ${item('clientes', '#/clientes', 'users', 'Clientes', S().list('clientes').length)}
      ${item('tecnicos', '#/tecnicos', 'shield', 'Técnicos')}
      <div class="nav__group">Gestão</div>
      ${item('relatorios', '#/relatorios', 'chart', 'Relatórios')}
      ${item('config', '#/configuracoes', 'settings', 'Configurações')}`;
  }

  function mountShell(sess) {
    if (!shellMounted || !VG.$('#content')) {
      app().innerHTML = `
        <div class="shell">
          <aside class="sidebar" id="sidebar" aria-label="Menu principal">
            <div class="sidebar__brand">${VG.logoImg()}<small>Controle de Ordens de Serviço</small></div>
            <nav class="nav" id="nav"></nav>
            <div class="sidebar__foot">
              <div class="user-chip">
                <div class="avatar">${VG.esc(VG.initials(sess.nome))}</div>
                <div style="min-width:0"><div class="user-chip__name">${VG.esc(sess.nome)}</div><div class="user-chip__role">${VG.esc(VG.Auth.papelLabel(sess.papel))}</div></div>
              </div>
              <div class="sidebar__actions">
                ${Theme.button(false)}
                <button class="btn btn-sm" id="btn-logout">${VG.icon('logout')}<span>Sair</span></button>
              </div>
            </div>
          </aside>
          <div class="overlay" id="overlay"></div>
          <div class="main">
            <header class="topbar">
              <button class="btn btn-ghost btn-icon topbar__menu" id="btn-menu" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded="false">${VG.icon('menu')}</button>
              <h2 class="topbar__title" id="topbar-title"></h2>
              ${sess.papel === 'supervisora' ? `<form class="topbar__search" id="gsearch" role="search"><div class="input-group">${VG.icon('search')}<input class="input" id="gsearch-q" placeholder="Pesquisar OS, cliente, CPF/CNPJ…" aria-label="Pesquisa rápida"></div></form>` : '<span style="margin-left:auto"></span>'}
              ${Theme.button(true)}
            </header>
            <main class="content" id="content"></main>
          </div>
        </div>`;
      Theme.bind(app());
      VG.$('#btn-logout').onclick = async () => {
        if (!(await VG.confirm('Deseja sair do sistema?', { title: 'Sair', ok: 'Sair' }))) return;
        VG.Auth.logout();
        location.hash = '#/login';
      };
      VG.$('#btn-menu').onclick = openDrawer;
      VG.$('#overlay').onclick = closeDrawer;
      const gs = VG.$('#gsearch');
      if (gs) gs.onsubmit = (e) => {
        e.preventDefault();
        const q = VG.$('#gsearch-q').value.trim();
        location.hash = q ? '#/os?q=' + encodeURIComponent(q) : '#/os';
        VG.$('#gsearch-q').blur();
      };
      shellMounted = true;
    }
    VG.$('#nav').innerHTML = navHTML(sess);
    return VG.$('#content');
  }

  function setActive(nav, title) {
    VG.$$('.nav-item').forEach((a) => {
      const on = a.dataset.nav === nav;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const t = VG.$('#topbar-title');
    if (t) t.textContent = title;
    document.title = `${title} · Vegas OS`;
  }

  function openDrawer() {
    VG.$('#sidebar') && VG.$('#sidebar').classList.add('open');
    VG.$('#overlay') && VG.$('#overlay').classList.add('show');
    const b = VG.$('#btn-menu'); if (b) b.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    const sb = VG.$('#sidebar'); if (sb) sb.classList.remove('open');
    const ov = VG.$('#overlay'); if (ov) ov.classList.remove('show');
    const b = VG.$('#btn-menu'); if (b) b.setAttribute('aria-expanded', 'false');
  }

  /* ---------- INIT ---------- */
  async function sincronizar(forcar) {
    const sess = VG.Auth.current();
    if (!sess || VG.Store.isPublic()) return;
    if (!forcar) {
      if (document.hidden || VG.Store.pendentes() > 0) return;
      if (document.querySelector('.modal-backdrop, .sigpad')) return;
      const a = document.activeElement;
      if (a && a.matches && a.matches('input, textarea, select')) return;
    }
    try {
      const rev = await VG.Store.call('rev', {}, { silencioso: true });
      if (rev === VG.Store.rev() && !forcar) return;
      await VG.Auth.restore();
      if (!document.querySelector('.modal-backdrop, .sigpad') && VG.Store.pendentes() === 0) { shellMounted = false; route(); }
    } catch (e) {
      if (!VG.Auth.current()) { location.hash = '#/login'; route(); }
    }
  }

  async function init() {
    Theme.apply(Theme.get());
    const cfgApi = window.VG_CONFIG && window.VG_CONFIG.API_URL;
    if (window.VG_CONFIG && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(String(cfgApi || '').trim())) {
      app().innerHTML = `<div class="boot" style="padding:1.5rem;text-align:center">${VG.logoImg('boot__logo')}
        <h2 style="color:#fff;font-size:1.1rem;margin:0">Falta configurar o servidor</h2>
        <p style="max-width:460px;margin:0;line-height:1.5">Abra o arquivo <code>js/config.js</code> no GitHub e cole o endereço do App da Web do Apps Script (termina em <code>/exec</code>). Veja o passo a passo no LEIA-ME.</p></div>`;
      return;
    }
    app().innerHTML = bootHTML('Carregando…');
    // links externos (telefone, e-mail) fora do quadro do Apps Script
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
      if (a) { e.preventDefault(); window.open(a.getAttribute('href'), '_blank'); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

    const boot = window.VG_BOOT || {};
    if (boot.os && boot.t) {
      // aberto por link exclusivo: ?os=1045&t=TOKEN
      history.replaceState(null, '', location.pathname + (window.VG_CONFIG && window.VG_CONFIG.API_URL ? '' : location.search) + `#/os/${boot.os}/${boot.t}`);
    } else if (VG.Auth.current()) {
      try { await VG.Auth.restore(); }
      catch (e) { if (!/sess|acesso/i.test(e.message)) VG.toast(e.message, 'error', 7000); }
    }
    window.addEventListener('hashchange', route);
    setInterval(() => sincronizar(false), 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(false); });
    route();
  }

  function refresh() { shellMounted = false; route(); }

  VG.App = { init, route, refresh, go, sincronizar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
