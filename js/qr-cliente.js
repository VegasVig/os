/* =========================================================
   VEGAS OS — QR CODE DO CLIENTE
   Supervisão gera a etiqueta; quem lê vê a última manutenção,
   o local da central e o acesso remoto (PIN ou supervisora logada).
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;
  const LIB = 'js/vendor/qrcode.js';
  const TEMPO_TELA_MS = 5 * 60 * 1000;

  let libPromise = null;
  function carregarLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!libPromise) {
      libPromise = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = LIB;
        sc.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error('Biblioteca do QR não carregou.')));
        sc.onerror = () => { libPromise = null; reject(new Error('Não foi possível carregar o gerador de QR. Verifique a internet.')); };
        document.head.appendChild(sc);
      });
    }
    return libPromise;
  }

  const urlDoQr = (token) => (window.VG_BOOT && window.VG_BOOT.baseUrl ? window.VG_BOOT.baseUrl : location.origin + location.pathname) + '?qr=' + encodeURIComponent(token);

  function matriz(texto) {
    const q = window.qrcode(0, 'M');
    q.addData(texto);
    q.make();
    return q;
  }

  function svg(q, margem = 4) {
    const n = q.getModuleCount(), t = n + margem * 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + margem} ${r + margem}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  function png(q, c) {
    const n = q.getModuleCount(), cel = 16, m = 4 * cel, lado = n * cel + m * 2, rod = 120;
    const cv = document.createElement('canvas');
    cv.width = lado; cv.height = lado + rod;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(m + k * cel, m + r * cel, cel, cel);
    g.textAlign = 'center';
    g.font = 'bold 34px Arial, sans-serif';
    g.fillText(String(c.fantasia || c.nome).slice(0, 40), lado / 2, lado + 30);
    g.font = '26px Arial, sans-serif';
    g.fillStyle = '#444';
    g.fillText(`Cliente ${c.codigo || ''} · Uso exclusivo da equipe técnica Vegas`, lado / 2, lado + 78);
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }

  function imprimirEtiqueta(q, c) {
    const root = document.getElementById('print-root');
    const esc = VG.esc;
    root.innerHTML = `
      <div style="font-family:Arial,sans-serif;color:#111;display:flex;justify-content:center;padding-top:10mm">
        <div style="width:80mm;border:1px solid #999;border-radius:4mm;padding:5mm;text-align:center">
          <div style="background:#0c0d0f;border-radius:2mm;padding:3mm;-webkit-print-color-adjust:exact;print-color-adjust:exact"><img src="${VG.logoSrc()}" style="height:12mm"></div>
          <div style="font-size:9pt;color:#555;margin-top:3mm;text-transform:uppercase;letter-spacing:.5px">Central de alarme · QR técnico</div>
          <div style="width:58mm;height:58mm;margin:3mm auto">${svg(q)}</div>
          <div style="font-size:12pt;font-weight:700">${esc(c.fantasia || c.nome)}</div>
          ${c.fantasia ? `<div style="font-size:9pt">${esc(c.nome)}</div>` : ''}
          <div style="font-size:9pt;color:#555;margin-top:1mm">Cliente ${esc(c.codigo || '—')}</div>
          <div style="font-size:7.5pt;color:#555;margin-top:3mm;border-top:1px solid #ccc;padding-top:2mm">Uso exclusivo da equipe técnica Vegas Vigilância e Segurança. Acesso protegido por PIN.</div>
        </div>
      </div>`;
    const prev = document.title;
    document.title = `QR_${c.codigo || 'cliente'}`;
    setTimeout(() => { window.print(); document.title = prev; }, 600);
  }

  /* ---------- SUPERVISÃO: gerar / ver / trocar ---------- */
  async function gerenciar(c, op) {
    const salvo = await S().call('qrClienteGerenciar', { clienteId: c.id, op });
    S().put('clientes', Object.assign({}, S().get('clientes', c.id) || c, salvo));
    return S().get('clientes', c.id);
  }

  async function abrir(clienteId, onChange) {
    let c = S().get('clientes', clienteId);
    if (!c) return;
    try {
      if (!c.qrToken) {
        const ok = await VG.confirm(`Gerar o QR Code de ${c.fantasia || c.nome}? Quem ler o QR vai precisar do PIN da supervisão para ver o acesso remoto.`, { title: 'Gerar QR Code', ok: 'Gerar QR Code' });
        if (!ok) return;
        c = await gerenciar(c, 'gerar');
        onChange && onChange(c);
      }
      await carregarLib();
    } catch (e) { VG.toast(/desconhecida/i.test(e.message) ? 'O servidor ainda está na versão antiga. Cole o Code.gs novo e publique uma nova versão.' : e.message, 'error', 7000); return; }

    const url = urlDoQr(c.qrToken);
    const q = matriz(url);
    const cfg = S().getConfig();
    const a = c.acesso || {};
    const faltas = [!c.localCentral && 'local da central', !(a.usuario || a.temSenha) && 'acesso remoto'].filter(Boolean);
    const acessos = (c.qrAcessos || []).slice(0, 5);

    VG.modal({
      title: 'QR Code do cliente',
      body: `
        <div class="qrc">
          <div class="qrc__img">${svg(q)}</div>
          <div class="qrc__info">
            <strong>${VG.esc(c.fantasia || c.nome)}</strong>
            <span class="faint">Cliente ${VG.esc(c.codigo || '—')} · gerado em ${VG.esc(VG.fmtDateTime(c.qrGeradoEm))}${c.qrGeradoPor ? ' por ' + VG.esc(c.qrGeradoPor) : ''}</span>
            ${faltas.length ? `<div class="notice">${VG.icon('alert')}<div>Falta cadastrar: <b>${faltas.join(' e ')}</b>. Edite o cliente para completar.</div></div>` : ''}
            ${cfg.temPinQr ? '' : `<div class="notice">${VG.icon('lock')}<div>O <b>PIN do QR</b> ainda não foi definido. Sem ele, só a supervisão logada consegue ver os dados. Defina em Configurações (supervisão geral).</div></div>`}
            ${acessos.length ? `<div class="qrc__log"><span class="kv__k">Últimas consultas</span>${acessos.map((x) => `<span>${VG.esc(VG.fmtDateTime(x.em))} · ${VG.esc(x.por)}</span>`).join('')}</div>` : ''}
          </div>
        </div>`,
      actions: [
        { label: 'Desativar', cls: 'btn-ghost', icon: 'ban', onClick: async () => {
          if (!(await VG.confirm('Desativar o QR? A etiqueta colada no cliente para de funcionar na hora.', { title: 'Desativar QR Code', ok: 'Desativar', danger: true }))) return false;
          try { const n = await gerenciar(c, 'desativar'); onChange && onChange(n); VG.toast('QR Code desativado.', 'success'); }
          catch (e) { VG.toast(e.message, 'error'); return false; }
        } },
        { label: 'Gerar novo', cls: 'btn-ghost', icon: 'refresh', onClick: async (m) => {
          if (!(await VG.confirm('Gerar um QR novo? A etiqueta atual para de funcionar e será preciso imprimir e colar a nova.', { title: 'Substituir QR Code', ok: 'Gerar novo', danger: true }))) return false;
          try { const n = await gerenciar(c, 'novo'); onChange && onChange(n); m.close(); abrir(clienteId, onChange); }
          catch (e) { VG.toast(e.message, 'error'); }
          return false;
        } },
        { label: 'Baixar PNG', cls: 'btn', icon: 'download', onClick: async () => {
          VG.download(`QR_${c.codigo || 'cliente'}.png`, await png(q, c));
          return false;
        } },
        { label: 'Imprimir etiqueta', cls: 'btn-primary', icon: 'pdf', onClick: () => { imprimirEtiqueta(q, c); return false; } },
      ],
    });
  }

  /* ---------- LEITURA DO QR (página pública) ---------- */
  let timer = null;
  const ICONE = 'assets/qr/icone.webp';
  const ICONES_ABA = { icon: 'assets/qr/icone-32.png', 'apple-touch-icon': 'assets/qr/icone-180.png' };
  const iconesOriginais = {};

  /** Na tela do QR, a aba e o atalho do celular usam o ícone Vegas QRCode; fora dela, voltam os do sistema */
  function iconeAba(qr) {
    Object.keys(ICONES_ABA).forEach((rel) => {
      const l = document.querySelector(`link[rel="${rel}"]`);
      if (!l) return;
      if (!(rel in iconesOriginais)) iconesOriginais[rel] = { href: l.getAttribute('href'), type: l.getAttribute('type') };
      const o = iconesOriginais[rel];
      l.setAttribute('href', qr ? ICONES_ABA[rel] : o.href);
      if (rel === 'icon') { if (qr) l.setAttribute('type', 'image/png'); else if (o.type) l.setAttribute('type', o.type); }
    });
  }

  function cleanup() {
    clearTimeout(timer); timer = null;
    if (Object.keys(iconesOriginais).length && !location.hash.startsWith('#/qr/')) iconeAba(false);
  }

  function casca(root, conteudo) {
    root.innerHTML = `
      <div class="portal">
        <header class="portal__bar">${VG.logoImg()}<div class="portal__bar-actions">${VG.Theme ? VG.Theme.button(true) : ''}</div></header>
        <main class="portal__body qrp">${conteudo}</main>
        <footer class="portal__foot">${VG.icon('lock')}<span>Uso exclusivo da equipe técnica Vegas. Cada consulta fica registrada.</span></footer>
      </div>`;
    VG.Theme && VG.Theme.bind(root);
  }

  function telaPin(root, token, r, erro) {
    if (r.cliente && r.cliente.nome) root._qrCliente = r.cliente;
    const c = root._qrCliente || {};
    casca(root, `
      <section class="panel"><div class="panel__body stack">
        <img class="qrp__icone" src="${ICONE}" alt="Vegas QRCode" width="132" height="132">
        <div class="portal__role">${VG.icon('lock')}Acesso técnico ao cliente</div>
        <h1 class="qrp__nome">${VG.esc(c.fantasia || c.nome)}</h1>
        ${c.fantasia ? `<p class="faint" style="margin:0">${VG.esc(c.nome)}</p>` : ''}
        ${r.semPin
          ? `<div class="notice">${VG.icon('alert')}<div>A supervisão ainda não definiu o PIN de acesso. Peça para a supervisão consultar pelo sistema.</div></div>`
          : `<form id="qrp-form" class="stack" novalidate autocomplete="off">
              <div class="field"><label for="qrp-pin">PIN da equipe técnica</label>
                <input id="qrp-pin" class="input qrp__pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••"></div>
              ${erro ? `<div class="notice">${VG.icon('alert')}<div>${VG.esc(erro)}</div></div>` : ''}
              <button class="btn btn-primary" type="submit">${VG.icon('check')}<span>Ver dados do cliente</span></button>
            </form>`}
        ${VG.Auth.current() ? '' : `<p class="hint" style="margin:0">Supervisora: <a href="#/login/supervisora">entre no sistema</a> e leia o QR de novo para ver sem PIN.</p>`}
      </div></section>`);
    const f = root.querySelector('#qrp-form');
    if (!f) return;
    const inp = f.querySelector('#qrp-pin');
    setTimeout(() => inp.focus(), 60);
    f.onsubmit = (e) => {
      e.preventDefault();
      const pin = VG.digits(inp.value);
      if (pin.length !== 6) { VG.toast('Digite os 6 números do PIN.', 'warn'); return; }
      VG.setBusy(f.querySelector('button'), true, 'Conferindo…');
      carregar(root, token, pin);
    };
  }

  function telaDados(root, token, r) {
    const c = r.cliente || {}, a = r.acesso || {}, u = r.ultima;
    const temAcesso = a.usuario || a.senha || a.plataforma;
    const copiar = (k, v) => v ? `<button class="btn btn-ghost btn-icon" data-copy="${k}" title="Copiar" aria-label="Copiar">${VG.icon('copy')}</button>` : '';
    casca(root, `
      <section class="panel"><div class="panel__body stack qrp__topo">
        <img class="qrp__icone qrp__icone--mini" src="${ICONE}" alt="Vegas QRCode" width="64" height="64">
        <div class="portal__role">${VG.icon('shield')}Cliente ${VG.esc(c.codigo || '')}</div>
        <h1 class="qrp__nome">${VG.esc(c.fantasia || c.nome)}</h1>
        ${c.fantasia ? `<p class="faint" style="margin:0">${VG.esc(c.nome)}</p>` : ''}
        ${c.endereco ? `<p class="faint" style="margin:0">${VG.esc(c.endereco)}</p>` : ''}
      </div></section>

      <section class="panel"><div class="panel__head"><h3>${VG.icon('pin')}Local da central</h3></div>
        <div class="panel__body"><p class="qrp__texto">${VG.esc(r.localCentral || 'Não cadastrado. Avise a supervisão.')}</p></div></section>

      <section class="panel"><div class="panel__head"><h3>${VG.icon('lock')}Acesso remoto</h3></div>
        <div class="panel__body">${temAcesso ? `
          <div class="qrp__cred">
            ${a.plataforma ? `<div class="qrp__row"><span class="kv__k">Plataforma / app</span><span class="kv__v">${VG.esc(a.plataforma)}</span></div>` : ''}
            <div class="qrp__row"><span class="kv__k">Usuário</span><span class="kv__v qrp__mono">${VG.esc(a.usuario || '—')}</span>${copiar('usuario', a.usuario)}</div>
            <div class="qrp__row"><span class="kv__k">Senha</span><span class="kv__v qrp__mono" id="qrp-senha">${a.senha ? '••••••••' : '—'}</span>
              ${a.senha ? `<button class="btn btn-ghost btn-icon" id="qrp-ver" title="Mostrar senha" aria-label="Mostrar senha">${VG.icon('eye')}</button>` : ''}${copiar('senha', a.senha)}</div>
            ${a.obs ? `<div class="qrp__row"><span class="kv__k">Observações</span><span class="kv__v">${VG.esc(a.obs)}</span></div>` : ''}
          </div>` : '<p class="qrp__texto">Não cadastrado. Avise a supervisão.</p>'}</div></section>

      <section class="panel"><div class="panel__head"><h3>${VG.icon('wrench')}Última manutenção</h3></div>
        <div class="panel__body">${u ? `
          <div class="kv kv--3">${VG.kv('OS', '#' + u.numero)}${VG.kv('Data', VG.fmtDateTime(u.data))}${VG.kv('Técnico', u.tecnico)}${VG.kv('Tipo', u.tipo)}${u.equipamentoLocal ? VG.kv('Local do equipamento', u.equipamentoLocal) : ''}</div>
          ${u.problema ? `<div class="qrp__bloco"><span class="kv__k">Problema</span><p>${VG.esc(u.problema)}</p></div>` : ''}
          ${u.diagnostico ? `<div class="qrp__bloco"><span class="kv__k">Diagnóstico</span><p>${VG.esc(u.diagnostico)}</p></div>` : ''}
          ${u.servico ? `<div class="qrp__bloco"><span class="kv__k">Serviço executado</span><p>${VG.esc(u.servico)}</p></div>` : ''}`
          : '<p class="qrp__texto">Nenhuma manutenção concluída no sistema para este cliente.</p>'}</div></section>

      <p class="hint" style="text-align:center;margin:0">Consulta registrada como: ${VG.esc(r.consultadoPor || '')}. Esta tela se fecha sozinha em 5 minutos.</p>`);

    root.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = async () => {
      const ok = await VG.copyText(b.dataset.copy === 'senha' ? a.senha : a.usuario);
      VG.toast(ok ? 'Copiado.' : 'Não foi possível copiar.', ok ? 'success' : 'error');
    }));
    const ver = root.querySelector('#qrp-ver');
    if (ver) ver.onclick = () => {
      const el = root.querySelector('#qrp-senha');
      const aberta = el.dataset.aberta === '1';
      el.textContent = aberta ? '••••••••' : a.senha;
      el.dataset.aberta = aberta ? '' : '1';
      ver.innerHTML = VG.icon(aberta ? 'eye' : 'eyeOff');
    };
    cleanup();
    timer = setTimeout(() => telaFechada(root, token), TEMPO_TELA_MS);
  }

  function telaFechada(root, token) {
    casca(root, `<section class="panel">${VG.empty('lock', 'Tela fechada por segurança', 'Os dados do cliente ficam visíveis por 5 minutos.', '<button class="btn btn-primary" id="qrp-reabrir">Abrir de novo</button>')}</section>`);
    root.querySelector('#qrp-reabrir').onclick = () => carregar(root, token, '');
  }

  function carregar(root, token, pin) {
    cleanup();
    if (!pin) root.innerHTML = `<div class="boot">${VG.logoImg('boot__logo')}<span class="spinner"></span><span class="boot__txt">Abrindo cliente…</span></div>`;
    return S().call('qrCliente', { qr: token, pin }, { silencioso: true }).then((r) => {
      if (!location.hash.startsWith('#/qr/')) return;
      document.title = `${(r.cliente && (r.cliente.fantasia || r.cliente.nome)) || 'Cliente'} · Vegas`;
      if (r.precisaPin) return telaPin(root, token, r);
      telaDados(root, token, r);
    }).catch((e) => {
      if (!location.hash.startsWith('#/qr/')) return;
      if (pin && /PIN|tentativa|bloquead/i.test(e.message)) return telaPin(root, token, {}, e.message);
      VG.Portal.renderErro(root, /desconhecida/i.test(e.message) ? 'O servidor ainda não tem a função de QR. Avise a supervisão.' : e.message);
    });
  }

  function renderPublico(root, token) {
    iconeAba(true);
    carregar(root, token, '');
  }

  VG.QRCliente = { abrir, renderPublico, cleanup, urlDoQr };
})();
