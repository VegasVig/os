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
    [/^\/materiais$/, 'Materiais e valores', 'materiais', (el) => VG.Materiais.render(el), 'materiais'],
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
    if (path.indexOf('/login') === 0 || !sess) {
      if (sess) return go(homeFor(sess));
      shellMounted = false;
      return renderLogin(path.split('/')[2]);
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
  // Arte de fundo: assets/login-fundo.jpg (se não existir, fica o fundo escuro padrão)
  // Escudo: assets/login-escudo.png
  // Tela larga o bastante para mostrar a arte inteira com os campos legíveis
  const LOGIN_ARTE = window.matchMedia('(min-width: 900px) and (min-height: 500px)');
  const LOGIN_TAGS = [
    ['camera', 'Câmeras', 'CFTV'],
    ['shield', 'Alarmes', 'Monitoramento'],
    ['lock', 'Controle de acesso', 'Portaria eletrônica'],
    ['settings', 'Automação', 'e sistemas'],
  ];
  function loginFrame(miolo) {
    return `
      <main class="lx">
        <div class="lx__bg" aria-hidden="true"></div>
        <div class="lx__wrap">
          <div class="lx__logo"><img src="assets/login-escudo.png" alt="Vegas Vigilância e Segurança" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'lx__logo-alt',innerHTML:VG.logoImg('logo--fixed-dark')}))"></div>
          ${miolo}
        </div>
        <footer class="lx__foot">
          <p class="lx__slogan">Mais que segurança,<br>é tranquilidade.</p>
          <ul class="lx__tags">${LOGIN_TAGS.map(([ic, t, st]) => `<li>${VG.icon(ic)}<span><b>${t}</b><small>${st}</small></span></li>`).join('')}</ul>
          <p class="lx__lema">Tecnologia + Pessoas = Segurança</p>
        </footer>
      </main>`;
  }

  function renderLogin(modo) {
    document.title = 'Entrar · Vegas OS';

    /* ----- Técnico: escolhe o próprio nome ----- */
    if (modo === 'tecnico') {
      app().innerHTML = loginFrame(`
        <section class="lx-card lx-card--solo">
          <div class="lx-card__head">${VG.icon('wrench')}<h2>Quem é você?</h2><span>Toque no seu nome para entrar</span></div>
          <div class="input-group lx-input" style="margin-bottom:.8rem">${VG.icon('search')}<input class="input" id="lg-busca" placeholder="Procurar meu nome" autocomplete="off"></div>
          <div class="tec-grid" id="lg-tecs"><div style="grid-column:1/-1;display:grid;place-items:center;padding:1.5rem"><span class="spinner"></span></div></div>
          <a class="lx-back" href="#/login">${VG.icon('back')}<span>Voltar</span></a>
        </section>`);
      const box = VG.$('#lg-tecs');
      let lista = [];
      const desenhar = () => {
        const q = VG.norm(VG.$('#lg-busca').value);
        const f = lista.filter((t) => !q || VG.norm(t.nome).includes(q));
        box.innerHTML = f.length ? f.map((t) => `
          <button type="button" class="tec-btn" data-id="${VG.esc(t.id)}">
            <span class="avatar">${VG.esc(VG.initials(t.nome))}</span>
            <span><b>${VG.esc(t.nome)}</b>${t.especialidade ? `<small>${VG.esc(t.especialidade)}</small>` : ''}</span>
          </button>`).join('')
          : `<p class="faint" style="grid-column:1/-1;text-align:center;margin:1rem 0">${lista.length ? 'Nenhum nome encontrado.' : 'Nenhum técnico cadastrado. Peça à supervisão para cadastrar a equipe.'}</p>`;
        VG.$$('.tec-btn', box).forEach((b) => (b.onclick = () => entrarTecnico(lista.find((t) => t.id === b.dataset.id), b)));
      };
      VG.$('#lg-busca').addEventListener('input', desenhar);
      VG.Auth.listTecnicos().then((l) => { lista = l || []; desenhar(); })
        .catch((e) => { box.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--st-red)">${VG.esc(e.message)}</p>`; });
      return;
    }

    /* ----- Tela principal: Área técnica + Supervisão ----- */
    const ult = S().read('last_tecnico', null);
    const arte = LOGIN_ARTE.matches;
    if (arte) {
      // Tela larga: a arte inteira (assets/login-fundo.jpg) é a tela; os campos e botões
      // ficam por cima dos desenhados na arte, nas mesmas posições.
      app().innerHTML = `
        <main class="lxa">
          <div class="lxa__stage">
            <a class="lxa-hot lxa-hot--tec" href="#/login/tecnico" aria-label="Entrar como técnico"></a>
            ${ult ? `<button type="button" class="lxa-cont" id="lg-cont">Continuar como <b>${VG.esc(ult.nome.split(' ')[0])}</b> ›</button>` : ''}
            <form id="login-form" novalidate autocomplete="on">
              <label for="lg-user" class="sr-only">Usuário</label>
              <input id="lg-user" class="lxa-in lxa-in--user" name="username" placeholder="Usuário" autocomplete="username" autocapitalize="none" spellcheck="false" required>
              <label for="lg-pass" class="sr-only">Senha</label>
              <input id="lg-pass" class="lxa-in lxa-in--pass" type="password" name="password" placeholder="Senha" autocomplete="current-password" required>
              <button type="button" class="lxa-eye" id="lg-eye" aria-label="Mostrar senha" title="Mostrar senha">${VG.icon('eye')}</button>
              <div class="sr-only" id="lg-err" role="alert"></div>
              <button type="submit" class="lxa-hot lxa-hot--ent" id="lg-btn" aria-label="Entrar"><span class="lxa-busy"></span></button>
            </form>
          </div>
        </main>`;
    } else app().innerHTML = loginFrame(`
      <div class="lx-cards">
        <section class="lx-card">
          <div class="lx-card__head">
            <svg class="lx-card__ico" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M29.5 8.5a8 8 0 0 0-9.8 10.3L7.5 31a3.5 3.5 0 0 0 5 5l12.2-12.2A8 8 0 0 0 35 14l-4.6 4.6-4.2-.8-.8-4.2z"/><path d="M26 30l9.5 9.5a3 3 0 0 0 4.2-4.2L30.2 25.8M38 6l4 4-5 6-3-1-8 8M18 18l-7-7 2-5-4-2-3 3 2 4 5-1"/></svg>
            <h2>Área técnica</h2><span>Acesso sem senha</span>
          </div>
          <p class="lx-card__txt">Acesso direto ao sistema<br>para uso técnico e operacional.</p>
          <div class="lx-card__foot">
            ${ult ? `<button type="button" class="lx-cont" id="lg-cont"><span class="avatar">${VG.esc(VG.initials(ult.nome))}</span><span><small>Continuar como</small><b>${VG.esc(ult.nome)}</b></span>${VG.icon('chevron')}</button>` : ''}
            <a class="lx-btn" href="#/login/tecnico">${VG.icon('chevron')}<span>Entrar como técnico</span></a>
          </div>
        </section>

        <section class="lx-card">
          <div class="lx-card__head">
            <span class="lx-card__ico lx-card__ico--sup">${VG.icon('user')}${VG.icon('lock')}</span>
            <h2>Supervisão</h2><span>Usuário e senha</span>
          </div>
          <p class="lx-card__txt">Acesso restrito para supervisores.<br>Informe seu usuário e senha.</p>
          <form id="login-form" class="lx-card__foot" novalidate autocomplete="on">
            <div class="input-group lx-input">${VG.icon('user')}<label for="lg-user" class="sr-only">Usuário</label><input id="lg-user" class="input" name="username" placeholder="Usuário" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
            <div class="input-group lx-input">${VG.icon('lock')}<label for="lg-pass" class="sr-only">Senha</label><input id="lg-pass" class="input" type="password" name="password" placeholder="Senha" autocomplete="current-password" required style="padding-right:2.9rem">
              <button type="button" class="btn btn-ghost btn-icon pw-toggle" id="lg-eye" aria-label="Mostrar senha" title="Mostrar senha">${VG.icon('eye')}</button></div>
            <div class="login__error" id="lg-err" role="alert"></div>
            <button type="submit" class="lx-btn" id="lg-btn">${VG.icon('lock')}<span>Entrar</span></button>
          </form>
        </section>
      </div>`);
    // ao girar o tablet / redimensionar a janela, troca de versão
    LOGIN_ARTE.onchange = () => { if (/^#\/login(\/supervisora)?$|^#?$/.test(location.hash || '#/login') && !VG.Auth.current()) renderLogin(modo); };
    const c = VG.$('#lg-cont');
    if (c) c.onclick = () => entrarTecnico(ult, c);

    const user = VG.$('#lg-user'), pass = VG.$('#lg-pass'), err = VG.$('#lg-err'), eye = VG.$('#lg-eye');
    const last = S().read('last_user', '');
    if (last) user.value = last;
    if (modo === 'supervisora') (last ? pass : user).focus();
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
      if (!user.value.trim() || !pass.value) { err.textContent = 'Informe usuário e senha.'; if (arte) { VG.toast('Informe usuário e senha.', 'warn'); (user.value.trim() ? pass : user).focus(); } return; }
      const btn = VG.$('#lg-btn');
      VG.setBusy(btn, true, 'Entrando…');
      (async () => {
        const r = await VG.Auth.login(user.value.trim(), pass.value);
        if (!r.ok) {
          VG.setBusy(btn, false);
          err.textContent = r.erro;
          if (arte) VG.toast(r.erro, 'error', 5000);
          pass.value = ''; pass.focus();
          btn.closest('.lx-card, .lxa__stage').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 260 });
          return;
        }
        if (r.session.papel === 'tecnico') S().write('last_tecnico', { id: r.session.tecnicoId, nome: r.session.nome });
        else S().write('last_user', r.session.usuario);
        VG.toast(`Bem-vinda(o), ${r.session.nome.split(' ')[0]}.`, 'success');
        shellMounted = false;
        go(homeFor(r.session));
      })();
    };
  }

  async function entrarTecnico(t, btn) {
    if (!t) return;
    if (!(await VG.confirm(`Entrar como <strong>${VG.esc(t.nome)}</strong>?`, { title: 'Confirmar técnico', ok: 'Sou eu, entrar', html: true }))) return;
    VG.setBusy(btn, true);
    const r = await VG.Auth.loginTecnico(t.id);
    if (!r.ok) {
      VG.setBusy(btn, false);
      if (/inativo|não encontrado/i.test(r.erro)) S().write('last_tecnico', null);
      VG.toast(r.erro, 'error', 6000);
      return;
    }
    VG.toast(`Olá, ${r.session.nome.split(' ')[0]}!`, 'success');
    shellMounted = false;
    go('#/minhas-os');
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
    const ativas = ordens.filter((o) => !VG.ENCERRADAS.includes(o.status)).length;
    return `
      <div class="nav__group">Operação</div>
      ${item('dashboard', '#/dashboard', 'grid', 'Dashboard')}
      ${item('os', '#/os', 'os', 'Ordens de Serviço', ativas)}
      ${item('nova', '#/os/nova', 'plus', 'Nova OS')}
      <div class="nav__group">Cadastros</div>
      ${item('clientes', '#/clientes', 'users', 'Clientes', S().list('clientes').length)}
      ${item('tecnicos', '#/tecnicos', 'shield', 'Técnicos')}
      ${item('materiais', '#/materiais', 'box', 'Materiais', S().list('materiais').filter((m) => m.ativo !== false).length)}
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
      const antes = new Set(VG.Store.list('ordens').map((o) => o.id));
      const devAntes = new Set(VG.Store.list('ordens').filter((o) => o.devolucao).map((o) => o.id + '|' + o.devolucao.em));
      await VG.Auth.restore();
      if (sess.papel === 'tecnico') {
        const novas = VG.Store.list('ordens').filter((o) => !antes.has(o.id) && o.tecnicoId === sess.tecnicoId && !VG.isConcluida(o.status));
        if (novas.length) {
          const urg = novas.some((o) => o.prioridade === 'urgente');
          VG.toast(novas.length === 1 ? `Nova OS #${novas[0].numero}${urg ? ' — URGENTE' : ''}: ${novas[0].cliente.nome}` : `${novas.length} novas OS recebidas${urg ? ' (há urgente)' : ''}.`, urg ? 'warn' : 'info', 8000);
          try { navigator.vibrate && navigator.vibrate(urg ? [200, 100, 200] : 150); } catch (e) {}
        }
        // OS reaberta pela supervisão para completar
        VG.Store.list('ordens').filter((o) => o.devolucao && o.tecnicoId === sess.tecnicoId && antes.has(o.id) && !devAntes.has(o.id + '|' + o.devolucao.em))
          .forEach((o) => {
            VG.toast(`OS #${o.numero} reaberta pela supervisão: ${o.devolucao.motivo}`, 'warn', 9000);
            try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
          });
      }
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
