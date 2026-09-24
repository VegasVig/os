/* =========================================================
   VEGAS OS — ORDENS DE SERVIÇO
   Lista com filtros, criação/edição, detalhe, links e ações.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;
  const me = () => VG.Auth.current() || {};

  const FINAIS = ['concluida', 'cancelada'];
  let filtros = { q: '', status: '', tecnico: '', cliente: '', de: '', ate: '', prioridade: '', tipo: '' };

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

  function aplicarFiltros(list) {
    const f = filtros;
    const de = f.de ? new Date(f.de + 'T00:00:00') : null;
    const ate = f.ate ? new Date(f.ate + 'T23:59:59') : null;
    return list.filter((o) =>
      (!f.status || o.status === f.status) &&
      (!f.tecnico || o.tecnicoId === f.tecnico || (f.tecnico === '_sem' && !o.tecnicoId)) &&
      (!f.cliente || o.clienteId === f.cliente) &&
      (!f.prioridade || o.prioridade === f.prioridade) &&
      (!f.tipo || o.tipo === f.tipo) &&
      (!de || new Date(o.criadaEm) >= de) && (!ate || new Date(o.criadaEm) <= ate) &&
      matches(o, f.q));
  }

  /* ---------- LISTA ---------- */
  function renderList(el, params = {}) {
    // filtros vindos da URL (#/os?status=...)
    if (Object.keys(params).length) filtros = Object.assign({ q: '', status: '', tecnico: '', cliente: '', de: '', ate: '', prioridade: '', tipo: '' }, params);
    const tecnicos = S().list('tecnicos');
    const clientes = S().list('clientes').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const f = filtros;
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div><h1>Ordens de serviço</h1><p>Acompanhe cada atendimento do início até a assinatura do cliente.</p></div>
          <div class="page-head__actions">
            <a class="btn btn-primary" href="#/os/nova">${VG.icon('plus')}<span>Nova ordem de serviço</span></a>
          </div>
        </div>
        <section class="panel">
          <div class="toolbar">
            <div class="field field--search"><label for="f-q">Pesquisar OS</label>
              <div class="input-group">${VG.icon('search')}<input id="f-q" class="input" placeholder="Nº, cliente, CPF/CNPJ, técnico, equipamento…" value="${VG.esc(f.q)}"></div></div>
            <div class="field"><label for="f-status">Status</label><select id="f-status" class="select" data-f="status">${VG.statusOptions(f.status)}</select></div>
            <div class="field"><label for="f-tec">Técnico</label><select id="f-tec" class="select" data-f="tecnico">${VG.options([{ value: '_sem', label: 'Sem técnico' }, ...tecnicos.map((t) => ({ value: t.id, label: t.nome }))], f.tecnico, 'Todos')}</select></div>
            <div class="field"><label for="f-cli">Cliente</label><select id="f-cli" class="select" data-f="cliente">${VG.options(clientes.map((c) => ({ value: c.id, label: c.nome })), f.cliente, 'Todos')}</select></div>
            <div class="field"><label for="f-pr">Prioridade</label><select id="f-pr" class="select" data-f="prioridade">${VG.options(Object.entries(VG.PRIORIDADES).map(([k, p]) => ({ value: k, label: p.label })), f.prioridade, 'Todas')}</select></div>
            <div class="field"><label for="f-tipo">Tipo</label><select id="f-tipo" class="select" data-f="tipo">${VG.options(VG.TIPOS_ATENDIMENTO, f.tipo, 'Todos')}</select></div>
            <div class="field"><label for="f-de">De</label><input id="f-de" type="date" class="input" data-f="de" value="${f.de}"></div>
            <div class="field"><label for="f-ate">Até</label><input id="f-ate" type="date" class="input" data-f="ate" value="${f.ate}"></div>
            <button class="btn btn-ghost btn-sm" id="f-clear" style="margin-bottom:3px">${VG.icon('x')}<span>Limpar</span></button>
          </div>
          <div id="os-table"></div>
        </section>
      </div>`;
    VG.$('#f-q', el).addEventListener('input', VG.debounce((e) => { filtros.q = e.target.value; table(el); }, 200));
    VG.$$('[data-f]', el).forEach((s) => (s.onchange = () => { filtros[s.dataset.f] = s.value; table(el); }));
    VG.$('#f-clear', el).onclick = () => { filtros = { q: '', status: '', tecnico: '', cliente: '', de: '', ate: '', prioridade: '', tipo: '' }; if (location.hash !== '#/os') location.hash = '#/os'; else renderList(el); };
    table(el);
  }

  function table(el) {
    const box = VG.$('#os-table', el);
    const all = S().list('ordens');
    const list = aplicarFiltros(all).sort((a, b) => b.numero - a.numero);
    if (!list.length) {
      box.innerHTML = all.length
        ? VG.empty('search', 'Nenhuma OS encontrada', 'Nenhuma ordem corresponde aos filtros. Ajuste a pesquisa ou limpe os filtros.')
        : VG.empty('os', 'Nenhuma OS criada', 'Crie a primeira ordem de serviço para começar.', `<a class="btn btn-primary" href="#/os/nova">${VG.icon('plus')}<span>Nova ordem de serviço</span></a>`);
      return;
    }
    box.innerHTML = `
      <div class="table-wrap"><table class="table table--cards">
        <thead><tr><th>Nº OS</th><th>Cliente</th><th>Técnico</th><th>Tipo</th><th>Prioridade</th><th>Data</th><th>Status</th><th style="text-align:right">Ações</th></tr></thead>
        <tbody>${list.map((o) => `
          <tr data-id="${o.id}" class="clickable">
            <td data-label="Nº OS" class="num">#${o.numero}</td>
            <td data-label="Cliente"><span class="strong">${VG.esc(o.cliente && o.cliente.nome)}</span><span class="sub">${VG.esc((o.equipamento && o.equipamento.tipo) || '')}</span></td>
            <td data-label="Técnico">${VG.esc(o.tecnicoNome || '—')}</td>
            <td data-label="Tipo">${VG.esc(o.tipo)}</td>
            <td data-label="Prioridade">${VG.prioBadge(o.prioridade)}</td>
            <td data-label="Data">${VG.fmtDate(o.criadaEm)}</td>
            <td data-label="Status">${VG.badge(o.status)}</td>
            <td data-label="" class="row-actions-cell"><div class="row-actions">
              <button class="btn btn-ghost btn-icon" data-act="view" title="Visualizar" aria-label="Visualizar">${VG.icon('eye')}</button>
              <button class="btn btn-ghost btn-icon" data-act="edit" title="Editar" aria-label="Editar" ${FINAIS.includes(o.status) ? 'disabled' : ''}>${VG.icon('edit')}</button>
              <button class="btn btn-ghost btn-icon" data-act="pdf" title="Gerar PDF" aria-label="Gerar PDF">${VG.icon('pdf')}</button>
              <button class="btn btn-ghost btn-icon" data-act="link" title="Copiar link" aria-label="Copiar link" ${o.status === 'cancelada' ? 'disabled' : ''}>${VG.icon('link')}</button>
              <button class="btn btn-ghost btn-icon" data-act="cancel" title="Cancelar OS" aria-label="Cancelar OS" ${FINAIS.includes(o.status) ? 'disabled' : ''}>${VG.icon('ban')}</button>
            </div></td>
          </tr>`).join('')}</tbody>
      </table></div>
      <div class="table-foot"><span>${list.length} de ${all.length} ordens</span></div>`;
    box.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id;
      tr.addEventListener('click', (e) => { if (!e.target.closest('button')) location.hash = '#/os/ver/' + id; });
      const on = (a, fn) => (tr.querySelector(`[data-act=${a}]`).onclick = (e) => { e.stopPropagation(); fn(); });
      on('view', () => (location.hash = '#/os/ver/' + id));
      on('edit', () => (location.hash = '#/os/editar/' + id));
      on('pdf', () => VG.PDF.gerar(S().get('ordens', id)));
      on('link', () => linkModal(S().get('ordens', id)));
      on('cancel', () => cancelar(id, () => table(el)));
    });
  }

  /* ---------- FORMULÁRIO ---------- */
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
                <select id="os-tipo" name="tipo" class="select">${VG.options(VG.TIPOS_ATENDIMENTO, os ? os.tipo : 'Manutenção')}</select></div>
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
            <div class="panel__body"><div class="field"><label for="os-prob" class="sr-only">Descrição do problema</label>
              <textarea id="os-prob" name="problema" class="textarea lg" placeholder="Ex.: Cliente informa que a câmera 04 está sem imagem desde ontem.">${v(os && os.problema)}</textarea></div></div>
          </section>

          <section class="panel">
            <div class="panel__head"><h2>${VG.icon('shield')}Técnico e prazo</h2></div>
            <div class="panel__body grid grid-3">
              <div class="field"><label for="os-tec">Técnico responsável</label>
                <select id="os-tec" name="tecnicoId" class="select">${VG.options(tecnicos.map((t) => ({ value: t.id, label: `${t.nome}${t.especialidade ? ' — ' + t.especialidade : ''}` })), os ? os.tecnicoId : '', 'Definir depois (OS fica aberta)')}</select></div>
              <div class="field"><label for="os-pdata">Data prevista</label><input id="os-pdata" name="prazoData" type="date" class="input" value="${v(os ? os.prazoData : VG.toInputDate())}"></div>
              <div class="field"><label for="os-phora">Horário previsto</label><input id="os-phora" name="prazoHora" type="time" class="input" value="${v(os ? os.prazoHora : '')}"></div>
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
      const equipamento = {};
      ['tipo', 'marca', 'modelo', 'serie', 'patrimonio', 'local'].forEach((k) => (equipamento[k] = (fd['e_' + k] || '').trim()));
      const tec = fd.tecnicoId ? S().get('tecnicos', fd.tecnicoId) : null;
      const autor = me().nome || 'Supervisora';

      try {
        if (!editing) {
          const nova = {
            numero: 0, criadaEm: VG.nowISO(), criadaPor: autor,
            prioridade: fd.prioridade || 'normal', tipo: fd.tipo, status: tec ? 'aguardando_tecnico' : 'aberta',
            clienteId: fd.clienteId, cliente, equipamento, problema: fd.problema.trim(),
            tecnicoId: tec ? tec.id : null, tecnicoNome: tec ? tec.nome : '',
            prazoData: fd.prazoData || '', prazoHora: fd.prazoHora || '',
            tokenTecnico: '', tokenCliente: '',
            atendimento: { inicio: null, fim: null, diagnostico: '', servico: '', materiais: [], observacoes: '', fotos: { antes: [], depois: [] } },
            assinaturaTecnico: null, assinaturaCliente: null, historico: [],
          };
          S().hist(nova, 'OS criada pela supervisora.', autor);
          if (tec) S().hist(nova, `OS enviada para ${tec.nome}.`, autor);
          Object.assign(nova, await S().createOS(nova)); // número e links gerados no servidor
          S().log(`OS #${nova.numero} criada`, nova.id, 'plus');
          if (tec) S().log(`Técnico ${tec.nome.split(' ')[0]} recebeu a OS #${nova.numero}`, nova.id, 'user');
          location.hash = '#/os/ver/' + nova.id;
          setTimeout(() => criadaModal(nova), 120);
        } else {
          const antes = { tecnicoId: os.tecnicoId };
          Object.assign(os, { prioridade: fd.prioridade, tipo: fd.tipo, clienteId: fd.clienteId, cliente, equipamento, problema: fd.problema.trim(), prazoData: fd.prazoData, prazoHora: fd.prazoHora });
          S().hist(os, 'OS editada pela supervisora.', autor);
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
  function materiaisHTML(mats) {
    if (!mats || !mats.length) return '<p class="faint" style="margin:0">Nenhum material registrado.</p>';
    return `<table class="materials"><thead><tr><th>Material</th><th>Quantidade</th></tr></thead><tbody>${mats.map((m) => `<tr><td>${VG.esc(m.descricao)}</td><td class="mono-num">${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderDetail(el, id) {
    const os = S().get('ordens', id);
    if (!os) { el.innerHTML = VG.empty('alert', 'OS não encontrada', 'Ela pode ter sido removida.', '<a class="btn" href="#/os">Voltar para a lista</a>'); return; }
    const c = os.cliente || {}, e = os.equipamento || {}, a = os.atendimento || {};
    const final = FINAIS.includes(os.status);
    el.innerHTML = `
      <div class="page">
        <div><a class="btn btn-ghost btn-sm" href="#/os">${VG.icon('back')}<span>Ordens de serviço</span></a></div>
        <section class="panel os-hero">
          <div>
            <div class="os-hero__num"><h1>OS #${os.numero}</h1>${VG.badge(os.status, true)}${VG.prioBadge(os.prioridade)}</div>
            <div class="os-hero__meta">
              <span>${VG.icon('calendar')}Aberta em ${VG.fmtDateTime(os.criadaEm)}</span>
              <span>${VG.icon('wrench')}${VG.esc(os.tipo)}</span>
              <span>${VG.icon('user')}${VG.esc(os.tecnicoNome || 'Sem técnico')}</span>
              ${os.prazoData ? `<span>${VG.icon('clock')}Prazo ${VG.fmtInputDate(os.prazoData)} ${VG.esc(os.prazoHora || '')}</span>` : ''}
            </div>
          </div>
          <div class="page-head__actions">
            ${!final ? `<a class="btn" href="#/os/editar/${os.id}">${VG.icon('edit')}<span>Editar</span></a>` : ''}
            ${os.status !== 'cancelada' ? `<button class="btn" id="d-links">${VG.icon('link')}<span>Links</span></button>` : ''}
            <button class="btn btn-primary" id="d-pdf">${VG.icon('pdf')}<span>Gerar PDF</span></button>
            ${!final ? `<button class="btn btn-danger" id="d-cancel">${VG.icon('ban')}<span>Cancelar</span></button>` : ''}
          </div>
        </section>

        ${os.status === 'cancelada' ? `<div class="notice">${VG.icon('ban')}<div><strong>OS cancelada</strong> em ${VG.fmtDateTime(os.canceladaEm || (os.historico.slice(-1)[0] || {}).dataHora)}. Motivo: ${VG.esc(os.canceladaMotivo || '—')}</div></div>` : ''}
        ${os.status === 'aguardando_cliente' ? `<div class="notice notice--info">${VG.icon('pen')}<div>Atendimento finalizado pelo técnico. Falta a assinatura do cliente — envie o <button class="btn btn-ghost btn-sm" id="d-link-cli" style="display:inline-flex;height:auto;padding:0 .2rem;text-decoration:underline">link do cliente</button>.</div></div>` : ''}

        <div class="detail-grid">
          <div class="stack">
            <section class="panel"><div class="panel__head"><h3>${VG.icon('user')}Cliente</h3></div>
              <div class="panel__body kv">
                ${VG.kv('Nome / Razão social', c.nome)}${VG.kv('CPF/CNPJ', VG.fmtDoc(c.cpf_cnpj))}
                ${VG.kv('Telefone', c.telefone ? `<a href="tel:${VG.digits(c.telefone)}">${VG.esc(VG.fmtPhone(c.telefone))}</a>` : '', true)}
                ${VG.kv('E-mail', c.email)}
                <div class="kv__item" style="grid-column:1/-1"><div class="kv__k">Endereço</div><div class="kv__v">${VG.esc(VG.enderecoCompleto(c) || '—')} ${c.endereco ? `· <a href="${VG.mapsLink(c)}" target="_blank" rel="noopener">Abrir no mapa</a>` : ''}</div></div>
              </div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('video')}Equipamento</h3></div>
              <div class="panel__body kv kv--3">${VG.kv('Tipo', e.tipo)}${VG.kv('Marca', e.marca)}${VG.kv('Modelo', e.modelo)}${VG.kv('Nº de série', e.serie)}${VG.kv('Patrimônio', e.patrimonio)}${VG.kv('Local', e.local)}</div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('alert')}Problema relatado</h3></div>
              <div class="panel__body"><p class="text-block">${VG.esc(os.problema)}</p></div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('wrench')}Atendimento técnico</h3>
              <span class="faint" style="font-size:.8rem">${a.inicio ? `Início ${VG.fmtDateTime(a.inicio)}${a.fim ? ' · Fim ' + VG.fmtDateTime(a.fim) : ''}` : 'Não iniciado'}</span></div>
              <div class="panel__body stack">
                <div><div class="kv__k">Diagnóstico</div><p class="text-block">${VG.esc(a.diagnostico || '—')}</p></div>
                <div><div class="kv__k">Serviço executado</div><p class="text-block">${VG.esc(a.servico || '—')}</p></div>
                <div><div class="kv__k" style="margin-bottom:.3rem">Materiais utilizados</div>${materiaisHTML(a.materiais)}</div>
                <div><div class="kv__k">Observações do técnico</div><p class="text-block">${VG.esc(a.observacoes || '—')}</p></div>
                ${os.assinaturaCliente && os.assinaturaCliente.observacoes ? `<div><div class="kv__k">Observações do cliente</div><p class="text-block">${VG.esc(os.assinaturaCliente.observacoes)}</p></div>` : ''}
              </div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('camera')}Fotos</h3></div><div class="panel__body" id="d-fotos">${fotosHTML(a.fotos)}</div></section>
          </div>

          <div class="stack">
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
    bindThumbs(VG.$('#d-fotos', el), a.fotos || { antes: [], depois: [] });
  }

  /* ---------- MINHAS OS (técnico logado) ---------- */
  function renderMinhas(el) {
    const s = me();
    const ordem = { em_atendimento: 0, aguardando_tecnico: 1, aberta: 2, aguardando_cliente: 3, concluida: 4, cancelada: 5 };
    const prio = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
    const list = S().list('ordens').filter((o) => o.tecnicoId === s.tecnicoId && o.status !== 'cancelada')
      .sort((a, b) => ordem[a.status] - ordem[b.status] || prio[a.prioridade] - prio[b.prioridade] || b.numero - a.numero);
    const pend = list.filter((o) => !FINAIS.includes(o.status));
    const hist = list.filter((o) => o.status === 'concluida').slice(0, 12);
    const card = (o) => `
      <a class="panel os-card" href="#/atendimento/${o.id}">
        <div class="os-card__top"><span class="os-card__num">OS #${o.numero}</span>${VG.badge(o.status)}</div>
        <div class="os-card__client">${VG.esc(o.cliente.nome)}</div>
        <div class="os-card__row">${VG.icon('pin')}<span>${VG.esc([o.cliente.endereco, o.cliente.numero, o.cliente.bairro].filter(Boolean).join(', ') || '—')}</span></div>
        <div class="os-card__row">${VG.icon('alert')}<span>${VG.esc(o.problema.length > 90 ? o.problema.slice(0, 90) + '…' : o.problema)}</span></div>
        <div class="os-card__row" style="justify-content:space-between">${VG.prioBadge(o.prioridade)}<span>${o.prazoData ? VG.icon('clock') + ' ' + VG.fmtInputDate(o.prazoData) + ' ' + VG.esc(o.prazoHora || '') : ''}</span></div>
      </a>`;
    el.innerHTML = `
      <div class="page">
        <div class="page-head"><div><h1>Minhas ordens de serviço</h1><p>${pend.length ? `${pend.length} ${pend.length > 1 ? 'atendimentos pendentes' : 'atendimento pendente'}.` : 'Nenhum atendimento pendente.'}</p></div></div>
        ${pend.length ? `<div class="os-cards">${pend.map(card).join('')}</div>` : `<section class="panel">${VG.empty('check', 'Tudo em dia', 'Quando a supervisão enviar uma OS para você, ela aparece aqui.')}</section>`}
        ${hist.length ? `<h2 style="font-size:1.1rem;margin-top:.6rem">Concluídas recentemente</h2><div class="os-cards">${hist.map(card).join('')}</div>` : ''}
      </div>`;
  }

  VG.OS = { renderList, renderForm, renderDetail, renderMinhas, linkModal, linkCard, bindLinkCards, cancelar, fotosHTML, bindThumbs, materiaisHTML, sigHTML, matches };
})();
