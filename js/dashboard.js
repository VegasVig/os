/* =========================================================
   VEGAS OS — DASHBOARD
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;

  const css = (v) => `var(${v})`;

  function donut(counts) {
    const entries = Object.entries(VG.STATUS).map(([k, s]) => ({ k, s, n: counts[k] || 0 }));
    const total = entries.reduce((a, e) => a + e.n, 0);
    const R = 62, C = 2 * Math.PI * R;
    let off = 0;
    const segs = total ? entries.filter((e) => e.n).map((e) => {
      const len = (e.n / total) * C;
      const gap = entries.filter((x) => x.n).length > 1 ? 2 : 0;
      const seg = `<circle r="${R}" cx="85" cy="85" fill="none" stroke="${css(e.s.cssVar)}" stroke-width="18"
        stroke-dasharray="${Math.max(len - gap, 0.1)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 85 85)"><title>${e.s.label}: ${e.n}</title></circle>`;
      off += len;
      return seg;
    }).join('') : `<circle r="${R}" cx="85" cy="85" fill="none" stroke="var(--surface-3)" stroke-width="18"/>`;
    return `
      <div class="donut">
        <svg viewBox="0 0 170 170" role="img" aria-label="Distribuição de OS por status">
          <circle r="${R}" cx="85" cy="85" fill="none" stroke="var(--surface-3)" stroke-width="18"/>
          ${segs}
          <text x="85" y="88" text-anchor="middle" class="donut__total">${total}</text>
          <text x="85" y="106" text-anchor="middle" class="donut__lbl">ordens</text>
        </svg>
        <div class="legend">
          ${entries.map((e) => `<a class="legend__row" href="#/os?status=${e.k}" style="--c:${css(e.s.cssVar)};text-decoration:none"><i></i><span>${e.s.label}</span><b>${e.n}</b></a>`).join('')}
        </div>
      </div>`;
  }

  function vbars(items) {
    const max = Math.max(1, ...items.map((i) => i.v));
    return `<div class="vbars">${items.map((i) => `
      <div class="vbar" title="${VG.esc(i.title || i.l)}: ${i.v}">
        <span class="vbar__val">${i.v}</span>
        <div class="vbar__col" style="height:${(i.v / max) * 82}%"></div>
        <span class="vbar__lbl">${VG.esc(i.l)}</span>
      </div>`).join('')}</div>`;
  }

  function hbars(items, emptyText) {
    if (!items.length) return `<p class="muted" style="margin:0">${emptyText}</p>`;
    const max = Math.max(1, ...items.map((i) => i.v));
    return `<div class="hbars">${items.map((i) => `
      <div>
        <div class="hbar__top"><span>${VG.esc(i.l)}</span><b>${i.v}</b></div>
        <div class="hbar__track"><div class="hbar__fill" style="width:${(i.v / max) * 100}%"></div></div>
      </div>`).join('')}</div>`;
  }

  /** OS abertas por semana (últimas 8 semanas) */
  function porPeriodo(ordens) {
    const weeks = [];
    const now = new Date(); now.setHours(23, 59, 59, 999);
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now); end.setDate(end.getDate() - i * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      const v = ordens.filter((o) => { const d = new Date(o.criadaEm); return d >= start && d <= end; }).length;
      weeks.push({ l: `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`, title: `Semana de ${VG.fmtDate(start)} a ${VG.fmtDate(end)}`, v });
    }
    return weeks;
  }

  function iconFor(texto) {
    const t = VG.norm(texto);
    if (t.includes('assin')) return 'pen';
    if (t.includes('conclu') || t.includes('finaliz')) return 'check';
    if (t.includes('cancel')) return 'ban';
    if (t.includes('iniciou')) return 'play';
    if (t.includes('enviada') || t.includes('recebeu') || t.includes('reatrib')) return 'user';
    if (t.includes('criada')) return 'plus';
    if (t.includes('import') || t.includes('cliente')) return 'users';
    return 'activity';
  }

  function render(el) {
    const S = VG.Store;
    const ordens = S.list('ordens');
    const clientes = S.list('clientes');
    const tecnicos = S.list('tecnicos');
    const counts = {};
    ordens.forEach((o) => (counts[o.status] = (counts[o.status] || 0) + 1));
    const urgentes = ordens.filter((o) => o.prioridade === 'urgente' && !['concluida', 'cancelada'].includes(o.status)).length;

    const card = (key, icon, label, value, foot, href) => `
      <a class="panel stat" href="${href}" style="--c:${key ? css(VG.STATUS[key].cssVar) : 'var(--steel)'}">
        <span class="stat__label">${VG.icon(icon)}${label}</span>
        <span class="stat__value">${value}</span>
        <span class="stat__foot">${foot}</span>
      </a>`;

    const porTec = tecnicos.map((t) => ({ l: t.nome, v: ordens.filter((o) => o.tecnicoId === t.id && o.status !== 'cancelada').length }))
      .filter((x) => x.v).sort((a, b) => b.v - a.v).slice(0, 6);
    const tiposMap = {};
    ordens.forEach((o) => { const k = (o.equipamento && o.equipamento.tipo) || 'Não informado'; tiposMap[k] = (tiposMap[k] || 0) + 1; });
    const tipos = Object.entries(tiposMap).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 6);

    const atividades = S.list('atividades').slice(0, 9);
    const osById = Object.fromEntries(ordens.map((o) => [o.id, o]));
    const nome = (VG.Auth.current() || {}).nome || '';
    const hora = new Date().getHours();
    const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div>
            <h1>${saud}, ${VG.esc(nome.split(' ')[0])}</h1>
            <p>${urgentes ? `${urgentes} ${urgentes > 1 ? 'ordens urgentes aguardam' : 'ordem urgente aguarda'} atendimento.` : 'Nenhuma ordem urgente pendente no momento.'}</p>
          </div>
          <div class="page-head__actions">
            <a class="btn btn-primary" href="#/os/nova">${VG.icon('plus')}<span>Nova ordem de serviço</span></a>
          </div>
        </div>

        <div class="stats">
          ${card('aberta', 'os', 'OS abertas', counts.aberta || 0, 'Sem técnico definido', '#/os?status=aberta')}
          ${card('aguardando_tecnico', 'hourglass', 'Aguardando técnico', counts.aguardando_tecnico || 0, 'Enviadas, não iniciadas', '#/os?status=aguardando_tecnico')}
          ${card('em_atendimento', 'wrench', 'Em atendimento', counts.em_atendimento || 0, 'Técnico em campo', '#/os?status=em_atendimento')}
          ${card('aguardando_cliente', 'pen', 'Aguardando cliente', counts.aguardando_cliente || 0, 'Falta a assinatura', '#/os?status=aguardando_cliente')}
          ${card('concluida', 'check', 'Concluídas', counts.concluida || 0, 'Assinadas pelo cliente', '#/os?status=concluida')}
          ${card('cancelada', 'ban', 'Canceladas', counts.cancelada || 0, 'Encerradas sem execução', '#/os?status=cancelada')}
          ${card(null, 'users', 'Clientes', clientes.filter((c) => c.status !== 'inativo').length, `${clientes.length} cadastrados`, '#/clientes')}
          ${card(null, 'shield', 'Técnicos', tecnicos.filter((t) => t.ativo !== false).length, 'Ativos na equipe', '#/tecnicos')}
        </div>

        <div class="dash-grid">
          <section class="panel col-5">
            <div class="panel__head"><h3>${VG.icon('filter')}OS por status</h3></div>
            <div class="panel__body">${donut(counts)}</div>
          </section>
          <section class="panel col-7">
            <div class="panel__head"><h3>${VG.icon('calendar')}OS abertas por semana</h3><span class="faint" style="font-size:.8rem">Últimas 8 semanas</span></div>
            <div class="panel__body">${vbars(porPeriodo(ordens))}</div>
          </section>
          <section class="panel col-4">
            <div class="panel__head"><h3>${VG.icon('user')}OS por técnico</h3></div>
            <div class="panel__body">${hbars(porTec, 'Nenhuma OS atribuída ainda.')}</div>
          </section>
          <section class="panel col-4">
            <div class="panel__head"><h3>${VG.icon('video')}Principais tipos de problema</h3></div>
            <div class="panel__body">${hbars(tipos, 'Nenhuma OS registrada ainda.')}</div>
          </section>
          <section class="panel col-4">
            <div class="panel__head"><h3>${VG.icon('activity')}Atividade recente</h3></div>
            <div class="panel__body" style="padding-top:.4rem;padding-bottom:.4rem">
              ${atividades.length ? `<ul class="activity">${atividades.map((a) => {
                const os = a.osId && osById[a.osId];
                const txt = VG.esc(a.texto).replace(/#(\d+)/, (m) => (os ? `<a href="#/os/ver/${os.id}">${m}</a>` : m));
                return `<li><span class="activity__dot">${VG.icon(iconFor(a.texto))}</span><div><div class="activity__text">${txt}</div><div class="activity__time">${VG.timeAgo(a.dataHora)}</div></div></li>`;
              }).join('')}</ul>` : VG.empty('activity', 'Sem atividade ainda', 'As ações do sistema aparecem aqui.')}
            </div>
          </section>
        </div>
      </div>`;
  }

  VG.Dashboard = { render };
})();
