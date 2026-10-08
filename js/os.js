/* =========================================================
   VEGAS OS — ORDENS DE SERVIÇO
   Lista com filtros, criação/edição, detalhe, links e ações.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;
  const me = () => VG.Auth.current() || {};

  // FINAIS: não podem mais ser editadas. Reaberta pode ser corrigida, mas não cancelada.
  const FINAIS = ['concluida', 'cancelada', 'processada'];
  const SEM_CANCELAR = FINAIS.concat(['reaberta']);
  const VAZIO = () => ({ q: '', status: '', tecnico: '', cliente: '', de: '', ate: '', prioridade: '', tipo: '', material: '' });
  let filtros = VAZIO();
  /** Situações do filtro de status (somadas aos status que já existiam) */
  const SITUACOES = [
    { value: 'pendente', label: 'Pendente', sub: 'realizar' },
    { value: 'realizada', label: 'Realizada', sub: 'realizadas' },
    { value: 'processada', label: 'Processada', sub: 'processadas' },
    { value: 'reaberta', label: 'Reaberta', sub: 'realizadas' },
  ];
  const subDoStatus = (st) => (!st ? null : (SITUACOES.find((x) => x.value === st) || {}).sub || (st === 'concluida' ? 'realizadas' : st === 'cancelada' ? 'canceladas' : 'realizar'));
  const passaStatus = (o, st) => !st
    || (st === 'pendente' ? grupoStatus(o) === 'realizar' : st === 'realizada' ? o.status === 'concluida' : o.status === st);
  const passaMaterial = (o, m) => !m || (m === 'com' ? VG.Mat.usou(o) === true : VG.Mat.usou(o) === false);
  /** Número/código do cliente: o gravado na OS ou, para OS antigas, o do cadastro */
  const codCliente = (o) => (o.cliente && o.cliente.codigo) || ((o.clienteId && S().get('clientes', o.clienteId)) || {}).codigo || '';

  /* ---------- Abas da supervisora ---------- */
  // Instalação tem aba própria; os demais tipos (Manutenção, Preventiva, Venda,
  // Retirada e os tipos antigos) ficam em Manutenção.
  const lerAba = (k, pad) => { try { return localStorage.getItem(k) || pad; } catch (e) { return pad; } };
  const gravarAba = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  let aba = lerAba('vegas_os_aba', 'manutencao');
  let sub = lerAba('vegas_os_sub', 'realizar');
  const grupoTipo = (o) => (VG.norm(o.tipo) === 'instalacao' ? 'instalacao' : 'manutencao');
  // Realizadas = assinadas e esperando conferência (inclui reabertas); Processadas = conferidas pela supervisão
  const grupoStatus = (o) => (o.status === 'processada' ? 'processadas' : VG.isConcluida(o.status) ? 'realizadas' : o.status === 'cancelada' ? 'canceladas' : 'realizar');
  /** OS reaberta pela supervisão para o técnico completar */
  const devolvida = (o) => !!(o && o.devolucao) && o.status === 'em_atendimento';
  /** OS que a supervisão pode fechar por telefone (ainda não finalizadas pelo técnico) */
  const PODE_REMOTO = ['aberta', 'aguardando_tecnico', 'em_atendimento'];
  const remota = (o) => !!(o && o.resolucaoRemota) && VG.isConcluida(o.status);
  const PESO = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
  const COR_PRIO = { urgente: 'red', alta: 'orange', normal: 'blue', baixa: 'gray' };
  const dot = (p) => { const k = COR_PRIO[p] ? p : 'normal'; return `<span class="os-dot os-dot--${COR_PRIO[k]}${k === 'urgente' ? ' os-dot--pulse' : ''}" title="Prioridade ${VG.esc(VG.PRIORIDADES[k].label)}" aria-label="Prioridade ${VG.esc(VG.PRIORIDADES[k].label)}"></span>`; };

  /* ---------- Busca ---------- */
  function matches(o, q) {
    if (!q) return true;
    const n = VG.norm(q), d = VG.digits(q);
    const st = (VG.STATUS[o.status] || {}).label;
    const e = o.equipamento || {};
    const hay = VG.norm([o.numero, o.cliente && o.cliente.nome, o.tecnicoNome, o.tipo, st, e.tipo, e.marca, e.modelo, e.serie, e.patrimonio, o.problema, VG.fmtDate(o.criadaEm)].join(' '));
    if (hay.includes(n)) return true;
    return d.length >= 3 && VG.digits(o.cliente && o.cliente.cpf_cnpj).includes(d);
  }

  /** Data de conclusão mostrada nas abas Realizadas/Canceladas */
  const fimDe = (o) => (o.atendimento && o.atendimento.fim) || o.canceladaEm || o.atualizadoEm || o.criadaEm;
  /**
   * Data usada no filtro De/Até = a mesma data que aparece na lista:
   * A realizar → data prevista (ou abertura, se não tiver); Realizadas/Canceladas → data em que foi realizada.
   * Comparada como dia local (AAAA-MM-DD), sem problema de fuso.
   */
  const diaFiltro = (o) => {
    if (grupoStatus(o) === 'realizar') return o.prazoData || (o.criadaEm ? VG.toInputDate(new Date(o.criadaEm)) : '');
    const d = new Date(fimDe(o));
    return isNaN(d) ? '' : VG.toInputDate(d);
  };
  const passaData = (o, de, ate) => {
    if (!de && !ate) return true;
    const dia = diaFiltro(o);
    return !!dia && (!de || dia >= de) && (!ate || dia <= ate);
  };

  function aplicarFiltros(list, f = filtros) {
    return list.filter((o) =>
      (!f.status || o.status === f.status) &&
      (!f.tecnico || o.tecnicoId === f.tecnico || (f.tecnico === '_sem' && !o.tecnicoId)) &&
      (!f.cliente || o.clienteId === f.cliente) &&
      (!f.prioridade || o.prioridade === f.prioridade) &&
      (!f.tipo || o.tipo === f.tipo) &&
      passaMaterial(o, f.material) &&
      passaData(o, f.de, f.ate) &&
      matches(o, f.q));
  }

  /* ---------- LISTA ---------- */
  function renderList(el, params = {}) {
    // filtros vindos da URL (#/os?status=...)
    if (Object.keys(params).length) filtros = Object.assign(VAZIO(), params);
    if (params.status) { sub = subDoStatus(params.status); if (params.status === 'concluida' || params.status === 'cancelada') filtros.status = ''; }
    if (params.tipo) { aba = VG.norm(params.tipo) === 'instalacao' ? 'instalacao' : 'manutencao'; filtros.tipo = VG.norm(params.tipo) === 'instalacao' || VG.norm(params.tipo) === 'manutencao' ? '' : params.tipo; }
    const tecnicos = S().list('tecnicos');
    const clientes = S().list('clientes').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const f = filtros;
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div><h1>Ordens de serviço</h1><p>Acompanhe cada atendimento do início até a assinatura do cliente.</p></div>
          <div class="page-head__actions">
            <button class="btn" id="os-import">${VG.icon('upload')}<span>Importar OS CSV</span></button>
            <a class="btn btn-primary" href="#/os/nova">${VG.icon('plus')}<span>Nova ordem de serviço</span></a>
          </div>
        </div>
        <section class="panel">
          <div class="os-tabs" id="os-tabs"></div>
          <div class="toolbar" id="os-toolbar">
            <div class="field field--search"><label for="f-q">Pesquisar OS</label>
              <div class="input-group">${VG.icon('search')}<input id="f-q" class="input" placeholder="Nº, cliente, CPF/CNPJ, técnico, equipamento…" value="${VG.esc(f.q)}"></div></div>
            <button type="button" class="btn btn-sm os-filtros-btn" id="f-toggle">${VG.icon('search')}<span>Filtros</span></button>
            <div class="field" id="f-status-box"><label for="f-status">Status</label><select id="f-status" class="select" data-f="status"><option value="">Todas</option>
              <optgroup label="Situação">${VG.options(SITUACOES, f.status)}</optgroup>
              <optgroup label="A realizar">${VG.options(Object.entries(VG.STATUS).filter(([k]) => !VG.ENCERRADAS.includes(k)).map(([k, x]) => ({ value: k, label: x.label })), f.status)}</optgroup></select></div>
            <div class="field"><label for="f-mat">Material</label><select id="f-mat" class="select" data-f="material">${VG.options([{ value: 'com', label: 'Com material utilizado' }, { value: 'sem', label: 'Sem material utilizado' }], f.material, 'Todas')}</select></div>
            <div class="field"><label for="f-tec">Técnico</label><select id="f-tec" class="select" data-f="tecnico">${VG.options([{ value: '_sem', label: 'Sem técnico' }, ...tecnicos.map((t) => ({ value: t.id, label: t.nome }))], f.tecnico, 'Todos')}</select></div>
            <div class="field"><label for="f-cli">Cliente</label><select id="f-cli" class="select" data-f="cliente">${VG.options(clientes.map((c) => ({ value: c.id, label: c.nome })), f.cliente, 'Todos')}</select></div>
            <div class="field"><label for="f-pr">Prioridade</label><select id="f-pr" class="select" data-f="prioridade">${VG.options(Object.entries(VG.PRIORIDADES).map(([k, p]) => ({ value: k, label: p.label })), f.prioridade, 'Todas')}</select></div>
            <div class="field" id="f-tipo-box"><label for="f-tipo">Tipo</label><select id="f-tipo" class="select" data-f="tipo">${VG.options(VG.tiposCom(...new Set(S().list('ordens').map((o) => o.tipo))).filter((t) => t !== 'Instalação'), f.tipo, 'Todos')}</select></div>
            <div class="field"><label for="f-de" id="f-de-lb">De</label><input id="f-de" type="date" class="input" value="${f.de}"></div>
            <div class="field"><label for="f-ate" id="f-ate-lb">Até</label><input id="f-ate" type="date" class="input" value="${f.ate}"></div>
            <div class="toolbar__btns" id="f-btns">
              <button type="button" class="btn btn-primary btn-sm" id="f-buscar">${VG.icon('search')}<span>Buscar</span></button>
              <button type="button" class="btn btn-ghost btn-sm" id="f-clear">${VG.icon('x')}<span>Limpar</span></button>
            </div>
          </div>
          <div id="os-table"></div>
        </section>
      </div>`;
    VG.$('#f-q', el).addEventListener('input', VG.debounce((e) => { filtros.q = e.target.value; table(el); }, 200));
    VG.$$('[data-f]', el).forEach((s) => (s.onchange = () => {
      filtros[s.dataset.f] = s.value;
      // escolher um status leva direto para a aba onde ele aparece
      if (s.dataset.f === 'status' && s.value) { sub = subDoStatus(s.value); gravarAba('vegas_os_sub', sub); }
      table(el);
    }));
    VG.$('#f-toggle', el).onclick = () => VG.$('#os-toolbar', el).classList.toggle('is-open');
    // Buscar: aplica o período (De / Até) e os demais filtros de uma vez
    const buscar = () => {
      const de = VG.$('#f-de', el).value, ate = VG.$('#f-ate', el).value;
      VG.$$('#f-de, #f-ate', el).forEach((x) => x.closest('.field').classList.remove('invalid'));
      if (de && ate && de > ate) { VG.$('#f-ate', el).closest('.field').classList.add('invalid'); return VG.toast('A data "Até" precisa ser igual ou depois da data "De".', 'warn'); }
      filtros.de = de; filtros.ate = ate; filtros.q = VG.$('#f-q', el).value;
      VG.$$('select[data-f]', el).forEach((x) => (filtros[x.dataset.f] = x.value));
      table(el);
      VG.$('#os-toolbar', el).classList.remove('is-open');
      const n = VG.$$('.os-line', el).length;
      VG.toast(n ? `${n} ${n === 1 ? 'ordem encontrada' : 'ordens encontradas'} nesta aba.` : 'Nenhuma ordem encontrada com esses filtros.', n ? 'success' : 'info');
    };
    VG.$('#f-buscar', el).onclick = buscar;
    VG.$$('#f-de, #f-ate', el).forEach((x) => x.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }));
    VG.$('#f-q', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
    VG.$('#os-import', el).onclick = () => VG.OSCSV.importar(() => table(el));
    VG.$('#f-clear', el).onclick = () => { filtros = VAZIO(); if (location.hash !== '#/os') location.hash = '#/os'; else renderList(el); };
    table(el);
  }

  function table(el) {
    const box = VG.$('#os-table', el);
    const all = S().list('ordens');
    // tipo só vale dentro de Manutenção
    const filtradas = aplicarFiltros(all, Object.assign({}, filtros, { status: '', tipo: '' }))
      .filter((o) => passaStatus(o, filtros.status))
      .filter((o) => grupoTipo(o) !== 'manutencao' || !filtros.tipo || o.tipo === filtros.tipo);
    const doTipo = filtradas.filter((o) => grupoTipo(o) === aba);
    const conta = (g, st) => filtradas.filter((o) => grupoTipo(o) === g && (!st || grupoStatus(o) === st)).length;
    const contaSub = (st) => doTipo.filter((o) => grupoStatus(o) === st).length;
    const nCanc = contaSub('canceladas');
    if (sub === 'canceladas' && !nCanc) sub = 'realizar';

    // Abas: tipo (Manutenção / Instalação) e situação (A realizar / Realizadas)
    const tabs = VG.$('#os-tabs', el);
    tabs.innerHTML = `
      <div class="os-tabs__main" role="tablist">
        ${[['manutencao', 'Manutenção', 'wrench'], ['instalacao', 'Instalação', 'plus']].map(([k, l, ic]) => `
          <button role="tab" class="os-tab ${aba === k ? 'is-on' : ''}" data-aba="${k}" aria-selected="${aba === k}">${VG.icon(ic)}<span>${l}</span><em>${conta(k, 'realizar')}</em></button>`).join('')}
      </div>
      <div class="os-tabs__sub" role="tablist">
        <button role="tab" class="os-sub ${sub === 'realizar' ? 'is-on' : ''}" data-sub="realizar">A realizar <em>${contaSub('realizar')}</em></button>
        <button role="tab" class="os-sub ${sub === 'realizadas' ? 'is-on' : ''}" data-sub="realizadas" title="Assinadas pelo cliente, esperando a conferência">Realizadas <em>${contaSub('realizadas')}</em></button>
        <button role="tab" class="os-sub ${sub === 'processadas' ? 'is-on' : ''}" data-sub="processadas" title="Conferidas e marcadas como processadas">Processadas <em>${contaSub('processadas')}</em></button>
        ${nCanc ? `<button role="tab" class="os-sub os-sub--faint ${sub === 'canceladas' ? 'is-on' : ''}" data-sub="canceladas">Canceladas <em>${nCanc}</em></button>` : ''}
        <span class="os-legend">${['urgente', 'alta', 'normal', 'baixa'].map((p) => `<span>${dot(p)}${VG.PRIORIDADES[p].label}</span>`).join('')}</span>
      </div>`;
    tabs.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => { aba = b.dataset.aba; gravarAba('vegas_os_aba', aba); table(el); }));
    tabs.querySelectorAll('[data-sub]').forEach((b) => (b.onclick = () => {
      sub = b.dataset.sub; gravarAba('vegas_os_sub', sub);
      // status de outra aba deixaria a lista vazia: volta para "Todas"
      if (filtros.status && subDoStatus(filtros.status) !== sub) { filtros.status = ''; const fs = VG.$('#f-status', el); if (fs) fs.value = ''; }
      table(el);
    }));
    const tpBox = VG.$('#f-tipo-box', el); if (tpBox) tpBox.classList.toggle('hidden', aba === 'instalacao');
    // o período filtra pela data que aparece na lista desta aba
    const qual = { realizar: 'Prevista', realizadas: 'Realizada', processadas: 'Realizada', canceladas: 'Cancelada' }[sub] || '';
    const lbDe = VG.$('#f-de-lb', el), lbAte = VG.$('#f-ate-lb', el);
    if (lbDe) lbDe.textContent = qual ? `${qual} de` : 'De';
    if (lbAte) lbAte.textContent = qual ? `${qual} até` : 'Até';

    const hoje = VG.toInputDate();
    const list = doTipo.filter((o) => grupoStatus(o) === sub);
    if (sub === 'realizar') {
      list.sort((a, b) => (PESO[a.prioridade] ?? 2) - (PESO[b.prioridade] ?? 2)
        || String(a.prazoData || '9999').localeCompare(String(b.prazoData || '9999'))
        || String(a.prazoHora || '99').localeCompare(String(b.prazoHora || '99'))
        || a.numero - b.numero);
    } else list.sort((a, b) => String(fimDe(b)).localeCompare(String(fimDe(a))) || b.numero - a.numero);

    if (!list.length) {
      const nomeAba = aba === 'instalacao' ? 'instalação' : 'manutenção';
      box.innerHTML = !all.length
        ? VG.empty('os', 'Nenhuma OS criada', 'Crie a primeira ordem de serviço para começar.', `<a class="btn btn-primary" href="#/os/nova">${VG.icon('plus')}<span>Nova ordem de serviço</span></a>`)
        : filtradas.length !== all.length && doTipo.length === 0
          ? VG.empty('search', 'Nenhuma OS encontrada', 'Nenhuma ordem corresponde aos filtros. Ajuste a pesquisa ou limpe os filtros.')
          : VG.empty(sub === 'realizar' ? 'check' : 'os', sub === 'realizar' ? `Nenhuma ${nomeAba} a realizar` : sub === 'realizadas' ? `Nenhuma ${nomeAba} esperando conferência` : sub === 'processadas' ? `Nenhuma ${nomeAba} processada` : 'Nenhuma OS cancelada',
              sub === 'realizar' ? 'Tudo em dia por aqui.' : sub === 'processadas' ? 'Quando a supervisão conferir e marcar uma OS como processada, ela aparece aqui.' : 'Quando uma OS for concluída, ela aparece aqui.');
      return;
    }

    const quando = (o) => {
      if (sub !== 'realizar') { const d = VG.fmtDate(fimDe(o)); return `<span class="faint"><span class="d-long">${VG.esc(d)}</span><span class="d-short">${VG.esc(String(d).slice(0, 5))}</span></span>`; }
      if (!o.prazoData) return '<span class="faint">sem data</span>';
      const txt = VG.fmtDate(o.prazoData + 'T12:00:00') + (o.prazoHora ? ' ' + o.prazoHora : '');
      if (o.prazoData < hoje) return `<span class="os-late" title="Previsto para ${VG.esc(txt)}">Atrasada</span>`;
      if (o.prazoData === hoje) return `<span class="os-today">Hoje${o.prazoHora ? ' ' + VG.esc(o.prazoHora) : ''}</span>`;
      const [, mm, dd] = o.prazoData.split('-');
      return `<span class="d-long">${VG.esc(txt)}</span><span class="d-short">${dd}/${mm}</span>`;
    };
    const detalhe = (o) => [devolvida(o) ? 'Reaberta para o técnico' : '', remota(o) ? 'Resolvida por telefone' : '', aba === 'manutencao' && o.tipo !== 'Manutenção' ? o.tipo : '', o.equipamento && o.equipamento.tipo, o.cliente && o.cliente.bairro].filter(Boolean).join(' · ');

    const real = sub === 'realizadas' || sub === 'processadas';
    const numHTML = (o) => {
      if (!real) return `#${o.numero}`;
      const cc = codCliente(o);
      return `<span title="OS nº ${o.numero} · Cliente nº ${VG.esc(cc || '—')}">OS nº ${o.numero}<small>Cliente nº ${VG.esc(cc || '—')}</small></span>`;
    };
    box.innerHTML = `
      <div class="os-lines${real ? ' os-lines--real' : ''}" role="list">
        ${list.map((o) => `
          <div class="os-line" role="listitem" data-id="${o.id}" tabindex="0">
            ${dot(o.prioridade)}
            <span class="os-line__cli"><b>${VG.esc((o.cliente && o.cliente.nome) || '—')}</b>${detalhe(o) ? `<small>${VG.esc(detalhe(o))}</small>` : ''}</span>
            <span class="os-line__num">${numHTML(o)}</span>
            <span class="os-line__tec">${o.tecnicoNome ? VG.esc(o.tecnicoNome.split(' ').slice(0, 2).join(' ')) : '<span class="faint">sem técnico</span>'}</span>
            <span class="os-line__date">${quando(o)}</span>
            <span class="os-line__st">${VG.badge(o.status)}</span>
            <span class="os-line__act">
              <button class="btn btn-ghost btn-icon" data-act="edit" title="Editar" aria-label="Editar" ${FINAIS.includes(o.status) ? 'disabled' : ''}>${VG.icon('edit')}</button>
              <button class="btn btn-ghost btn-icon" data-act="pdf" title="Gerar PDF" aria-label="Gerar PDF">${VG.icon('pdf')}</button>
              <button class="btn btn-ghost btn-icon" data-act="link" title="Copiar link" aria-label="Copiar link" ${o.status === 'cancelada' ? 'disabled' : ''}>${VG.icon('link')}</button>
              <button class="btn btn-ghost btn-icon" data-act="cancel" title="Cancelar OS" aria-label="Cancelar OS" ${SEM_CANCELAR.includes(o.status) || devolvida(o) ? 'disabled' : ''}>${VG.icon('ban')}</button>
            </span>
          </div>`).join('')}
      </div>
      <div class="table-foot"><span>${list.length} ${list.length === 1 ? 'ordem' : 'ordens'} nesta aba · ${all.length} no total</span></div>`;
    box.querySelectorAll('.os-line[data-id]').forEach((row) => {
      const id = row.dataset.id;
      const abrir = () => (location.hash = '#/os/ver/' + id);
      row.addEventListener('click', (e) => { if (!e.target.closest('button')) abrir(); });
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === row) abrir(); });
      const on = (a, fn) => (row.querySelector(`[data-act=${a}]`).onclick = (e) => { e.stopPropagation(); fn(); });
      on('edit', () => (location.hash = '#/os/editar/' + id));
      on('pdf', () => VG.PDF.gerar(S().get('ordens', id)));
      on('link', () => linkModal(S().get('ordens', id)));
      on('cancel', () => cancelar(id, () => table(el)));
    });
  }

  function renderForm(el, id, params = {}) {
    const editing = !!id;
    const os = editing ? S().get('ordens', id) : null;
    if (editing && !os) { el.innerHTML = VG.empty('alert', 'OS não encontrada', 'Ela pode ter sido removida.', '<a class="btn" href="#/os">Voltar para a lista</a>'); return; }
    if (editing && FINAIS.includes(os.status)) { location.hash = '#/os/ver/' + id; return; }

    const clientes = S().list('clientes').filter((c) => c.status !== 'inativo' || (os && c.id === os.clienteId)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const tecnicos = S().list('tecnicos').filter((t) => t.ativo !== false || (os && t.id === os.tecnicoId));
    const cfg = S().getConfig();
    const previewNum = editing ? os.numero : Math.max(cfg.ultimoNumeroOS || 1000, ...S().list('ordens').map((o) => o.numero)) + 1;
    const c = os ? os.cliente : {};
    const e = os ? os.equipamento : {};
    const v = (x) => VG.esc(x || '');
    const reaberta = editing && os.status === 'reaberta';
    // materiais que o técnico deve levar (cópia de trabalho até salvar)
    const levar = ((os && os.materiaisLevar) || []).map((m) => VG.Mat.limpar(m));
    const clienteSel = os ? os.clienteId : params.cliente || '';

    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div><h1>${editing ? `Editar OS #${os.numero}` : 'Nova ordem de serviço'}</h1><p>${editing ? 'Altere os dados e salve. As mudanças ficam registradas no histórico.' : 'Preencha os dados e envie para o técnico.'}</p></div>
          <a class="btn btn-ghost" href="${editing ? '#/os/ver/' + id : '#/os'}">${VG.icon('back')}<span>Voltar</span></a>
        </div>

        <form id="osf" class="stack" novalidate>
          <section class="panel">
            <div class="panel__head"><h2>${VG.icon('os')}Dados da OS</h2><span class="os-number">#${previewNum}</span></div>
            <div class="panel__body grid grid-4">
              <div class="field"><label>Número da OS</label><input class="input" value="${previewNum}" readonly><span class="hint">${editing ? 'Número definitivo.' : 'Gerado automaticamente ao criar.'}</span></div>
              <div class="field"><label>Data de abertura</label><input class="input" value="${VG.fmtDateTime(editing ? os.criadaEm : VG.nowISO())}" readonly></div>
              <div class="field span-2"><label for="os-tipo">Tipo de atendimento<span class="req">*</span></label>
                <select id="os-tipo" name="tipo" class="select">${VG.options(VG.tiposCom(os && os.tipo), os ? os.tipo : 'Manutenção')}</select></div>
              <div class="field span-all"><span class="label">Prioridade<span class="req">*</span></span>
                <div class="seg">${Object.entries(VG.PRIORIDADES).map(([k, p]) => `
                  <input type="radio" name="prioridade" id="pr-${k}" value="${k}" ${(os ? os.prioridade : 'normal') === k ? 'checked' : ''}>
                  <label for="pr-${k}" style="--c:var(--st-${{ baixa: 'gray', normal: 'blue', alta: 'orange', urgente: 'red' }[k]})"><i></i>${p.label}</label>`).join('')}
                </div></div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__head"><h2>${VG.icon('user')}Cliente</h2>
              <button type="button" class="btn btn-sm" id="os-newcli">${VG.icon('plus')}<span>Novo cliente</span></button></div>
            <div class="panel__body grid grid-4">
              <div class="field span-all"><label for="os-cli-q">Buscar cliente</label>
                <div class="input-group">${VG.icon('search')}<input id="os-cli-q" class="input" placeholder="Digite nome, código, CPF/CNPJ, rua ou bairro" autocomplete="off"></div></div>
              <div class="field span-all"><label for="os-cli">Selecionar cliente cadastrado<span class="req">*</span></label>
                <select id="os-cli" name="clienteId" class="select">${VG.options(clientes.map((x) => ({ value: x.id, label: `${x.codigo ? x.codigo + ' · ' : ''}${x.nome} — ${[x.endereco, x.numero].filter(Boolean).join(', ') || 'sem endereço'}${x.bairro ? ' (' + x.bairro + ')' : ''} · ${x.cpf_cnpj ? VG.fmtDoc(x.cpf_cnpj) : 'sem doc.'}` })), clienteSel, 'Escolha um cliente…')}</select></div>
              <div class="field span-2"><label for="c-nome">Nome / Razão social</label><input id="c-nome" name="c_nome" class="input" value="${v(c.nome)}"></div>
              <div class="field"><label for="c-doc">CPF/CNPJ</label><input id="c-doc" name="c_cpf_cnpj" class="input" data-mask="doc" value="${v(VG.fmtDoc(c.cpf_cnpj))}"></div>
              <div class="field"><label for="c-tel">Telefone</label><input id="c-tel" name="c_telefone" class="input" data-mask="phone" inputmode="tel" value="${v(VG.fmtPhone(c.telefone))}"></div>
              <div class="field span-2"><label for="c-email">E-mail</label><input id="c-email" name="c_email" class="input" type="email" value="${v(c.email)}"></div>
              <div class="field span-2"><label for="c-end">Endereço</label><input id="c-end" name="c_endereco" class="input" value="${v(c.endereco)}"></div>
              <div class="field"><label for="c-num">Número</label><input id="c-num" name="c_numero" class="input" value="${v(c.numero)}"></div>
              <div class="field"><label for="c-comp">Complemento</label><input id="c-comp" name="c_complemento" class="input" value="${v(c.complemento)}"></div>
              <div class="field"><label for="c-bairro">Bairro</label><input id="c-bairro" name="c_bairro" class="input" value="${v(c.bairro)}"></div>
              <div class="field"><label for="c-cid">Cidade</label><input id="c-cid" name="c_cidade" class="input" value="${v(c.cidade)}"></div>
              <div class="field"><label for="c-uf">Estado</label><input id="c-uf" name="c_estado" class="input" maxlength="2" value="${v(c.estado)}"></div>
              <div class="field"><label for="c-cep">CEP</label><input id="c-cep" name="c_cep" class="input" data-mask="cep" value="${v(VG.fmtCEP(c.cep))}"></div>
              <p class="hint span-all" style="margin:0">Os campos são preenchidos a partir do cadastro. Alterações aqui valem só para esta OS.</p>
            </div>
          </section>

          <section class="panel">
            <div class="panel__head"><h2>${VG.icon('video')}Equipamento / sistema</h2></div>
            <div class="panel__body grid grid-3">
              <div class="field"><label for="e-tipo">Tipo de equipamento</label><select id="e-tipo" name="e_tipo" class="select">${VG.options(VG.EQUIPAMENTOS, e.tipo, 'Selecione…')}</select></div>
              <div class="field"><label for="e-marca">Marca</label><input id="e-marca" name="e_marca" class="input" value="${v(e.marca)}" placeholder="Ex.: Intelbras"></div>
              <div class="field"><label for="e-modelo">Modelo</label><input id="e-modelo" name="e_modelo" class="input" value="${v(e.modelo)}"></div>
              <div class="field"><label for="e-serie">Número de série</label><input id="e-serie" name="e_serie" class="input" value="${v(e.serie)}"></div>
              <div class="field"><label for="e-pat">Patrimônio</label><input id="e-pat" name="e_patrimonio" class="input" value="${v(e.patrimonio)}"></div>
              <div class="field"><label for="e-local">Local do equipamento</label><input id="e-local" name="e_local" class="input" value="${v(e.local)}" placeholder="Ex.: Garagem, bloco B"></div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__head"><h2>${VG.icon('alert')}Descrição do problema<span class="req">*</span></h2></div>
            <div class="panel__body stack">
              <div class="field"><label for="os-prob-sel">Problema</label>
                <select id="os-prob-sel" class="select">${VG.options(VG.PROBLEMAS, problemaDe(os && os.problema), 'Toque para escolher o problema…')}</select>
                <span class="hint">Escolha na lista e, se precisar, complete os detalhes abaixo.</span></div>
              <div class="field"><label for="os-prob">Detalhes do problema</label>
              <textarea id="os-prob" name="problema" class="textarea lg" placeholder="Ex.: Cliente informa que a câmera 04 está sem imagem desde ontem.">${v(os && os.problema)}</textarea></div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__head"><h2>${VG.icon('shield')}Técnico e prazo</h2></div>
            <div class="panel__body grid grid-3">
              <div class="field"><label for="os-tec">Técnico responsável</label>
                <select id="os-tec" name="tecnicoId" class="select" ${reaberta ? 'disabled' : ''}>${VG.options(tecnicos.map((t) => ({ value: t.id, label: `${t.nome}${t.especialidade ? ' — ' + t.especialidade : ''}` })), os ? os.tecnicoId : '', 'Definir depois (OS fica aberta)')}</select>${reaberta ? '<span class="hint">OS reaberta: o técnico do atendimento é mantido.</span>' : ''}</div>
              <div class="field"><label for="os-pdata">Data prevista</label><input id="os-pdata" name="prazoData" type="date" class="input" value="${v(os ? os.prazoData : VG.toInputDate())}"></div>
              <div class="field"><label for="os-phora">Horário previsto</label><input id="os-phora" name="prazoHora" type="time" class="input" value="${v(os ? os.prazoHora : '')}"></div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__head"><h2>${VG.icon('box')}Materiais para levar</h2><span class="faint" style="font-size:.8rem">Opcional</span></div>
            <div class="panel__body">
              <p class="hint" style="margin:0 0 .8rem">Separe aqui o que o técnico deve levar para o atendimento. Depois ele informa o que realmente foi utilizado.</p>
              ${VG.Mat.editorHTML('lv', { codigoObrigatorio: true, qtdLabel: 'Qtd. para levar' })}
            </div>
          </section>

          <div class="form-actions">
            <a class="btn btn-ghost" href="${editing ? '#/os/ver/' + id : '#/os'}">Cancelar</a>
            <button type="submit" class="btn btn-primary btn-lg" id="os-submit">${VG.icon('check')}<span>${editing ? 'Salvar alterações' : 'Criar ordem de serviço'}</span></button>
          </div>
        </form>
      </div>`;

    const form = VG.$('#osf', el);
    VG.bindMasks(form);
    VG.Mat.bindEditor(form, 'lv', () => levar, { codigoObrigatorio: true, vazio: 'Nenhum material separado para esta OS.' });
    // Problema escolhido na lista: fica no início da descrição, mantendo o que já foi escrito
    const selProb = VG.$('#os-prob-sel', el), txtProb = VG.$('#os-prob', el);
    selProb.onchange = () => {
      const resto = semProblema(txtProb.value);
      txtProb.value = selProb.value ? selProb.value + (resto ? ' - ' + resto : '') : resto;
      txtProb.closest('.field').classList.remove('invalid');
    };
    txtProb.addEventListener('input', () => { const p = problemaDe(txtProb.value); if (selProb.value !== p) selProb.value = p; });
    const selCli = VG.$('#os-cli', el);
    const fillCliente = (cli) => {
      if (!cli) return;
      const set = (n, val) => (form.elements[n].value = val || '');
      set('c_nome', cli.nome); set('c_cpf_cnpj', VG.fmtDoc(cli.cpf_cnpj)); set('c_telefone', VG.fmtPhone(cli.telefone)); set('c_email', cli.email);
      set('c_endereco', cli.endereco); set('c_numero', cli.numero); set('c_complemento', cli.complemento); set('c_bairro', cli.bairro);
      set('c_cidade', cli.cidade); set('c_estado', cli.estado); set('c_cep', VG.fmtCEP(cli.cep));
    };
    selCli.onchange = () => fillCliente(S().get('clientes', selCli.value));
    // busca rápida: filtra a lista (útil com milhares de clientes)
    const rotulo = (x) => `${x.codigo ? x.codigo + ' · ' : ''}${x.nome} — ${[x.endereco, x.numero].filter(Boolean).join(', ') || 'sem endereço'}${x.bairro ? ' (' + x.bairro + ')' : ''} · ${x.cpf_cnpj ? VG.fmtDoc(x.cpf_cnpj) : 'sem doc.'}`;
    VG.$('#os-cli-q', el).addEventListener('input', VG.debounce((e) => {
      const q = VG.norm(e.target.value), qd = VG.digits(e.target.value);
      const atual = selCli.value;
      const achados = clientes.filter((x) => !q || VG.norm([x.codigo, x.nome, x.endereco, x.bairro, x.cidade].join(' ')).includes(q) || (qd.length >= 3 && VG.digits(x.cpf_cnpj).includes(qd)));
      selCli.innerHTML = VG.options(achados.slice(0, 300).map((x) => ({ value: x.id, label: rotulo(x) })), atual, achados.length ? `${achados.length} ${achados.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}${achados.length > 300 ? ' (mostrando 300)' : ''} — escolha…` : 'Nenhum cliente encontrado');
      if (achados.length === 1) { selCli.value = achados[0].id; fillCliente(achados[0]); }
    }, 200));
    if (!editing && clienteSel) fillCliente(S().get('clientes', clienteSel));
    VG.$('#os-newcli', el).onclick = () => VG.Clientes.form(null, (novo) => {
      const opt = document.createElement('option');
      opt.value = novo.id; opt.textContent = `${novo.nome} — ${[novo.endereco, novo.numero].filter(Boolean).join(', ') || 'sem endereço'}${novo.bairro ? ' (' + novo.bairro + ')' : ''} · ${novo.cpf_cnpj ? VG.fmtDoc(novo.cpf_cnpj) : 'sem doc.'}`;
      selCli.appendChild(opt); selCli.value = novo.id; fillCliente(novo);
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = Object.fromEntries(new FormData(form));
      form.querySelectorAll('.field').forEach((x) => x.classList.remove('invalid'));
      const fail = (sel, msg) => { const f = form.querySelector(sel); f && f.closest('.field').classList.add('invalid'); f && f.focus(); VG.toast(msg, 'warn'); };
      if (!fd.clienteId) return fail('#os-cli', 'Selecione o cliente da OS.');
      if (!fd.c_nome.trim()) return fail('#c-nome', 'Informe o nome do cliente.');
      if (!fd.problema.trim()) return fail('#os-prob', 'Descreva o problema relatado.');

      const btn = VG.$('#os-submit', el);
      VG.setBusy(btn, true, editing ? 'Salvando…' : 'Criando…');
      const cliente = {};
      ['nome', 'cpf_cnpj', 'telefone', 'email', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep'].forEach((k) => (cliente[k] = (fd['c_' + k] || '').trim()));
      cliente.cpf_cnpj = VG.digits(cliente.cpf_cnpj); cliente.telefone = VG.digits(cliente.telefone); cliente.cep = VG.digits(cliente.cep); cliente.estado = cliente.estado.toUpperCase();
      cliente.codigo = (S().get('clientes', fd.clienteId) || {}).codigo || (os && os.clienteId === fd.clienteId && os.cliente && os.cliente.codigo) || '';
      const materiaisLevar = levar.map((m) => VG.Mat.limpar(m));
      const equipamento = {};
      ['tipo', 'marca', 'modelo', 'serie', 'patrimonio', 'local'].forEach((k) => (equipamento[k] = (fd['e_' + k] || '').trim()));
      // OS reaberta: o select fica travado (não entra no formulário) e o técnico é mantido
      const tec = reaberta ? (os.tecnicoId ? { id: os.tecnicoId, nome: os.tecnicoNome } : null) : fd.tecnicoId ? S().get('tecnicos', fd.tecnicoId) : null;
      const autor = me().nome || 'Supervisora';

      try {
        if (!editing) {
          const nova = {
            numero: 0, criadaEm: VG.nowISO(), criadaPor: autor,
            prioridade: fd.prioridade || 'normal', tipo: fd.tipo, status: tec ? 'aguardando_tecnico' : 'aberta',
            clienteId: fd.clienteId, cliente, equipamento, problema: fd.problema.trim(),
            materiaisLevar,
            tecnicoId: tec ? tec.id : null, tecnicoNome: tec ? tec.nome : '',
            prazoData: fd.prazoData || '', prazoHora: fd.prazoHora || '',
            tokenTecnico: '', tokenCliente: '',
            atendimento: { inicio: null, fim: null, diagnostico: '', servico: '', materiais: [], observacoes: '', fotos: { antes: [], depois: [] } },
            assinaturaTecnico: null, assinaturaCliente: null, historico: [],
          };
          S().hist(nova, 'OS criada pela supervisora.', autor);
          if (materiaisLevar.length) S().hist(nova, `Materiais para levar: ${resumoMats(materiaisLevar)}.`, autor);
          if (tec) S().hist(nova, `OS enviada para ${tec.nome}.`, autor);
          Object.assign(nova, await S().createOS(nova)); // número e links gerados no servidor
          S().log(`OS #${nova.numero} criada`, nova.id, 'plus');
          if (tec) S().log(`Técnico ${tec.nome.split(' ')[0]} recebeu a OS #${nova.numero}`, nova.id, 'user');
          location.hash = '#/os/ver/' + nova.id;
          VG.toast(tec ? `OS #${nova.numero} criada e enviada para ${tec.nome}. Ela já aparece na lista do técnico.` : `OS #${nova.numero} criada. Escolha o técnico na própria OS.`, 'success', 6000);
        } else {
          const antes = { tecnicoId: os.tecnicoId };
          const levarMudou = resumoMats(os.materiaisLevar || []) !== resumoMats(materiaisLevar);
          Object.assign(os, { prioridade: fd.prioridade, tipo: fd.tipo, clienteId: fd.clienteId, cliente, equipamento, problema: fd.problema.trim(), prazoData: fd.prazoData, prazoHora: fd.prazoHora, materiaisLevar });
          S().hist(os, reaberta ? 'OS reaberta corrigida pela supervisora.' : 'OS editada pela supervisora.', autor);
          if (levarMudou) S().hist(os, materiaisLevar.length ? `Materiais para levar atualizados: ${resumoMats(materiaisLevar)}.` : 'Materiais para levar removidos.', autor);
          if ((tec ? tec.id : null) !== antes.tecnicoId) {
            os.tecnicoId = tec ? tec.id : null;
            os.tecnicoNome = tec ? tec.nome : '';
            os.tokenTecnico = VG.token(10); // link anterior deixa de funcionar
            if (tec) {
              S().hist(os, `OS enviada para ${tec.nome}.`, autor);
              S().log(`Técnico ${tec.nome.split(' ')[0]} recebeu a OS #${os.numero}`, os.id, 'user');
              if (os.status === 'aberta') os.status = 'aguardando_tecnico';
            } else if (os.status === 'aguardando_tecnico') {
              os.status = 'aberta';
              S().hist(os, 'Técnico removido da OS.', autor);
            }
          }
          S().save('ordens', os);
          VG.toast('OS atualizada.', 'success');
          location.hash = '#/os/ver/' + os.id;
        }
      } catch (err) {
        VG.setBusy(btn, false);
        VG.toast('Não foi possível salvar a OS: ' + err.message, 'error', 7000);
      }
    });
  }

  const resumoMats = (mats) => VG.Mat.resumo(mats);

  /** Problema da lista que abre a descrição (ex.: "DISPARO - zona 3") */
  function problemaDe(txt) {
    const t = String(txt || '').trim().toUpperCase();
    return VG.PROBLEMAS.filter((p) => t === p || (t.startsWith(p) && /^\s*[-–—:\n]/.test(t.slice(p.length)))).sort((a, b) => b.length - a.length)[0] || '';
  }
  function semProblema(txt) {
    const p = problemaDe(txt);
    const t = String(txt || '').trim();
    return p ? t.slice(p.length).replace(/^\s*[-–—:]?\s*/, '') : t;
  }

  function criadaModal(os) {
    VG.modal({
      title: `OS #${os.numero} criada`,
      body: `
        <p style="margin-top:0">${os.tecnicoNome ? `Envie o link para <strong>${VG.esc(os.tecnicoNome)}</strong> iniciar o atendimento.` : 'Defina um técnico para enviar o link de atendimento.'}</p>
        ${os.tecnicoId ? linkCard(os, 'tecnico') : ''}`,
      onOpen: (m) => bindLinkCards(m, os),
      actions: [{ label: 'Fechar' }, { label: 'Visualizar OS', cls: 'btn-primary', icon: 'eye', onClick: () => { location.hash = '#/os/ver/' + os.id; } }],
    });
  }

  /* ---------- LINKS ---------- */
  function linkCard(os, papel) {
    const url = VG.linkFor(os, papel);
    const tec = papel === 'tecnico';
    return `
      <div class="link-card" data-papel="${papel}">
        <div class="link-card__title">${VG.icon(tec ? 'wrench' : 'pen')}${tec ? `Link do técnico${os.tecnicoNome ? ' — ' + VG.esc(os.tecnicoNome) : ''}` : 'Link do cliente — conferência e assinatura'}</div>
        <div class="link-box"><input class="input" value="${VG.esc(url)}" readonly aria-label="Link"></div>
        <div class="link-card__actions">
          <button class="btn btn-primary btn-sm" data-l="copy">${VG.icon('copy')}<span>${tec ? 'Copiar link do técnico' : 'Copiar link do cliente'}</span></button>
          <button class="btn btn-sm" data-l="share">${VG.icon('share')}<span>Compartilhar link</span></button>
          <a class="btn btn-sm" data-l="wa" target="_blank" rel="noopener">${VG.icon('message')}<span>WhatsApp</span></a>
          <a class="btn btn-ghost btn-sm" href="${VG.esc(url)}" target="_blank" rel="noopener">${VG.icon('external')}<span>Abrir</span></a>
        </div>
      </div>`;
  }
  function bindLinkCards(root, os) {
    root.querySelectorAll('.link-card').forEach((card) => {
      const papel = card.dataset.papel;
      const url = VG.linkFor(os, papel);
      const tecnico = papel === 'tecnico' && os.tecnicoId ? S().get('tecnicos', os.tecnicoId) : null;
      const texto = papel === 'tecnico'
        ? `Olá${tecnico ? ' ' + tecnico.nome.split(' ')[0] : ''}! Nova Ordem de Serviço #${os.numero} — ${os.cliente.nome}. Acesse para iniciar o atendimento: ${url}`
        : `Olá! Confira o atendimento da Ordem de Serviço #${os.numero} realizado pela ${S().getConfig().empresa.nome} e assine digitalmente: ${url}`;
      card.querySelector('[data-l=copy]').onclick = async () => { const ok = await VG.copyText(url); VG.toast(ok ? 'Link copiado.' : 'Não foi possível copiar. Selecione o link e copie manualmente.', ok ? 'success' : 'error'); };
      card.querySelector('[data-l=share]').onclick = () => VG.share({ title: `OS #${os.numero}`, text: texto, url });
      card.querySelector('[data-l=wa]').href = VG.whatsappUrl(texto, papel === 'tecnico' ? tecnico && tecnico.telefone : os.cliente.telefone);
      card.querySelector('input').addEventListener('focus', (e) => e.target.select());
    });
  }
  function linkModal(os) {
    if (!os) return;
    if (os.status === 'cancelada') return VG.toast('Esta OS está cancelada; os links foram desativados.', 'warn');
    VG.modal({
      title: `Links da OS #${os.numero}`, size: 'lg',
      body: `
        ${os.tecnicoId ? linkCard(os, 'tecnico') : `<div class="notice">${VG.icon('alert')}<div>Esta OS ainda não tem técnico. <a href="#/os/editar/${os.id}">Defina um técnico</a> para liberar o link de atendimento.</div></div>`}
        <div style="height:.9rem"></div>
        ${linkCard(os, 'cliente')}
        <div class="notice notice--info" style="margin-top:1rem">${VG.icon('info')}<div>Cada link dá acesso somente a esta OS. Trocar o técnico gera um novo link e desativa o anterior.
        <br><span class="faint">Protótipo: os dados ficam neste navegador. Para abrir o link em outro celular é preciso publicar o sistema com um servidor e banco de dados.</span></div></div>`,
      onOpen: (m) => bindLinkCards(m, os),
      actions: [{ label: 'Fechar' }],
    });
  }

  /* ---------- CANCELAR ---------- */
  async function cancelar(id, done) {
    const os = S().get('ordens', id);
    if (!os || FINAIS.includes(os.status)) return;
    const motivo = await VG.promptText({ title: `Cancelar OS #${os.numero}`, label: 'Motivo do cancelamento', placeholder: 'Ex.: cliente desistiu do serviço', ok: 'Cancelar OS', danger: true });
    if (motivo == null) return;
    os.status = 'cancelada';
    os.canceladaMotivo = motivo;
    os.canceladaEm = VG.nowISO();
    S().hist(os, `OS cancelada. Motivo: ${motivo}`, me().nome);
    S().save('ordens', os);
    S().log(`OS #${os.numero} cancelada`, os.id, 'ban');
    VG.toast(`OS #${os.numero} cancelada.`, 'success');
    done && done();
  }

  /* ---------- DETALHE ---------- */
  function fotosHTML(fotos) {
    const g = (label, arr) => `<div class="photo-group"><h4>${label} (${arr.length})</h4>${arr.length ? `<div class="thumbs">${arr.map((src, i) => `<button type="button" class="thumb" data-src="${i}" data-g="${label}" aria-label="Ampliar foto"><img src="${src}" alt="${label} ${i + 1}"></button>`).join('')}</div>` : '<p class="faint" style="margin:0;font-size:.85rem">Nenhuma foto.</p>'}</div>`;
    return g('Antes', (fotos && fotos.antes) || []) + g('Depois', (fotos && fotos.depois) || []);
  }
  function bindThumbs(root, fotos) {
    root.querySelectorAll('.thumb[data-src]').forEach((b) => (b.onclick = () => {
      const arr = b.dataset.g === 'Antes' ? fotos.antes : fotos.depois;
      VG.lightbox(arr[Number(b.dataset.src)], `Foto ${b.dataset.g.toLowerCase()}`);
    }));
  }
  function sigHTML(title, s) {
    return `<div class="sig-card"><div class="kv__k" style="margin-bottom:.4rem">${title}</div>
      <div class="sig-card__img">${s && s.imagem ? `<img src="${s.imagem}" alt="Assinatura de ${VG.esc(s.nome)}">` : '<span class="sig-card__empty">Aguardando assinatura</span>'}</div>
      <div class="sig-card__name">${VG.esc(s ? s.nome : '—')}</div>
      <div class="sig-card__meta">${s ? `${s.documento ? 'Doc. ' + VG.esc(s.documento) + ' · ' : ''}${VG.fmtDateTime(s.dataHora)}` : ''}</div></div>`;
  }
  /** Materiais da OS: somente código, material e quantidade (nunca valores) */
  function materiaisHTML(mats) {
    return VG.Mat.tabelaHTML(mats, 'Quantidade');
  }

  function renderDetail(el, id) {
    const os = S().get('ordens', id);
    if (!os) { el.innerHTML = VG.empty('alert', 'OS não encontrada', 'Ela pode ter sido removida.', '<a class="btn" href="#/os">Voltar para a lista</a>'); return; }
    const c = os.cliente || {}, e = os.equipamento || {}, a = os.atendimento || {};
    const final = FINAIS.includes(os.status);
    const semCancelar = SEM_CANCELAR.includes(os.status) || devolvida(os);
    const reaberta = os.status === 'reaberta';
    const cc = codCliente(os);
    el.innerHTML = `
      <div class="page">
        <div><a class="btn btn-ghost btn-sm" href="#/os">${VG.icon('back')}<span>Ordens de serviço</span></a></div>
        <section class="panel os-hero">
          <div>
            <div class="os-hero__num"><h1>OS #${os.numero}</h1>${VG.badge(os.status, true)}${VG.prioBadge(os.prioridade)}</div>
            <div class="os-hero__meta">
              <span>${VG.icon('calendar')}Aberta em ${VG.fmtDateTime(os.criadaEm)}${os.criadaPor ? ' por ' + VG.esc(os.criadaPor) : ''}</span>
              <span>${VG.icon('users')}Cliente nº ${VG.esc(cc || '—')}</span>
              <span>${VG.icon('wrench')}${VG.esc(os.tipo)}</span>
              <span>${VG.icon('user')}${VG.esc(os.tecnicoNome || 'Sem técnico')}</span>
              ${os.prazoData ? `<span>${VG.icon('clock')}Prazo ${VG.fmtInputDate(os.prazoData)} ${VG.esc(os.prazoHora || '')}</span>` : ''}
            </div>
          </div>
          <div class="page-head__actions">
            ${!final ? `<a class="btn" href="#/os/editar/${os.id}">${VG.icon('edit')}<span>Editar</span></a>` : ''}
            ${PODE_REMOTO.includes(os.status) ? `<button class="btn" id="d-remoto" title="Resolveu o problema por telefone? Feche a OS sem visita do técnico.">${VG.icon('phone')}<span>Resolver por telefone</span></button>` : ''}
            ${os.status !== 'cancelada' ? `<button class="btn" id="d-links">${VG.icon('link')}<span>Links</span></button>` : ''}
            <button class="btn btn-primary" id="d-pdf">${VG.icon('pdf')}<span>Gerar PDF</span></button>
            ${!semCancelar ? `<button class="btn btn-danger" id="d-cancel">${VG.icon('ban')}<span>Cancelar</span></button>` : ''}
          </div>
        </section>

        ${os.status === 'cancelada' ? `<div class="notice">${VG.icon('ban')}<div><strong>OS cancelada</strong> em ${VG.fmtDateTime(os.canceladaEm || (os.historico.slice(-1)[0] || {}).dataHora)}. Motivo: ${VG.esc(os.canceladaMotivo || '—')}</div></div>` : ''}
        ${remota(os) ? `<div class="notice notice--info">${VG.icon('phone')}<div><strong>Resolvida por telefone pela supervisão</strong> em ${VG.fmtDateTime(os.resolucaoRemota.em)}${os.resolucaoRemota.por ? ' por ' + VG.esc(os.resolucaoRemota.por) : ''}. Falou com <b>${VG.esc(os.resolucaoRemota.contato || '—')}</b>${os.resolucaoRemota.telefone ? ' · ' + VG.esc(VG.fmtPhone(os.resolucaoRemota.telefone)) : ''}. Sem visita do técnico e sem assinaturas.</div></div>` : ''}
        ${devolvida(os) ? `<div class="notice">${VG.icon('refresh')}<div><strong>Reaberta para o técnico</strong> em ${VG.fmtDateTime(os.devolucao.em)}${os.devolucao.por ? ' por ' + VG.esc(os.devolucao.por) : ''}. O que completar: ${VG.esc(String(os.devolucao.motivo || '—').replace(/[.\s]+$/, ''))}.<br>A OS está de volta no celular de ${VG.esc(os.tecnicoNome || 'técnico')}. ${os.devolucao.manterAssinaturaCliente ? 'A assinatura do cliente foi mantida: quando o técnico finalizar, a OS volta direto para <b>Realizadas</b>.' : 'Quando o técnico finalizar, o cliente assina de novo (no celular do técnico ou pelo link).'}</div></div>` : ''}
        ${os.status === 'aguardando_cliente' ? `<div class="notice notice--info">${VG.icon('pen')}<div>Atendimento finalizado pelo técnico. Falta a assinatura do cliente, que o técnico coleta no próprio celular. Se precisar, também é possível enviar o <button class="btn btn-ghost btn-sm" id="d-link-cli" style="display:inline-flex;height:auto;padding:0 .2rem;text-decoration:underline">link do cliente</button>.</div></div>` : ''}

        <div class="detail-grid">
          <div class="stack">
            <section class="panel"><div class="panel__head"><h3>${VG.icon('user')}Cliente</h3></div>
              <div class="panel__body kv">
                ${VG.kv('Nome / Razão social', c.nome)}${VG.kv('CPF/CNPJ', VG.fmtDoc(c.cpf_cnpj))}
                ${VG.kv('Telefone', c.telefone ? `<a href="tel:${VG.digits(c.telefone)}">${VG.esc(VG.fmtPhone(c.telefone))}</a>` : '', true)}
                ${VG.kv('E-mail', c.email)}
                ${VG.kv('Nº do cliente', cc)}
                <div class="kv__item" style="grid-column:1/-1"><div class="kv__k">Endereço</div><div class="kv__v">${VG.esc(VG.enderecoCompleto(c) || '—')} ${c.endereco ? `· <a href="${VG.mapsLink(c)}" target="_blank" rel="noopener">Abrir no mapa</a>` : ''}</div></div>
              </div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('video')}Equipamento</h3></div>
              <div class="panel__body kv kv--3">${VG.kv('Tipo', e.tipo)}${VG.kv('Marca', e.marca)}${VG.kv('Modelo', e.modelo)}${VG.kv('Nº de série', e.serie)}${VG.kv('Patrimônio', e.patrimonio)}${VG.kv('Local', e.local)}</div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('alert')}Problema relatado</h3></div>
              <div class="panel__body"><p class="text-block">${VG.esc(os.problema)}</p></div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('box')}Materiais para levar</h3><span class="faint" style="font-size:.8rem">Separados pela supervisão</span></div>
              <div class="panel__body">${VG.Mat.tabelaHTML(os.materiaisLevar, 'Qtd. enviada', 'Nenhum material separado para esta OS.', { valores: true })}</div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('wrench')}Atendimento técnico</h3>
              <span class="faint" style="font-size:.8rem">${a.inicio ? `Início ${VG.fmtDateTime(a.inicio)}${a.fim ? ' · Fim ' + VG.fmtDateTime(a.fim) : ''}` : 'Não iniciado'}</span></div>
              <div class="panel__body stack">
                <div><div class="kv__k">Diagnóstico</div><p class="text-block">${VG.esc(a.diagnostico || '—')}</p></div>
                <div><div class="kv__k">Serviço executado</div><p class="text-block">${VG.esc(a.servico || '—')}</p></div>
                <div><div class="kv__k" style="margin-bottom:.3rem">Materiais utilizados</div>${VG.Mat.utilizadosHTML(os, { valores: true })}</div>
                <div><div class="kv__k">Observações do técnico</div><p class="text-block">${VG.esc(a.observacoes || '—')}</p></div>
                ${os.assinaturaCliente && os.assinaturaCliente.observacoes ? `<div><div class="kv__k">Observações do cliente</div><p class="text-block">${VG.esc(os.assinaturaCliente.observacoes)}</p></div>` : ''}
              </div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('camera')}Fotos</h3></div><div class="panel__body" id="d-fotos">${fotosHTML(a.fotos)}</div></section>
          </div>

          <div class="stack">
            ${conferenciaHTML(os)}
            ${!final && !reaberta ? tecnicoPanelHTML(os) : ''}
            <section class="panel"><div class="panel__head"><h3>${VG.icon('pen')}Assinaturas</h3></div>
              <div class="panel__body sig-view" style="grid-template-columns:1fr">${sigHTML('Técnico', os.assinaturaTecnico)}${sigHTML('Cliente', os.assinaturaCliente)}</div></section>
            <section class="panel"><div class="panel__head"><h3>${VG.icon('clock')}Histórico</h3></div>
              <div class="panel__body"><ul class="timeline">${(os.historico || []).map((h) => `<li><time>${VG.fmtDateTime(h.dataHora)}</time><span>${VG.esc(h.texto)}</span></li>`).join('')}</ul></div></section>
          </div>
        </div>
      </div>`;
    VG.$('#d-pdf', el).onclick = () => VG.PDF.gerar(S().get('ordens', id));
    const L = VG.$('#d-links', el); if (L) L.onclick = () => linkModal(S().get('ordens', id));
    const LC = VG.$('#d-link-cli', el); if (LC) LC.onclick = () => linkModal(S().get('ordens', id));
    const C = VG.$('#d-cancel', el); if (C) C.onclick = () => cancelar(id, () => renderDetail(el, id));
    const RT = VG.$('#d-remoto', el); if (RT) RT.onclick = () => resolverRemoto(id, () => renderDetail(el, id));
    const TB = VG.$('#d-tec-ok', el);
    if (TB) TB.onclick = () => {
      const novo = VG.$('#d-tec', el).value;
      const o = S().get('ordens', id);
      if ((novo || null) === (o.tecnicoId || null)) return VG.toast('Este técnico já é o responsável.', 'info');
      if (o.status === 'em_atendimento' && o.tecnicoId) {
        VG.confirm(`${o.tecnicoNome} já iniciou este atendimento. Trocar de técnico mesmo assim?`, { title: 'Trocar técnico', ok: 'Trocar' }).then((sim) => { if (sim) { atribuir(o, novo); renderDetail(el, id); } });
        return;
      }
      atribuir(o, novo);
      renderDetail(el, id);
    };
    bindThumbs(VG.$('#d-fotos', el), a.fotos || { antes: [], depois: [] });
    bindConferencia(el, id);
  }

  /* ---------- CONFERÊNCIA DA SUPERVISÃO (processar / reabrir) ---------- */
  const PODE_PROCESSAR = ['concluida', 'reaberta'];
  /** Antes de processar, a OS pode voltar para o técnico completar o que esqueceu */
  const PODE_DEVOLVER = ['aguardando_cliente', 'concluida', 'reaberta'];
  const ehRetirada = (os) => VG.norm(os && os.tipo) === 'retirada';
  /** Quem recebe o e-mail "Cliente retirado" (o envio é feito pelo servidor, no Code.gs) */
  const EMAILS_RETIRADA = ['financeiro2@vegasvigilancia.com.br', 'julianolopes47@gmail.com', 'controle.cftv@vegasvigilancia.com.br', 'gilduque@vegasvigilancia.com.br'];
  function conferenciaHTML(os) {
    if (!['aguardando_cliente'].concat(VG.CONCLUIDAS).includes(os.status)) return '';
    const st = os.status;
    const nLevar = (os.materiaisLevar || []).length, nUsados = ((os.atendimento && os.atendimento.materiais) || []).length;
    const itens = (n) => `${n} ${n === 1 ? 'item' : 'itens'}`;
    const hist = (os.conferencias || []).slice().reverse();
    const acao = { processada: 'Marcada como processada', reaberta: 'Reaberta', correcao: 'Materiais utilizados lançados/corrigidos', devolvida: 'Reaberta para o técnico', remota: 'Resolvida por telefone' };
    const retirada = ehRetirada(os);
    const em = os.emailRetirada || {};
    return `
      <section class="panel" id="d-conf"><div class="panel__head"><h3>${VG.icon('check')}Conferência da OS</h3>${VG.badge(st)}</div>
        <div class="panel__body conf-box">
          <div class="conf-row"><span>OS nº / Cliente nº</span><b>${os.numero} · ${VG.esc(codCliente(os) || '—')}</b></div>
          <div class="conf-row"><span>Tipo de OS</span><b>${VG.esc(os.tipo || '—')}</b></div>
          ${remota(os) ? `<div class="conf-row"><span>Atendimento</span><b>Por telefone (${VG.esc(String(os.resolucaoRemota.por || 'supervisão').split(' ')[0])})</b></div>` : ''}
          <div class="conf-row"><span>Utilizou material</span>${VG.Mat.usouBadge(os)}</div>
          <div class="conf-row"><span>Materiais para levar</span><b>${itens(nLevar)}</b></div>
          <div class="conf-row"><span>Materiais utilizados</span><b>${itens(nUsados)}</b></div>
          ${nUsados ? (() => { const t = VG.Mat.totais(os.atendimento.materiais); return `<div class="conf-row"><span>Valor dos materiais utilizados</span><b>${VG.esc(VG.fmtMoney(t.venda))} <small class="faint">custo ${VG.esc(VG.fmtMoney(t.custo))}</small></b></div>${t.semPreco ? `<div class="conf-row"><span></span><small class="faint">${t.semPreco} ${t.semPreco === 1 ? 'item sem preço' : 'itens sem preço'} na lista de Materiais</small></div>` : ''}`; })() : ''}
          ${retirada ? `<div class="conf-row"><span>E-mail "Cliente retirado"</span>${em.enviadoEm ? `<b>Enviado em ${VG.fmtDateTime(em.enviadoEm)}</b>` : em.erro ? `<b class="conf-err">Não enviado</b>` : '<b>Será enviado ao processar</b>'}</div>
            ${em.erro && !em.enviadoEm ? `<div class="notice">${VG.icon('alert')}<div>O e-mail de cliente retirado não foi enviado: ${VG.esc(em.erro)}</div></div>` : ''}` : ''}
          ${st === 'processada' ? `<div class="notice notice--info">${VG.icon('check')}<div><strong>Conferida e processada</strong> em ${VG.fmtDateTime(os.processadaEm)}${os.processadaPor ? ' por ' + VG.esc(os.processadaPor) : ''}.</div></div>` : ''}
          ${st === 'reaberta' ? `<div class="notice">${VG.icon('refresh')}<div><strong>OS reaberta</strong> em ${VG.fmtDateTime(os.reabertaEm)}${os.reabertaPor ? ' por ' + VG.esc(os.reabertaPor) : ''}${os.reabertaMotivo ? '. Motivo: ' + VG.esc(os.reabertaMotivo) : ''}. Faça as correções e marque como processada novamente.</div></div>` : ''}
          ${st === 'aguardando_cliente' ? '<p class="hint" style="margin:0">A conferência fica disponível depois que o cliente assinar a OS. Se o técnico esqueceu algo, reabra a OS para ele completar.</p>' : ''}
          ${st === 'concluida' ? '<p class="hint" style="margin:0">Confira os materiais separados e os utilizados antes de processar. Se faltar algum material ou a quantidade estiver errada, lance ou corrija abaixo.</p>' : ''}
          ${retirada && PODE_PROCESSAR.includes(st) && !em.enviadoEm ? `<div class="notice notice--info">${VG.icon('mail')}<div>OS de <strong>Retirada</strong>: ao marcar como processada, o sistema envia o e-mail <strong>Cliente retirado</strong> com os dados do cliente para ${EMAILS_RETIRADA.map(VG.esc).join(', ')}.</div></div>` : ''}
          <div class="conf-actions stack">
            ${PODE_PROCESSAR.includes(st) ? `<button class="btn" id="d-corrigir">${VG.icon('box')}<span>${nUsados ? 'Corrigir materiais utilizados' : 'Lançar materiais utilizados'}</span></button>` : ''}
            ${st === 'reaberta' ? `<a class="btn" href="#/os/editar/${os.id}">${VG.icon('edit')}<span>Corrigir dados da OS</span></a>` : ''}
            ${PODE_PROCESSAR.includes(st) ? `<button class="btn btn-primary" id="d-processar">${VG.icon('check')}<span>Marcar como processada</span></button>` : ''}
            ${PODE_DEVOLVER.includes(st) ? `<button class="btn" id="d-devolver" title="O técnico esqueceu algo? A OS volta para o celular dele completar.">${VG.icon('wrench')}<span>Reabrir para o técnico</span></button>` : ''}
            ${st === 'processada' ? `<button class="btn" id="d-reabrir">${VG.icon('refresh')}<span>Reabrir OS</span></button>` : ''}
          </div>
          ${hist.length ? `<ul class="conf-hist">${hist.map((h) => `<li><time>${VG.fmtDateTime(h.dataHora)}</time>${VG.esc(acao[h.acao] || h.acao)}${h.por ? ' por ' + VG.esc(h.por) : ''}${h.motivo ? ' — ' + VG.esc(h.motivo) : ''}</li>`).join('')}</ul>` : ''}
        </div></section>`;
  }

  function bindConferencia(el, id) {
    const again = () => renderDetail(el, id);
    const P = VG.$('#d-processar', el);
    if (P) P.onclick = async () => {
      const os = S().get('ordens', id);
      const ret = ehRetirada(os) && !(os.emailRetirada && os.emailRetirada.enviadoEm);
      if (!(await VG.confirm(`Confirma que conferiu a OS #${os.numero}? Ela será marcada como PROCESSADA e o fluxo desta OS será finalizado.${ret ? ' Como é uma RETIRADA, o e-mail "Cliente retirado" será enviado.' : ''}`, { title: 'Marcar como processada', ok: 'Marcar como processada' }))) return;
      VG.setBusy(P, true, ret ? 'Processando e enviando e-mail…' : 'Processando…');
      try {
        // logo do e-mail: a do sistema (Configurações) ou, se não houver, a logo padrão da Vegas
        const extra = ret && !S().getConfig().logoDataUrl && VG.LOGO_EMBED ? { logo: VG.LOGO_EMBED } : {};
        const salva = await S().processarOS(id, extra);
        const em = salva.emailRetirada || {};
        if (ret && em.enviadoEm) VG.toast(`OS #${salva.numero} PROCESSADA. E-mail "Cliente retirado" enviado.`, 'success', 6000);
        else if (ret) VG.toast(`OS #${salva.numero} PROCESSADA, mas o e-mail "Cliente retirado" não foi enviado: ${em.erro || 'o servidor ainda está na versão antiga (publique o Code.gs novo)'}.`, 'warn', 9000);
        else VG.toast(`OS #${salva.numero} marcada como PROCESSADA.`, 'success');
        again();
      } catch (e) { VG.setBusy(P, false); VG.toast('Não foi possível processar a OS: ' + e.message, 'error', 7000); }
    };
    const R = VG.$('#d-reabrir', el);
    if (R) R.onclick = async () => {
      const os = S().get('ordens', id);
      const motivo = await VG.promptText({ title: `Reabrir OS #${os.numero}`, label: 'Motivo da reabertura', placeholder: 'Ex.: quantidade de material informada errada', ok: 'Reabrir OS' });
      if (motivo == null) return;
      VG.setBusy(R, true, 'Reabrindo…');
      try {
        const salva = await S().reabrirOS(id, motivo);
        VG.toast(`OS #${salva.numero} reaberta. Corrija o necessário e processe novamente.`, 'success', 5000);
        again();
      } catch (e) { VG.setBusy(R, false); VG.toast('Não foi possível reabrir a OS: ' + e.message, 'error', 7000); }
    };
    const C = VG.$('#d-corrigir', el);
    if (C) C.onclick = () => corrigirMateriais(id, again);
    const D = VG.$('#d-devolver', el);
    if (D) D.onclick = () => devolverTecnico(id, again);
  }

  /** A supervisão resolveu o problema por telefone: fecha a OS sem visita do técnico */
  function resolverRemoto(id, done) {
    const os = S().get('ordens', id);
    if (!os) return;
    const c = os.cliente || {};
    const iniciou = os.status === 'em_atendimento';
    VG.modal({
      title: `Resolver OS #${os.numero} por telefone`, size: 'lg',
      body: `
        <p style="margin:0 0 1rem">A OS será fechada <b>sem visita do técnico</b> e sem assinaturas. Vai para <b>Realizadas</b> ou, se marcar a opção no final, direto para <b>Processadas</b>. Fica registrado que foi resolvida por telefone por <b>${VG.esc((VG.Auth.current() || {}).nome || 'você')}</b>.</p>
        ${iniciou ? `<div class="notice" style="margin-bottom:1rem">${VG.icon('alert')}<div><b>${VG.esc(os.tecnicoNome || 'O técnico')}</b> já iniciou este atendimento. Ao fechar, ele não consegue mais alterar a OS. Confirme com ele antes.</div></div>`
          : os.tecnicoNome ? `<div class="notice notice--info" style="margin-bottom:1rem">${VG.icon('info')}<div>A OS sai da lista de <b>${VG.esc(os.tecnicoNome)}</b> e ele recebe um aviso de que não precisa mais ir.</div></div>` : ''}
        <div class="grid grid-2">
          <div class="field"><label for="rr-contato">Falou com<span class="req">*</span></label><input id="rr-contato" class="input" placeholder="Nome de quem atendeu no cliente" autocomplete="off"></div>
          <div class="field"><label for="rr-tel">Telefone</label><input id="rr-tel" class="input" inputmode="tel" value="${VG.esc(c.telefone ? VG.fmtPhone(c.telefone) : '')}"></div>
          <div class="field span-all"><label for="rr-diag">O que estava acontecendo</label><textarea id="rr-diag" class="textarea" placeholder="Opcional. Ex.: central sem comunicação após queda de energia">${VG.esc((os.atendimento && os.atendimento.diagnostico) || '')}</textarea></div>
          <div class="field span-all"><label for="rr-serv">Como foi resolvido<span class="req">*</span></label><textarea id="rr-serv" class="textarea" placeholder="Ex.: orientei o cliente a reiniciar a central; testamos juntos e voltou a comunicar"></textarea></div>
          <label class="check span-all"><input type="checkbox" id="rr-proc" checked><span>Já marcar como <b>processada</b> (pula a conferência)</span></label>
        </div>`,
      onOpen: (m) => {
        VG.$$('#rr-contato, #rr-serv', m).forEach((x) => x.addEventListener('input', () => x.closest('.field').classList.remove('invalid')));
        setTimeout(() => { const x = VG.$('#rr-contato', m); x && x.focus(); }, 50);
      },
      actions: [
        { label: 'Voltar' },
        { label: 'Fechar OS', cls: 'btn-primary', icon: 'check', onClick: async (m) => {
          const v = (n) => m.el.querySelector('#rr-' + n);
          const bad = (n, msg) => { v(n).closest('.field').classList.add('invalid'); v(n).focus(); VG.toast(msg, 'warn'); return false; };
          const contato = v('contato').value.trim(), servico = v('serv').value.trim();
          if (!contato) return bad('contato', 'Informe com quem você falou no cliente.');
          if (!servico) return bad('serv', 'Descreva como o problema foi resolvido.');
          const processar = v('proc').checked;
          try {
            let salva = await S().resolverRemoto(id, { contato, servico, telefone: v('tel').value.trim(), diagnostico: v('diag').value.trim() });
            if (processar) {
              try { salva = await S().processarOS(id, VG.norm(salva.tipo) === 'retirada' && !S().getConfig().logoDataUrl && VG.LOGO_EMBED ? { logo: VG.LOGO_EMBED } : {}); }
              catch (e) { VG.toast(`OS #${salva.numero} fechada, mas não foi possível marcar como processada: ${e.message}`, 'warn', 8000); done && done(); return true; }
            }
            VG.toast(`OS #${salva.numero} resolvida por telefone${processar ? ' e processada' : '. Ela está em Realizadas'}.`, 'success', 6000);
            done && done();
          } catch (e) { VG.toast('Não foi possível fechar a OS: ' + e.message, 'error', 7000); return false; }
        } },
      ],
    });
  }

  /** Reabre a OS para o técnico completar (antes de processar) */
  function devolverTecnico(id, done) {
    const os = S().get('ordens', id);
    if (!os) return;
    if (!os.tecnicoId) return VG.toast('Esta OS não tem técnico responsável.', 'warn');
    const assinou = !!(os.assinaturaCliente && os.assinaturaCliente.imagem);
    VG.modal({
      title: `Reabrir OS #${os.numero} para o técnico`, size: 'md',
      onOpen: (m) => { const t = m.querySelector('#dv-motivo'); t.addEventListener('input', () => t.closest('.field').classList.remove('invalid')); },
      body: `
        <p style="margin:0 0 1rem">A OS volta para o celular de <b>${VG.esc(os.tecnicoNome || 'técnico')}</b> como <b>Em atendimento</b>, com tudo o que ele já registrou. Ele completa o que faltou, assina de novo e finaliza.</p>
        <div class="field"><label for="dv-motivo">O que o técnico precisa completar?<span class="req">*</span></label>
          <textarea id="dv-motivo" class="textarea" placeholder="Ex.: faltou informar o material utilizado e a foto depois do serviço"></textarea>
          <span class="hint">O técnico vê este texto no topo da OS.</span></div>
        ${assinou ? `
        <div class="stack" style="margin-top:1rem;gap:.5rem">
          <span class="label">Assinatura do cliente (${VG.esc(os.assinaturaCliente.nome || 'cliente')})</span>
          <label class="check"><input type="radio" name="dv-ass" value="manter" checked><span><b>Manter a assinatura do cliente.</b> Quando o técnico finalizar, a OS volta direto para Realizadas.</span></label>
          <label class="check"><input type="radio" name="dv-ass" value="nova"><span><b>O cliente assina de novo</b> (no celular do técnico ou pelo link). A assinatura atual fica guardada no histórico.</span></label>
        </div>` : ''}`,
      actions: [
        { label: 'Voltar' },
        { label: 'Reabrir para o técnico', cls: 'btn-primary', icon: 'refresh', onClick: async (m) => {
          const motivo = m.el.querySelector('#dv-motivo').value.trim();
          if (!motivo) { m.el.querySelector('#dv-motivo').closest('.field').classList.add('invalid'); VG.toast('Escreva o que o técnico precisa completar.', 'warn'); return false; }
          const nova = !!m.el.querySelector('input[name=dv-ass][value=nova]:checked');
          try {
            const salva = await S().devolverTecnico(id, motivo, nova);
            VG.toast(`OS #${salva.numero} reaberta. Ela já aparece no celular de ${(salva.tecnicoNome || 'técnico').split(' ')[0]}.`, 'success', 6000);
            done && done();
          } catch (e) { VG.toast('Não foi possível reabrir a OS: ' + e.message, 'error', 7000); return false; }
        } },
      ],
    });
  }

  /** Supervisão lança ou corrige os materiais utilizados numa OS realizada ou reaberta */
  function corrigirMateriais(id, done) {
    const os = S().get('ordens', id);
    const a = os.atendimento || {};
    const estado = { usou: VG.Mat.usou(os), itens: (a.materiais || []).map((m) => Object.assign({}, m)) };
    VG.modal({
      title: `Materiais utilizados — OS #${os.numero}`, size: 'lg',
      body: `
        <div class="mat-q"><span class="label">Utilizou algum material?</span>
          <div class="seg">
            <input type="radio" name="cm-usou" id="cm-sim" value="sim" ${estado.usou === true ? 'checked' : ''}><label for="cm-sim">SIM</label>
            <input type="radio" name="cm-usou" id="cm-nao" value="nao" ${estado.usou === false ? 'checked' : ''}><label for="cm-nao">NÃO</label>
          </div></div>
        <div id="cm-nao-box" class="notice notice--info ${estado.usou === false ? '' : 'hidden'}">${VG.icon('info')}<div>Não foi utilizado material.</div></div>
        <div id="cm-ed" class="${estado.usou === true ? '' : 'hidden'}">${VG.Mat.editorHTML('cm', { levar: os.materiaisLevar || [], qtdLabel: 'Qtd. utilizada' })}
          <p class="hint" style="margin:.6rem 0 0">Ajuste a quantidade e o <b>valor unitário</b> de cada item direto na lista. Itens sem valor lançado começam com o valor de venda da lista de Materiais. Esses valores saem no PDF da OS.</p></div>`,
      onOpen: (m) => {
        VG.Mat.bindEditor(m, 'cm', () => estado.itens, { levar: os.materiaisLevar || [], editarValores: true });
        VG.$$('input[name=cm-usou]', m).forEach((r) => (r.onchange = () => {
          estado.usou = r.value === 'sim';
          VG.$('#cm-ed', m).classList.toggle('hidden', !estado.usou);
          VG.$('#cm-nao-box', m).classList.toggle('hidden', estado.usou);
        }));
      },
      actions: [
        { label: 'Voltar' },
        { label: 'Salvar materiais', cls: 'btn-primary', icon: 'check', onClick: async () => {
          if (estado.usou !== true && estado.usou !== false) { VG.toast('Informe se foi utilizado algum material.', 'warn'); return false; }
          if (estado.usou && !estado.itens.length) { VG.toast('Adicione os materiais utilizados ou marque NÃO.', 'warn'); return false; }
          if (estado.usou && VG.$$('#cm-list .mat-ed.invalid').length) { VG.toast('Confira as quantidades e os valores marcados em vermelho.', 'warn'); return false; }
          try {
            await S().corrigirMateriais(id, { usouMaterial: estado.usou, materiais: estado.usou ? estado.itens : [] });
            VG.toast('Materiais utilizados salvos na OS.', 'success');
            done && done();
          } catch (e) { VG.toast('Não foi possível salvar a correção: ' + e.message, 'error', 7000); return false; }
        } },
      ],
    });
  }

  /* ---------- ESCOLHER TÉCNICO NA OS ---------- */
  function tecnicoPanelHTML(os) {
    const tecs = S().list('tecnicos').filter((t) => t.ativo !== false || t.id === os.tecnicoId).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return `
      <section class="panel"><div class="panel__head"><h3>${VG.icon('user')}Técnico responsável</h3></div>
        <div class="panel__body stack">
          <div class="field"><label for="d-tec">Quem vai fazer o serviço</label>
            <select id="d-tec" class="select">${VG.options(tecs.map((t) => ({ value: t.id, label: t.nome + (t.especialidade ? ' — ' + t.especialidade : '') })), os.tecnicoId || '', 'Sem técnico definido')}</select></div>
          <button class="btn btn-primary" id="d-tec-ok">${VG.icon('check')}<span>${os.tecnicoId ? 'Trocar técnico' : 'Enviar para o técnico'}</span></button>
          <span class="hint">A OS aparece na hora na lista do técnico escolhido, marcada com a prioridade <b>${VG.esc((VG.PRIORIDADES[os.prioridade] || {}).label || os.prioridade)}</b>.</span>
        </div></section>`;
  }

  function atribuir(os, tecnicoId) {
    const tec = tecnicoId ? S().get('tecnicos', tecnicoId) : null;
    const autor = me().nome || 'Supervisora';
    os.tecnicoId = tec ? tec.id : null;
    os.tecnicoNome = tec ? tec.nome : '';
    os.tokenTecnico = VG.token(10);
    if (tec) {
      S().hist(os, `OS enviada para ${tec.nome}.`, autor);
      S().log(`Técnico ${tec.nome.split(' ')[0]} recebeu a OS #${os.numero}`, os.id, 'user');
      if (os.status === 'aberta') os.status = 'aguardando_tecnico';
      VG.toast(`OS #${os.numero} enviada para ${tec.nome}.`, 'success');
    } else {
      if (os.status === 'aguardando_tecnico') os.status = 'aberta';
      S().hist(os, 'Técnico removido da OS.', autor);
      VG.toast('Técnico removido da OS.', 'info');
    }
    S().save('ordens', os);
  }

  /* ---------- MINHAS OS (técnico logado) ---------- */
  function renderMinhas(el) {
    const s = me();
    const prio = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
    const prazo = (o) => (o.prazoData ? o.prazoData + ' ' + (o.prazoHora || '23:59') : '9999');
    const minhas = S().list('ordens').filter((o) => o.tecnicoId === s.tecnicoId && o.status !== 'cancelada');
    const porUrgencia = (a, b) => (prio[a.prioridade] ?? 2) - (prio[b.prioridade] ?? 2) || prazo(a).localeCompare(prazo(b)) || a.numero - b.numero;
    const andamento = minhas.filter((o) => o.status === 'em_atendimento').sort(porUrgencia);
    const fazer = minhas.filter((o) => o.status === 'aguardando_tecnico' || o.status === 'aberta').sort(porUrgencia);
    const assinatura = minhas.filter((o) => o.status === 'aguardando_cliente').sort(porUrgencia);
    const feitas = minhas.filter((o) => VG.isConcluida(o.status)).sort((a, b) => b.numero - a.numero).slice(0, 10);
    const P = VG.PRIORIDADES;

    const card = (o) => {
      const atrasada = o.prazoData && !VG.isConcluida(o.status) && new Date(`${o.prazoData}T${o.prazoHora || '23:59'}`) < new Date();
      const acao = { aguardando_tecnico: 'Abrir e iniciar', aberta: 'Abrir e iniciar', em_atendimento: devolvida(o) ? 'Completar OS' : 'Continuar atendimento', aguardando_cliente: 'Coletar assinatura', concluida: 'Ver OS', processada: 'Ver OS', reaberta: 'Ver OS' }[o.status];
      return `
      <a class="panel os-card os-card--${o.prioridade}" href="#/atendimento/${o.id}">
        <div class="os-card__top">
          <span class="prio-tag prio-tag--${o.prioridade}">${o.prioridade === 'urgente' ? VG.icon('alert') : ''}${VG.esc((P[o.prioridade] || {}).label || o.prioridade)}</span>
          <span class="os-card__num">OS #${o.numero}</span>
        </div>
        <div class="os-card__client">${VG.esc(o.cliente.nome)}</div>
        ${devolvida(o) ? `<div class="os-card__row os-card__dev">${VG.icon('refresh')}<span><b>Reaberta pela supervisão:</b> ${VG.esc(String(o.devolucao.motivo || '').slice(0, 120))}</span></div>` : ''}
        <div class="os-card__row">${VG.icon('pin')}<span>${VG.esc([[o.cliente.endereco, o.cliente.numero].filter(Boolean).join(', '), o.cliente.bairro, o.cliente.cidade].filter(Boolean).join(' · ') || '—')}</span></div>
        <div class="os-card__row">${VG.icon('wrench')}<span><b>${VG.esc(o.tipo)}</b> · ${VG.esc(o.problema.length > 80 ? o.problema.slice(0, 80) + '…' : o.problema)}</span></div>
        <div class="os-card__foot">
          <span class="${atrasada ? 'os-card__late' : ''}">${o.prazoData ? VG.icon('clock') + (atrasada ? 'Atrasada · ' : 'Prazo ') + VG.fmtInputDate(o.prazoData) + ' ' + VG.esc(o.prazoHora || '') : VG.badge(o.status)}</span>
          <span class="os-card__go">${VG.esc(acao || 'Abrir')}${VG.icon('chevron')}</span>
        </div>
      </a>`;
    };
    const grupo = (titulo, icon, lista, vazio) => lista.length
      ? `<h2 class="os-group">${VG.icon(icon)}${titulo}<span class="count">${lista.length}</span></h2><div class="os-cards">${lista.map(card).join('')}</div>` : (vazio || '');
    const cont = (k) => fazer.concat(andamento).filter((o) => o.prioridade === k).length;
    const pend = andamento.length + fazer.length + assinatura.length;

    el.innerHTML = `
      <div class="page">
        <div class="page-head"><div><h1>Olá, ${VG.esc((s.nome || '').split(' ')[0])}</h1>
          <p>${pend ? `Você tem ${pend} ${pend > 1 ? 'ordens de serviço' : 'ordem de serviço'} para fazer.` : 'Nenhuma OS pendente no momento.'}</p></div>
          <div class="page-head__actions"><button class="btn" id="mo-sync">${VG.icon('refresh')}<span>Atualizar</span></button></div></div>
        ${pend ? `<div class="prio-summary">${['urgente', 'alta', 'normal', 'baixa'].map((k) => `<span class="prio-tag prio-tag--${k}">${VG.esc(P[k].label)} <b>${cont(k)}</b></span>`).join('')}</div>` : ''}
        ${grupo('Em andamento', 'play', andamento)}
        ${grupo('A fazer — por urgência', 'flag', fazer, !andamento.length && !assinatura.length ? `<section class="panel">${VG.empty('check', 'Tudo em dia', 'Quando a supervisão escolher você para uma OS, ela aparece aqui automaticamente.')}</section>` : '')}
        ${grupo('Falta a assinatura do cliente', 'pen', assinatura)}
        ${feitas.length ? `<details class="os-done"><summary>${VG.icon('check')}Concluídas recentemente (${feitas.length})</summary><div class="os-cards">${feitas.map(card).join('')}</div></details>` : ''}
      </div>`;
    VG.$('#mo-sync', el).onclick = async (e) => { VG.setBusy(e.currentTarget, true); await VG.App.sincronizar(true); };
  }

  VG.OS = { renderList, renderForm, renderDetail, renderMinhas, linkModal, linkCard, bindLinkCards, cancelar, fotosHTML, bindThumbs, materiaisHTML, sigHTML, matches };
})();
