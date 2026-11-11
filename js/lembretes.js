/* =========================================================
   VEGAS OS — LEMBRETES
   Agendar dia e hora para abrir OS de um cliente; no horário,
   o sistema aberto avisa a supervisão (alerta, som e notificação).
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;
  const REPETIR = { nao: 'Não repete', mensal: 'Todo mês', trimestral: 'A cada 3 meses', semestral: 'A cada 6 meses', anual: 'Todo ano' };
  const MESES = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
  const SONECA_KEY = 'vegas_os_lembrete_soneca';
  const CHECAR_MS = 30000;

  const pad = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const quando = (l) => new Date(l.dataHora);
  const pendentes = () => S().list('lembretes').filter((l) => l.status === 'pendente');
  const vencidos = () => { const agora = Date.now(); return pendentes().filter((l) => quando(l).getTime() <= agora).sort((a, b) => quando(a) - quando(b)); };
  const autor = () => (VG.Auth.current() || {}).nome || 'Supervisão';

  function proxima(dataHora, repetir) {
    const d = new Date(dataHora), dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + MESES[repetir]);
    d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return local(d);
  }

  function hist(l, texto) { l.historico = (l.historico || []).concat({ em: new Date().toISOString(), por: autor(), texto }).slice(-30); }

  function salvar(l) {
    l.atualizadoEm = new Date().toISOString();
    S().put('lembretes', l);
    atualizarContadores();
    return S().saveAsync('lembretes', l).catch((e) => VG.toast(/desconhecida|inválida/i.test(e.message) ? 'O servidor ainda está na versão antiga. Cole o Code.gs novo e publique uma nova versão.' : e.message, 'error', 7000));
  }

  /** Conclui; se repete, agenda a próxima data a partir da data marcada */
  function concluir(l, osNumero) {
    if (l.repetir && l.repetir !== 'nao') {
      let prox = proxima(l.dataHora, l.repetir);
      while (new Date(prox).getTime() <= Date.now()) prox = proxima(prox, l.repetir);
      hist(l, (osNumero ? `OS #${osNumero} aberta. ` : 'Concluído. ') + `Próximo lembrete: ${VG.fmtDateTime(prox)}.`);
      l.dataHora = prox;
      l.ultimaOS = osNumero || l.ultimaOS || null;
    } else {
      l.status = 'concluido';
      l.concluidoEm = new Date().toISOString();
      l.concluidoPor = autor();
      if (osNumero) l.osNumero = osNumero;
      hist(l, osNumero ? `OS #${osNumero} aberta.` : 'Concluído sem abrir OS.');
    }
    return salvar(l);
  }

  function adiar(l, op) {
    const d = new Date();
    if (op === 'amanha') { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); } else d.setMinutes(d.getMinutes() + Number(op));
    l.dataHora = local(d);
    hist(l, `Adiado para ${VG.fmtDateTime(l.dataHora)}.`);
    return salvar(l);
  }

  /** Chamado pela tela de Nova OS quando ela foi aberta a partir de um lembrete */
  function osCriada(lembreteId, numero) {
    const l = S().get('lembretes', lembreteId);
    if (l && l.status === 'pendente') { concluir(l, numero); VG.toast(l.status === 'pendente' ? `Lembrete renovado para ${VG.fmtDateTime(l.dataHora)}.` : 'Lembrete concluído.', 'success'); }
  }

  const abrirOS = (l) => { location.hash = `#/os/nova?cliente=${encodeURIComponent(l.clienteId)}&lembrete=${encodeURIComponent(l.id)}`; };

  /* ---------- FORMULÁRIO ---------- */
  function form(opts = {}) {
    const l = opts.id ? S().get('lembretes', opts.id) : null;
    const clienteId = l ? l.clienteId : opts.clienteId || '';
    const cli = clienteId ? S().get('clientes', clienteId) : null;
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(8, 0, 0, 0);
    const [data, hora] = (l ? l.dataHora : local(amanha)).split('T');
    const clientes = cli ? [] : S().list('clientes').filter((c) => c.status !== 'inativo').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const rotulo = (c) => `${c.codigo || ''} · ${c.fantasia || c.nome}`;

    VG.modal({
      title: l ? 'Editar lembrete' : 'Agendar lembrete de OS',
      body: `
        <form id="lb-form" class="grid grid-2" novalidate>
          ${cli
            ? `<div class="field span-all"><label>Cliente</label><div class="kv__v strong">${VG.esc(rotulo(cli))}</div></div>`
            : `<div class="field span-all"><label for="lb-cli">Cliente</label>
                <input id="lb-cli" class="input" list="lb-cli-list" placeholder="Digite o código ou o nome" autocomplete="off">
                <datalist id="lb-cli-list">${clientes.map((c) => `<option value="${VG.esc(rotulo(c))}"></option>`).join('')}</datalist></div>`}
          <div class="field"><label for="lb-data">Dia</label><input id="lb-data" type="date" class="input" value="${data}" required></div>
          <div class="field"><label for="lb-hora">Hora</label><input id="lb-hora" type="time" class="input" value="${hora}" required></div>
          <div class="field span-all"><label for="lb-motivo">O que fazer</label>
            <textarea id="lb-motivo" class="textarea" rows="2" maxlength="500" placeholder="Ex.: abrir OS de preventiva; trocar bateria da central">${VG.esc(l ? l.motivo : '')}</textarea></div>
          <div class="field"><label for="lb-rep">Repetir</label>
            <select id="lb-rep" class="select">${Object.keys(REPETIR).map((k) => `<option value="${k}" ${(l ? l.repetir : 'nao') === k ? 'selected' : ''}>${REPETIR[k]}</option>`).join('')}</select></div>
          <div class="field"><label for="lb-para">Avisar</label>
            <select id="lb-para" class="select"><option value="eu">Só a mim</option><option value="todas" ${l && l.para === 'todas' ? 'selected' : ''}>Toda a supervisão</option></select></div>
          <p class="hint span-all" style="margin:0">O alerta aparece no horário em qualquer tela do sistema que estiver aberta. Se o sistema estiver fechado, ele aparece assim que você entrar.</p>
        </form>`,
      actions: [
        { label: 'Cancelar' },
        { label: l ? 'Salvar' : 'Agendar', cls: 'btn-primary', icon: 'check', onClick: () => {
          const f = VG.$('#lb-form');
          let alvo = cli;
          if (!alvo) {
            const v = VG.$('#lb-cli', f).value.trim();
            alvo = clientes.find((c) => rotulo(c) === v) || clientes.find((c) => VG.norm(c.codigo) === VG.norm(v));
            if (!alvo) { VG.toast('Escolha o cliente na lista.', 'warn'); return false; }
          }
          const d = VG.$('#lb-data', f).value, h = VG.$('#lb-hora', f).value;
          if (!d || !h) { VG.toast('Informe o dia e a hora.', 'warn'); return false; }
          const dataHora = `${d}T${h}`;
          const novo = Object.assign(l || { id: VG.uid(), status: 'pendente', historico: [], criadoPor: autor(), criadoEm: new Date().toISOString() }, {
            clienteId: alvo.id, clienteNome: alvo.fantasia || alvo.nome, clienteCodigo: alvo.codigo || '',
            dataHora, motivo: VG.$('#lb-motivo', f).value.trim(),
            repetir: VG.$('#lb-rep', f).value, para: VG.$('#lb-para', f).value,
          });
          if (l && l.status !== 'pendente') novo.status = 'pendente';
          hist(novo, l ? `Editado: ${VG.fmtDateTime(dataHora)}.` : `Agendado para ${VG.fmtDateTime(dataHora)}.`);
          salvar(novo);
          pedirPermissaoNotificacao();
          VG.toast(new Date(dataHora).getTime() <= Date.now() ? 'Lembrete salvo. O horário já passou: o alerta aparece agora.' : `Lembrete agendado para ${VG.fmtDateTime(dataHora)}.`, 'success');
          opts.onSave && opts.onSave(novo);
          setTimeout(checar, 400);
        } },
      ],
    });
  }

  /* ---------- ALERTA ---------- */
  let intervalo = null, alertaAberto = false;
  const soneca = () => { try { return JSON.parse(sessionStorage.getItem(SONECA_KEY) || '{}'); } catch (e) { return {}; } };
  const setSoneca = (o) => { try { sessionStorage.setItem(SONECA_KEY, JSON.stringify(o)); } catch (e) { /* sem storage */ } };

  function pedirPermissaoNotificacao() {
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { /* sem suporte */ }
  }

  function bip() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.18, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.21);
      });
      setTimeout(() => ctx.close(), 800);
    } catch (e) { /* sem áudio */ }
    try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) { /* sem vibração */ }
  }

  function notificar(lista) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
      const l = lista[0];
      const n = new Notification(lista.length > 1 ? `${lista.length} lembretes de OS` : `Abrir OS: ${l.clienteNome}`, {
        body: lista.length > 1 ? lista.map((x) => x.clienteNome).join(', ') : l.motivo || 'Lembrete agendado no Vegas OS.',
        icon: 'assets/icons/icon-192.png', tag: 'vegas-os-lembrete', renotify: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* sem suporte */ }
  }

  function checar() {
    const sess = VG.Auth.current();
    if (!sess || sess.papel !== 'supervisora' || VG.Store.isPublic() || /^#\/(qr|os\/\d)/.test(location.hash)) return;
    atualizarContadores();
    if (alertaAberto || document.querySelector('.modal-backdrop')) return;
    const sn = soneca(), agora = Date.now();
    const lista = vencidos().filter((l) => !(sn[l.id] && sn[l.id].ate > agora && sn[l.id].dataHora === l.dataHora));
    if (!lista.length) return;
    alertaAberto = true;
    bip();
    notificar(lista);
    mostrarAlerta(lista);
  }

  function mostrarAlerta(lista) {
    const linha = (l) => `
      <div class="lb-alerta" data-id="${l.id}">
        <div class="lb-alerta__info">
          <strong>${VG.esc(l.clienteNome)}</strong><span class="faint">Cliente ${VG.esc(l.clienteCodigo || '—')} · ${VG.esc(VG.fmtDateTime(l.dataHora))}${l.repetir !== 'nao' ? ' · ' + REPETIR[l.repetir] : ''}</span>
          ${l.motivo ? `<p>${VG.esc(l.motivo)}</p>` : ''}
        </div>
        <div class="lb-alerta__acoes">
          <button class="btn btn-primary btn-sm" data-a="os">${VG.icon('plus')}<span>Abrir OS</span></button>
          <select class="select lb-adiar" data-a="adiar" aria-label="Adiar"><option value="">Adiar…</option><option value="15">15 minutos</option><option value="60">1 hora</option><option value="240">4 horas</option><option value="amanha">Amanhã 08:00</option></select>
          <button class="btn btn-ghost btn-sm" data-a="ok" title="Concluir sem abrir OS">${VG.icon('check')}<span>Concluir</span></button>
        </div>
      </div>`;
    VG.modal({
      title: lista.length > 1 ? `${lista.length} lembretes de OS` : 'Lembrete de OS',
      body: `<div class="lb-alertas">${lista.map(linha).join('')}</div>`,
      actions: [{ label: 'Lembrar em 10 min', cls: 'btn', icon: 'clock', onClick: () => {
        const sn = soneca(), ate = Date.now() + 10 * 60000;
        lista.forEach((l) => (sn[l.id] = { ate, dataHora: l.dataHora }));
        setSoneca(sn);
      } }],
      onOpen: (mel, m) => {
        const fim = (box) => { box.remove(); if (!mel.querySelector('.lb-alerta')) m.close(); };
        mel.querySelectorAll('.lb-alerta').forEach((box) => {
          const l = S().get('lembretes', box.dataset.id);
          box.querySelector('[data-a=os]').onclick = () => { m.close(); abrirOS(l); };
          box.querySelector('[data-a=ok]').onclick = () => { concluir(l); fim(box); };
          box.querySelector('[data-a=adiar]').onchange = (e) => { if (e.target.value) { adiar(l, e.target.value); fim(box); } };
        });
      },
      onClose: () => {
        alertaAberto = false;
        const sn = soneca(), ate = Date.now() + 10 * 60000;
        vencidos().forEach((l) => { if (!sn[l.id] || sn[l.id].dataHora !== l.dataHora) sn[l.id] = { ate, dataHora: l.dataHora }; });
        setSoneca(sn);
        atualizarContadores();
      },
    });
  }

  function atualizarContadores() {
    const n = vencidos().length;
    document.querySelectorAll('[data-lemb-count]').forEach((el) => { el.textContent = n || ''; el.hidden = !n; });
  }

  function iniciar() {
    if (intervalo) return;
    intervalo = setInterval(checar, CHECAR_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checar(); });
    setTimeout(checar, 1500);
  }

  /* ---------- TELA ---------- */
  let aba = 'pendentes';

  function render(el) {
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div><h1>Lembretes</h1><p>Dia e hora para abrir OS de um cliente. No horário, o sistema avisa.</p></div>
          <div class="page-head__actions"><button class="btn btn-primary" id="lb-new">${VG.icon('plus')}<span>Novo lembrete</span></button></div>
        </div>
        <section class="panel">
          <div class="toolbar"><div class="seg" role="tablist">
            ${[['pendentes', 'Pendentes'], ['concluidos', 'Concluídos']].map(([k, t]) => `<input type="radio" name="lb-aba" id="lb-aba-${k}" value="${k}" ${aba === k ? 'checked' : ''}><label for="lb-aba-${k}">${t}</label>`).join('')}
          </div></div>
          <div id="lb-lista"></div>
        </section>
      </div>`;
    VG.$('#lb-new', el).onclick = () => form({ onSave: () => lista(el) });
    el.querySelectorAll('[name=lb-aba]').forEach((r) => (r.onchange = () => { aba = r.value; lista(el); }));
    lista(el);
  }

  function lista(el) {
    const box = VG.$('#lb-lista', el);
    if (!box) return;
    const agora = Date.now(), hoje = new Date().toDateString();
    let itens = S().list('lembretes').filter((l) => (aba === 'pendentes' ? l.status === 'pendente' : l.status !== 'pendente'));
    itens = aba === 'pendentes' ? itens.sort((a, b) => quando(a) - quando(b)) : itens.sort((a, b) => String(b.concluidoEm || b.atualizadoEm).localeCompare(String(a.concluidoEm || a.atualizadoEm))).slice(0, 100);
    if (!itens.length) {
      box.innerHTML = VG.empty('calendar', aba === 'pendentes' ? 'Nenhum lembrete pendente' : 'Nenhum lembrete concluído', aba === 'pendentes' ? 'Agende pelo botão Novo lembrete ou pelo sino na lista de clientes.' : '');
      return;
    }
    const situacao = (l) => {
      if (l.status === 'concluido') return `<span class="badge badge--green"><i></i>Concluído${l.osNumero ? ' · OS #' + l.osNumero : ''}</span>`;
      if (l.status === 'cancelado') return '<span class="badge badge--gray"><i></i>Cancelado</span>';
      const t = quando(l).getTime();
      if (t <= agora) return '<span class="badge badge--red"><i></i>Vencido</span>';
      return quando(l).toDateString() === hoje ? '<span class="badge badge--yellow"><i></i>Hoje</span>' : '<span class="badge badge--blue"><i></i>Agendado</span>';
    };
    box.innerHTML = `
      <div class="table-wrap"><table class="table table--cards">
        <thead><tr><th>Dia e hora</th><th>Cliente</th><th>O que fazer</th><th>Repetir</th><th>Situação</th><th style="text-align:right">Ações</th></tr></thead>
        <tbody>${itens.map((l) => `
          <tr data-id="${l.id}">
            <td data-label="Dia e hora" class="num">${VG.esc(VG.fmtDateTime(l.dataHora))}</td>
            <td data-label="Cliente"><span class="strong">${VG.esc(l.clienteNome)}</span><span class="sub">${VG.esc(l.clienteCodigo || '')}${l.para === 'todas' ? ' · toda a supervisão' : ''} · por ${VG.esc(l.criadoPor || '—')}</span></td>
            <td data-label="O que fazer">${VG.esc(l.motivo || '—')}</td>
            <td data-label="Repetir">${VG.esc(REPETIR[l.repetir] || REPETIR.nao)}</td>
            <td data-label="Situação">${situacao(l)}</td>
            <td data-label="" class="row-actions-cell"><div class="row-actions">
              ${l.status === 'pendente' ? `
                <button class="btn btn-ghost btn-icon" data-act="os" title="Abrir OS agora" aria-label="Abrir OS agora">${VG.icon('plus')}</button>
                <button class="btn btn-ghost btn-icon" data-act="ok" title="Concluir sem abrir OS" aria-label="Concluir">${VG.icon('check')}</button>` : ''}
              <button class="btn btn-ghost btn-icon" data-act="edit" title="${l.status === 'pendente' ? 'Editar' : 'Reagendar'}" aria-label="Editar">${VG.icon('edit')}</button>
              <button class="btn btn-ghost btn-icon" data-act="del" title="Excluir" aria-label="Excluir">${VG.icon('trash')}</button>
            </div></td>
          </tr>`).join('')}</tbody>
      </table></div>`;
    box.querySelectorAll('tr[data-id]').forEach((tr) => {
      const l = S().get('lembretes', tr.dataset.id);
      const b = (a) => tr.querySelector(`[data-act=${a}]`);
      if (b('os')) b('os').onclick = () => abrirOS(l);
      if (b('ok')) b('ok').onclick = async () => {
        if (!(await VG.confirm(l.repetir !== 'nao' ? 'Concluir sem abrir OS? O próximo lembrete será agendado.' : 'Concluir este lembrete sem abrir OS?', { title: 'Concluir lembrete', ok: 'Concluir' }))) return;
        concluir(l); lista(el);
      };
      b('edit').onclick = () => form({ id: l.id, onSave: () => lista(el) });
      b('del').onclick = async () => {
        if (!(await VG.confirm(`Excluir o lembrete de ${l.clienteNome}?`, { title: 'Excluir lembrete', ok: 'Excluir', danger: true }))) return;
        S().remove('lembretes', l.id);
        atualizarContadores();
        lista(el);
      };
    });
  }

  /** Lembretes pendentes de um cliente (para o detalhe do cliente) */
  const doCliente = (clienteId) => pendentes().filter((l) => l.clienteId === clienteId).sort((a, b) => quando(a) - quando(b));

  VG.Lembretes = { render, form, iniciar, checar, osCriada, doCliente, atualizarContadores, REPETIR };
})();
