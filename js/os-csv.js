/* =========================================================
   VEGAS OS — IMPORTAÇÃO DE ORDENS DE SERVIÇO (CSV)
   Cada linha vira uma OS nova. O cliente precisa já estar
   cadastrado (por código, CPF/CNPJ ou nome). O técnico é
   opcional: sem técnico a OS fica "aberta".
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;
  const me = () => VG.Auth.current() || {};

  const COLS = ['codigo_cliente', 'cpf_cnpj', 'cliente', 'tipo', 'prioridade', 'problema', 'equipamento', 'marca', 'modelo', 'serie', 'patrimonio', 'local', 'tecnico', 'data_prevista', 'hora_prevista'];
  const ALIAS = {
    codigo_cliente: ['codigo_cliente', 'cod_cliente', 'codigo', 'cod'],
    cpf_cnpj: ['cpf_cnpj', 'cpf', 'cnpj', 'documento', 'cpf/cnpj', 'doc'],
    cliente: ['cliente', 'nome_cliente', 'nome', 'razao_social'],
    tipo: ['tipo', 'tipo_atendimento', 'tipo_de_atendimento', 'servico'],
    prioridade: ['prioridade', 'urgencia'],
    problema: ['problema', 'descricao', 'descricao_do_problema', 'defeito', 'relato', 'observacao'],
    equipamento: ['equipamento', 'tipo_equipamento', 'tipo_de_equipamento', 'sistema'],
    marca: ['marca', 'fabricante'],
    modelo: ['modelo'],
    serie: ['serie', 'numero_serie', 'numero_de_serie', 'n_serie'],
    patrimonio: ['patrimonio'],
    local: ['local', 'local_equipamento', 'local_do_equipamento', 'localizacao'],
    tecnico: ['tecnico', 'tecnico_responsavel', 'responsavel', 'usuario_tecnico'],
    data_prevista: ['data_prevista', 'data', 'prazo', 'data_do_atendimento', 'agendamento'],
    hora_prevista: ['hora_prevista', 'hora', 'horario', 'horario_previsto'],
  };
  const PRIOR = { baixa: 'baixa', normal: 'normal', media: 'normal', medio: 'normal', alta: 'alta', urgente: 'urgente', emergencia: 'urgente' };
  const chaveTexto = (t) => VG.norm(t).replace(/[^a-z0-9]/g, '');

  function acharNaLista(valor, lista) {
    const n = chaveTexto(valor);
    return lista.find((x) => chaveTexto(x) === n) || null;
  }

  /** 25/12/2026, 25/12/26, 2026-12-25 → 2026-12-25 */
  function lerData(v) {
    v = String(v || '').trim();
    if (!v) return { ok: '' };
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return valida(+m[1], +m[2], +m[3]);
    m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (m) return valida(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
    return { erro: 'Data prevista inválida (use dd/mm/aaaa)' };
    function valida(a, me_, d) {
      const dt = new Date(a, me_ - 1, d);
      if (dt.getFullYear() !== a || dt.getMonth() !== me_ - 1 || dt.getDate() !== d) return { erro: 'Data prevista inválida' };
      return { ok: `${a}-${String(me_).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }
  }
  /** 8:00, 08h, 8h30, 14:30 → 08:00 */
  function lerHora(v) {
    v = String(v || '').trim().toLowerCase();
    if (!v) return { ok: '' };
    const m = v.match(/^(\d{1,2})\s*[:h]\s*(\d{2})?\s*(min)?$/) || v.match(/^(\d{1,2})$/);
    if (!m || +m[1] > 23 || (m[2] && +m[2] > 59)) return { erro: 'Horário inválido (use 08:00)' };
    return { ok: `${String(m[1]).padStart(2, '0')}:${m[2] || '00'}` };
  }

  function acharCliente(d, clientes) {
    if (d.codigo_cliente) {
      const c = clientes.find((x) => x.codigo && chaveTexto(x.codigo) === chaveTexto(d.codigo_cliente));
      if (c) return { c };
      if (!d.cpf_cnpj && !d.cliente) return { erro: `Código de cliente "${d.codigo_cliente}" não cadastrado` };
    }
    const doc = VG.digits(d.cpf_cnpj);
    if (doc) {
      const achados = clientes.filter((x) => VG.digits(x.cpf_cnpj) === doc);
      if (achados.length === 1) return { c: achados[0] };
      if (achados.length > 1) {
        const porNome = d.cliente ? achados.filter((x) => chaveTexto(x.nome) === chaveTexto(d.cliente)) : [];
        if (porNome.length === 1) return { c: porNome[0] };
        return { erro: `CPF/CNPJ com ${achados.length} unidades — informe o codigo_cliente` };
      }
      if (!d.cliente) return { erro: 'CPF/CNPJ não cadastrado em Clientes' };
    }
    if (d.cliente) {
      const achados = clientes.filter((x) => chaveTexto(x.nome) === chaveTexto(d.cliente));
      if (achados.length === 1) return { c: achados[0] };
      if (achados.length > 1) return { erro: `${achados.length} clientes com esse nome — informe o codigo_cliente` };
      return { erro: 'Cliente não cadastrado — importe ou cadastre o cliente antes' };
    }
    return { erro: 'Informe o cliente (codigo_cliente, cpf_cnpj ou cliente)' };
  }

  function acharTecnico(valor, tecnicos) {
    const n = chaveTexto(valor);
    let t = tecnicos.find((x) => chaveTexto(x.nome) === n || (x.usuario && chaveTexto(x.usuario) === n));
    if (t) return t;
    const primeiro = tecnicos.filter((x) => chaveTexto(String(x.nome).split(' ')[0]) === n);
    return primeiro.length === 1 ? primeiro[0] : null;
  }

  function analisar(text) {
    const rows = VG.CSV.parse(text);
    if (rows.length < 2) return { erroGeral: 'O arquivo está vazio ou só tem o cabeçalho.' };
    const head = rows[0].map((h) => VG.norm(h).replace(/\s+/g, '_'));
    const map = {};
    COLS.forEach((c) => { const i = head.findIndex((h) => ALIAS[c].includes(h)); if (i >= 0) map[c] = i; });
    if (map.problema == null) return { erroGeral: 'Não encontramos a coluna "problema" no cabeçalho. Baixe o modelo CSV e use os mesmos nomes de coluna.' };
    if (map.codigo_cliente == null && map.cpf_cnpj == null && map.cliente == null) return { erroGeral: 'Não encontramos nenhuma coluna de cliente (codigo_cliente, cpf_cnpj ou cliente). Baixe o modelo CSV.' };

    const clientes = S().list('clientes').filter((c) => c.status !== 'inativo');
    const tecnicos = S().list('tecnicos').filter((t) => t.ativo !== false);
    // OS em andamento: evita criar de novo a mesma OS (mesmo cliente + mesmo problema)
    const abertas = new Set(S().list('ordens').filter((o) => !VG.ENCERRADAS.includes(o.status)).map((o) => o.clienteId + '|' + chaveTexto(o.problema)));

    const registros = rows.slice(1).map((r, i) => {
      const d = {};
      COLS.forEach((c) => (d[c] = map[c] != null ? String(r[map[c]] ?? '').trim() : ''));
      const erros = [], avisos = [];
      const cli = acharCliente(d, clientes);
      if (cli.erro) erros.push(cli.erro);
      if (!d.problema) erros.push('Problema em branco');

      let tipo = 'Manutenção';
      if (d.tipo) { tipo = acharNaLista(d.tipo, VG.TIPOS_ATENDIMENTO); if (!tipo) { tipo = 'Manutenção'; avisos.push(`Tipo "${d.tipo}" → Manutenção`); } }
      let prioridade = 'normal';
      if (d.prioridade) { prioridade = PRIOR[chaveTexto(d.prioridade)]; if (!prioridade) { prioridade = 'normal'; avisos.push(`Prioridade "${d.prioridade}" → Normal`); } }
      let equip = '';
      if (d.equipamento) { equip = acharNaLista(d.equipamento, VG.EQUIPAMENTOS); if (!equip) { equip = 'Outro'; avisos.push(`Equipamento "${d.equipamento}" → Outro`); } }
      let tec = null;
      if (d.tecnico) { tec = acharTecnico(d.tecnico, tecnicos); if (!tec) avisos.push(`Técnico "${d.tecnico}" não encontrado — OS fica aberta`); }
      const dt = lerData(d.data_prevista), hr = lerHora(d.hora_prevista);
      if (dt.erro) erros.push(dt.erro);
      if (hr.erro) erros.push(hr.erro);

      let situacao = erros.length ? 'erro' : 'ok';
      if (situacao === 'ok') {
        const k = cli.c.id + '|' + chaveTexto(d.problema);
        if (abertas.has(k)) { situacao = 'duplicado'; erros.push('Já existe OS em andamento com esse cliente e problema'); }
        else abertas.add(k);
      }
      return {
        linha: i + 2, situacao, erros: erros.concat(situacao === 'ok' ? avisos : []),
        cliente: cli.c || null, tecnico: tec, dados: d,
        os: { tipo, prioridade, problema: d.problema, prazoData: dt.ok || '', prazoHora: hr.ok || '',
          equipamento: { tipo: equip, marca: d.marca, modelo: d.modelo, serie: d.serie, patrimonio: d.patrimonio, local: d.local } },
      };
    });
    return { registros, total: registros.length, validos: registros.filter((r) => r.situacao === 'ok').length, problemas: registros.filter((r) => r.situacao !== 'ok').length };
  }

  /** Monta a OS completa, igual à criada pelo formulário */
  function montarOS(r) {
    const autor = me().nome || 'Supervisora';
    const c = r.cliente, t = r.tecnico;
    const cliente = {};
    ['nome', 'cpf_cnpj', 'telefone', 'email', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep'].forEach((k) => (cliente[k] = c[k] || ''));
    cliente.codigo = c.codigo || '';
    const os = Object.assign({
      numero: 0, criadaEm: VG.nowISO(), criadaPor: autor,
      status: t ? 'aguardando_tecnico' : 'aberta',
      clienteId: c.id, cliente, materiaisLevar: [],
      tecnicoId: t ? t.id : null, tecnicoNome: t ? t.nome : '',
      tokenTecnico: '', tokenCliente: '',
      atendimento: { inicio: null, fim: null, diagnostico: '', servico: '', materiais: [], observacoes: '', fotos: { antes: [], depois: [] } },
      assinaturaTecnico: null, assinaturaCliente: null, historico: [],
    }, r.os);
    S().hist(os, 'OS criada pela supervisora (importação CSV).', autor);
    if (t) S().hist(os, `OS enviada para ${t.nome}.`, autor);
    return os;
  }

  function baixarModelo() {
    const linhas = [
      COLS.join(','),
      'C0100,,,Manutenção,alta,Câmera 04 sem imagem desde ontem,Câmera,Intelbras,VHD 1220,,,Garagem bloco B,Nome do Técnico,30/09/2026,09:00',
      ',11222333000181,,Preventiva,normal,Revisão mensal do sistema de alarme,Central de alarme,,,,,Portaria,,01/10/2026,',
      ',,Maria da Silva,Instalação,baixa,"Instalar interfone na entrada, lado esquerdo",Interfone,,,,,,,,',
    ];
    VG.download('modelo_ordens_servico_vegas.csv', '\uFEFF' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function importar(done) {
    let analise = null;
    const modal = VG.modal({
      title: 'Importar ordens de serviço CSV', size: 'xl',
      body: `
        <label class="csv-drop" id="ocsv-drop" for="ocsv-file">
          <span class="empty__icon">${VG.icon('sheet')}</span>
          <strong>Selecione ou arraste um arquivo .csv</strong>
          <span class="muted" style="font-size:.85rem">Colunas: ${COLS.join(', ')}</span>
          <input type="file" id="ocsv-file" accept=".csv,text/csv" class="sr-only">
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-top:1rem;flex-wrap:wrap">
          <span class="hint">Obrigatórios: o cliente (por <b>codigo_cliente</b>, <b>cpf_cnpj</b> ou nome em <b>cliente</b>) e o <b>problema</b>. O cliente precisa já estar cadastrado. Cada linha vira uma OS nova, com número automático. Sem técnico, a OS fica aberta.</span>
          <button type="button" class="btn btn-sm" id="ocsv-model">${VG.icon('download')}<span>Baixar modelo CSV</span></button>
        </div>
        <div id="ocsv-step2" class="hidden"></div>`,
      actions: [
        { label: 'Cancelar' },
        { label: 'Confirmar importação', cls: 'btn-primary', icon: 'check', onClick: async () => {
          if (!analise || !analise.validos) { VG.toast('Selecione um arquivo com OS válidas.', 'warn'); return false; }
          const prontos = analise.registros.filter((r) => r.situacao === 'ok');
          const items = prontos.map(montarOS);
          const btn = modal.el.querySelector('.modal__foot .btn-primary');
          VG.setBusy(btn, true, 'Importando…');
          try {
            const criadas = await S().importOS(items, (i, n) => { const sp = btn.querySelector('span'); if (sp) sp.textContent = `Criando ${i} de ${n}…`; });
            criadas.filter((o) => o.tecnicoId).forEach((o) => S().log(`Técnico ${String(o.tecnicoNome).split(' ')[0]} recebeu a OS #${o.numero}`, o.id, 'user'));
            VG.toast(`${criadas.length} ${criadas.length === 1 ? 'OS importada' : 'OS importadas'} com sucesso.`, 'success', 6000);
            done && done();
            resultado(criadas);
          } catch (e) {
            VG.setBusy(btn, false);
            VG.toast('Não foi possível importar: ' + e.message, 'error', 8000);
            done && done();
            return false;
          }
        } },
      ],
    });
    const m = modal.el;
    const confirmBtn = m.querySelector('.modal__foot .btn-primary');
    confirmBtn.disabled = true;
    m.querySelector('#ocsv-model').onclick = baixarModelo;
    const input = m.querySelector('#ocsv-file');
    const drop = m.querySelector('#ocsv-drop');
    const processar = async (file) => {
      if (!file) return;
      if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') { VG.toast('Selecione um arquivo com extensão .csv.', 'warn'); return; }
      const step2 = m.querySelector('#ocsv-step2');
      step2.classList.remove('hidden'); step2.innerHTML = VG.loading('Lendo arquivo…');
      try { analise = analisar(await VG.CSV.lerArquivo(file)); } catch (e) { analise = { erroGeral: e.message }; }
      if (analise.erroGeral) {
        step2.innerHTML = `<div class="notice" style="margin-top:1rem">${VG.icon('alert')}<div>${VG.esc(analise.erroGeral)}</div></div>`;
        confirmBtn.disabled = true; analise = null; return;
      }
      const sit = { ok: '<span class="badge badge--green"><i></i>Pronto</span>', erro: '<span class="badge badge--red"><i></i>Erro</span>', duplicado: '<span class="badge badge--yellow"><i></i>Duplicado</span>' };
      const pr = (k) => (VG.PRIORIDADES[k] || {}).label || k;
      step2.innerHTML = `
        <hr class="divider">
        <p style="margin:0 0 .8rem"><strong>${VG.esc(file.name)}</strong></p>
        <div class="csv-summary">
          <div><b>${analise.total}</b><span>${analise.total === 1 ? 'OS encontrada' : 'OS encontradas'}</span></div>
          <div><b style="color:var(--st-green)">${analise.validos}</b><span>${analise.validos === 1 ? 'pronta' : 'prontas'} para importação</span></div>
          <div><b style="color:${analise.problemas ? 'var(--st-red)' : 'inherit'}">${analise.problemas}</b><span>${analise.problemas === 1 ? 'registro possui' : 'registros possuem'} problemas</span></div>
        </div>
        <div class="csv-preview"><table class="table"><thead><tr><th>Linha</th><th>Situação</th><th>Cliente</th><th>Tipo</th><th>Prioridade</th><th>Problema</th><th>Técnico</th><th>Previsão</th><th>Observação</th></tr></thead><tbody>
          ${analise.registros.slice(0, 500).map((r) => `<tr class="${r.situacao === 'erro' ? 'row-err' : r.situacao === 'duplicado' ? 'row-dup' : ''}">
            <td class="num">${r.linha}</td><td>${sit[r.situacao]}</td>
            <td>${VG.esc(r.cliente ? r.cliente.nome : (r.dados.cliente || r.dados.codigo_cliente || VG.fmtDoc(r.dados.cpf_cnpj) || '—'))}</td>
            <td>${VG.esc(r.os.tipo)}</td><td>${VG.esc(pr(r.os.prioridade))}</td>
            <td>${VG.esc((r.os.problema || '—').slice(0, 80))}${(r.os.problema || '').length > 80 ? '…' : ''}</td>
            <td>${VG.esc(r.tecnico ? r.tecnico.nome : '—')}</td>
            <td>${VG.esc([r.os.prazoData ? VG.fmtDate(r.os.prazoData + 'T12:00:00') : '', r.os.prazoHora].filter(Boolean).join(' ') || '—')}</td>
            <td class="faint">${VG.esc(r.erros.join(', '))}</td></tr>`).join('')}
        </tbody></table></div>
        ${analise.registros.length > 500 ? '<p class="hint">Mostrando as 500 primeiras linhas. O limite é de 500 OS por arquivo.</p>' : ''}`;
      confirmBtn.disabled = !analise.validos;
      confirmBtn.querySelector('span').textContent = analise.validos ? `Importar ${analise.validos} ${analise.validos === 1 ? 'OS' : 'OS'}` : 'Nada para importar';
      if (analise.validos > 500) { confirmBtn.disabled = true; confirmBtn.querySelector('span').textContent = 'Máximo de 500 OS por arquivo'; }
    };
    input.onchange = () => processar(input.files[0]);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => processar(e.dataTransfer.files[0]));
  }

  /** Lista das OS criadas, com opção de baixar os links dos técnicos */
  function resultado(criadas) {
    const baixarLinks = () => {
      const csv = VG.CSV.gerar([
        { label: 'OS', get: (o) => o.numero },
        { label: 'Cliente', get: (o) => o.cliente.nome },
        { label: 'Técnico', get: (o) => o.tecnicoNome || '' },
        { label: 'Link do técnico', get: (o) => (o.tecnicoId ? VG.linkFor(o, 'tecnico') : '') },
        { label: 'Link do cliente', get: (o) => VG.linkFor(o, 'cliente') },
      ], criadas);
      VG.download('os_importadas_links.csv', csv, 'text/csv;charset=utf-8');
    };
    VG.modal({
      title: `${criadas.length} ${criadas.length === 1 ? 'OS criada' : 'OS criadas'}`, size: 'lg',
      body: `
        <p style="margin-top:0">As OS com técnico já aparecem na lista de cada técnico. As que ficaram sem técnico estão como <strong>abertas</strong>, é só escolher o técnico na própria OS.</p>
        <div class="table-wrap"><table class="table"><thead><tr><th>OS</th><th>Cliente</th><th>Técnico</th></tr></thead><tbody>
          ${criadas.map((o) => `<tr><td><a href="#/os/ver/${o.id}" class="tag">#${o.numero}</a></td><td>${VG.esc(o.cliente.nome)}</td><td>${o.tecnicoNome ? VG.esc(o.tecnicoNome) : '<span class="faint">sem técnico</span>'}</td></tr>`).join('')}
        </tbody></table></div>`,
      actions: [
        { label: 'Baixar lista com links', icon: 'download', onClick: () => { baixarLinks(); return false; } },
        { label: 'Fechar', cls: 'btn-primary' },
      ],
    });
  }

  VG.OSCSV = { COLS, analisar, importar, baixarModelo };
})();
