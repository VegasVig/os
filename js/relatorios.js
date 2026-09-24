/* =========================================================
   VEGAS OS — RELATÓRIOS
   Indicadores por período, técnico, tipo e equipamento + exportação CSV.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;

  let periodo = { preset: '30', de: '', ate: '' };

  function intervalo() {
    if (periodo.preset === 'custom') {
      return { de: periodo.de ? new Date(periodo.de + 'T00:00:00') : null, ate: periodo.ate ? new Date(periodo.ate + 'T23:59:59') : null };
    }
    if (periodo.preset === 'all') return { de: null, ate: null };
    const de = new Date(); de.setHours(0, 0, 0, 0); de.setDate(de.getDate() - Number(periodo.preset) + 1);
    return { de, ate: null };
  }

  const horas = (ms) => {
    if (!ms || !isFinite(ms)) return '—';
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 48) return `${h}h${m ? String(m).padStart(2, '0') : ''}`;
    return `${Math.round(h / 24)} dias`;
  };
  const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const duracao = (o) => (o.atendimento && o.atendimento.inicio && o.atendimento.fim ? new Date(o.atendimento.fim) - new Date(o.atendimento.inicio) : null);
  const ciclo = (o) => (o.status === 'concluida' && o.assinaturaCliente ? new Date(o.assinaturaCliente.dataHora) - new Date(o.criadaEm) : null);

  function filtrar() {
    const { de, ate } = intervalo();
    return S().list('ordens').filter((o) => { const d = new Date(o.criadaEm); return (!de || d >= de) && (!ate || d <= ate); });
  }

  function hbars(items) {
    if (!items.length) return '<p class="faint" style="margin:0">Sem dados no período.</p>';
    const max = Math.max(1, ...items.map((i) => i.v));
    return `<div class="hbars">${items.map((i) => `
      <div><div class="hbar__top"><span>${VG.esc(i.l)}</span><b>${i.v}</b></div>
      <div class="hbar__track"><div class="hbar__fill" style="width:${(i.v / max) * 100}%;${i.c ? 'background:' + i.c : ''}"></div></div></div>`).join('')}</div>`;
  }

  function agrupar(list, keyFn) {
    const m = {};
    list.forEach((o) => { const k = keyFn(o) || 'Não informado'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v);
  }

  function render(el) {
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div><h1>Relatórios</h1><p>Indicadores de desempenho dos atendimentos.</p></div>
          <div class="page-head__actions">
            <button class="btn" id="r-csv">${VG.icon('download')}<span>Exportar CSV</span></button>
          </div>
        </div>
        <section class="panel"><div class="toolbar">
          <div class="field"><label for="r-preset">Período</label>
            <select id="r-preset" class="select">${VG.options([{ value: '7', label: 'Últimos 7 dias' }, { value: '30', label: 'Últimos 30 dias' }, { value: '90', label: 'Últimos 90 dias' }, { value: '365', label: 'Últimos 12 meses' }, { value: 'all', label: 'Todo o período' }, { value: 'custom', label: 'Personalizado' }], periodo.preset)}</select></div>
          <div class="field" data-custom><label for="r-de">De</label><input id="r-de" type="date" class="input" value="${periodo.de}"></div>
          <div class="field" data-custom><label for="r-ate">Até</label><input id="r-ate" type="date" class="input" value="${periodo.ate}"></div>
        </div></section>
        <div id="r-body" class="stack"></div>
      </div>`;
    const custom = () => VG.$$('[data-custom]', el).forEach((f) => (f.style.display = periodo.preset === 'custom' ? '' : 'none'));
    VG.$('#r-preset', el).onchange = (e) => { periodo.preset = e.target.value; custom(); body(el); };
    VG.$('#r-de', el).onchange = (e) => { periodo.de = e.target.value; body(el); };
    VG.$('#r-ate', el).onchange = (e) => { periodo.ate = e.target.value; body(el); };
    VG.$('#r-csv', el).onclick = exportar;
    custom();
    body(el);
  }

  function body(el) {
    const box = VG.$('#r-body', el);
    const list = filtrar();
    if (!list.length) { box.innerHTML = `<section class="panel">${VG.empty('chart', 'Sem ordens no período', 'Altere o período para ver os indicadores.')}</section>`; return; }
    const concl = list.filter((o) => o.status === 'concluida');
    const canc = list.filter((o) => o.status === 'cancelada');
    const validas = list.length - canc.length;
    const taxa = validas ? Math.round((concl.length / validas) * 100) : 0;
    const tAtend = media(list.map(duracao).filter((x) => x != null));
    const tCiclo = media(list.map(ciclo).filter((x) => x != null));

    const stat = (icon, label, value, foot, c = 'var(--steel)') => `
      <div class="panel stat" style="--c:${c}"><span class="stat__label">${VG.icon(icon)}${label}</span><span class="stat__value">${value}</span><span class="stat__foot">${foot}</span></div>`;

    const tecnicos = S().list('tecnicos');
    const linhasTec = tecnicos.map((t) => {
      const os = list.filter((o) => o.tecnicoId === t.id);
      const c = os.filter((o) => o.status === 'concluida');
      return { nome: t.nome, total: os.length, concl: c.length, abertas: os.filter((o) => !['concluida', 'cancelada'].includes(o.status)).length, tempo: horas(media(os.map(duracao).filter((x) => x != null))) };
    }).filter((x) => x.total).sort((a, b) => b.total - a.total);
    const semTec = list.filter((o) => !o.tecnicoId).length;

    const porStatus = Object.entries(VG.STATUS).map(([k, s]) => ({ l: s.label, v: list.filter((o) => o.status === k).length, c: `var(${s.cssVar})` }));
    const porCliente = agrupar(list, (o) => o.cliente && o.cliente.nome).slice(0, 6);

    box.innerHTML = `
      <div class="stats">
        ${stat('os', 'OS no período', list.length, `${canc.length} cancelada${canc.length === 1 ? '' : 's'}`)}
        ${stat('check', 'Concluídas', concl.length, `${taxa}% das OS válidas`, 'var(--st-green)')}
        ${stat('clock', 'Tempo médio de atendimento', horas(tAtend), 'do início ao fim no local', 'var(--st-orange)')}
        ${stat('hourglass', 'Ciclo médio', horas(tCiclo), 'da abertura à assinatura', 'var(--st-purple)')}
      </div>
      <div class="dash-grid">
        <section class="panel col-6"><div class="panel__head"><h3>${VG.icon('chart')}OS por status</h3></div><div class="panel__body">${hbars(porStatus)}</div></section>
        <section class="panel col-6"><div class="panel__head"><h3>${VG.icon('wrench')}Tipo de atendimento</h3></div><div class="panel__body">${hbars(agrupar(list, (o) => o.tipo))}</div></section>
        <section class="panel col-12"><div class="panel__head"><h3>${VG.icon('users')}Desempenho por técnico</h3>${semTec ? `<span class="faint" style="font-size:.8rem">${semTec} OS sem técnico</span>` : ''}</div>
          ${linhasTec.length ? `<div class="table-wrap"><table class="table table--cards report-table">
            <thead><tr><th>Técnico</th><th class="mono-num">Total</th><th class="mono-num">Concluídas</th><th class="mono-num">Em aberto</th><th class="mono-num">Tempo médio</th></tr></thead>
            <tbody>${linhasTec.map((t) => `<tr><td data-label="Técnico" class="strong">${VG.esc(t.nome)}</td><td data-label="Total" class="mono-num">${t.total}</td><td data-label="Concluídas" class="mono-num">${t.concl}</td><td data-label="Em aberto" class="mono-num">${t.abertas}</td><td data-label="Tempo médio" class="mono-num">${t.tempo}</td></tr>`).join('')}</tbody>
          </table></div>` : `<div class="panel__body"><p class="faint" style="margin:0">Nenhuma OS atribuída no período.</p></div>`}
        </section>
        <section class="panel col-6"><div class="panel__head"><h3>${VG.icon('video')}Equipamentos atendidos</h3></div><div class="panel__body">${hbars(agrupar(list, (o) => o.equipamento && o.equipamento.tipo).slice(0, 8))}</div></section>
        <section class="panel col-6"><div class="panel__head"><h3>${VG.icon('user')}Clientes com mais OS</h3></div><div class="panel__body">${hbars(porCliente)}</div></section>
      </div>`;
  }

  function exportar() {
    const list = filtrar().sort((a, b) => a.numero - b.numero);
    if (!list.length) return VG.toast('Não há OS no período selecionado.', 'warn');
    const col = (label, get) => ({ label, get });
    const csv = VG.CSV.gerar([
      col('Nº OS', (o) => o.numero),
      col('Abertura', (o) => VG.fmtDateTime(o.criadaEm)),
      col('Status', (o) => (VG.STATUS[o.status] || {}).label),
      col('Prioridade', (o) => (VG.PRIORIDADES[o.prioridade] || {}).label),
      col('Tipo', (o) => o.tipo),
      col('Cliente', (o) => o.cliente && o.cliente.nome),
      col('CPF/CNPJ', (o) => VG.fmtDoc(o.cliente && o.cliente.cpf_cnpj)),
      col('Cidade', (o) => o.cliente && o.cliente.cidade),
      col('Técnico', (o) => o.tecnicoNome),
      col('Equipamento', (o) => [o.equipamento.tipo, o.equipamento.marca, o.equipamento.modelo].filter(Boolean).join(' ')),
      col('Problema', (o) => o.problema),
      col('Diagnóstico', (o) => o.atendimento && o.atendimento.diagnostico),
      col('Serviço executado', (o) => o.atendimento && o.atendimento.servico),
      col('Materiais', (o) => ((o.atendimento && o.atendimento.materiais) || []).map((m) => `${m.descricao} (${m.quantidade} ${m.unidade || ''})`).join(' | ')),
      col('Início atendimento', (o) => (o.atendimento && o.atendimento.inicio ? VG.fmtDateTime(o.atendimento.inicio) : '')),
      col('Fim atendimento', (o) => (o.atendimento && o.atendimento.fim ? VG.fmtDateTime(o.atendimento.fim) : '')),
      col('Assinado por', (o) => (o.assinaturaCliente ? o.assinaturaCliente.nome : '')),
      col('Data assinatura', (o) => (o.assinaturaCliente ? VG.fmtDateTime(o.assinaturaCliente.dataHora) : '')),
    ], list);
    VG.download(`relatorio_os_${VG.toInputDate()}.csv`, csv, 'text/csv;charset=utf-8');
    VG.toast(`${list.length} ordens exportadas.`, 'success');
  }

  VG.Relatorios = { render };
})();
