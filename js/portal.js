/* =========================================================
   VEGAS OS — PORTAL DA OS (link do técnico e do cliente)
   Rota pública:  #/os/NUMERO/TOKEN
   Técnico logado: #/atendimento/:id  (modo "embedded", dentro do menu)
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;

  const MAX_FOTOS = 6;
  let pads = [];
  let timers = [];

  function cleanup() {
    pads.forEach((p) => p && p.destroy && p.destroy());
    timers.forEach((t) => clearInterval(t));
    pads = []; timers = [];
  }

  const clienteHash = (os) => `#/os/${os.numero}/${os.tokenCliente}`;

  /* ---------- Blocos de leitura ---------- */
  function headHTML(os, papel) {
    return `
      <section class="panel os-hero">
        <div>
          <div class="portal__role">${VG.icon(papel === 'tecnico' ? 'wrench' : 'user')}${papel === 'tecnico' ? `Área do técnico${os.tecnicoNome ? ' · ' + VG.esc(os.tecnicoNome) : ''}` : 'Área do cliente · conferência do atendimento'}</div>
          <div class="os-hero__num" style="margin-top:.35rem"><h1>Ordem de serviço #${os.numero}</h1></div>
          <div class="os-hero__meta">
            ${VG.badge(os.status, true)}${VG.prioBadge(os.prioridade)}
            <span>${VG.icon('wrench')}${VG.esc(os.tipo)}</span>
            <span>${VG.icon('calendar')}Aberta em ${VG.fmtDateTime(os.criadaEm)}</span>
          </div>
        </div>
      </section>`;
  }

  function clienteHTML(os, papel) {
    const c = os.cliente || {};
    const end = VG.enderecoCompleto(c);
    return `
      <section class="panel"><div class="panel__head"><h3>${VG.icon('user')}Cliente</h3></div>
        <div class="panel__body kv">
          ${VG.kv('Nome / Razão social', c.nome)}
          ${papel === 'cliente' ? VG.kv('CPF/CNPJ', VG.fmtDoc(c.cpf_cnpj)) : ''}
          ${VG.kv('Telefone', c.telefone ? `<a href="tel:${VG.digits(c.telefone)}">${VG.esc(VG.fmtPhone(c.telefone))}</a>` : '', true)}
          ${papel === 'cliente' ? VG.kv('E-mail', c.email) : ''}
          <div class="kv__item" style="grid-column:1/-1"><div class="kv__k">Endereço</div>
            <div class="kv__v">${VG.esc(end || '—')}</div>
            ${papel === 'tecnico' && (c.endereco || c.cidade) ? `<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem">
              <a class="btn btn-sm" href="${VG.mapsLink(c)}" target="_blank" rel="noopener">${VG.icon('pin')}<span>Abrir no mapa</span></a>
              ${c.telefone ? `<a class="btn btn-sm" href="tel:${VG.digits(c.telefone)}">${VG.icon('phone')}<span>Ligar</span></a>` : ''}
            </div>` : ''}
          </div>
        </div></section>`;
  }

  function problemaEquipHTML(os) {
    const e = os.equipamento || {};
    return `
      <section class="panel"><div class="panel__head"><h3>${VG.icon('alert')}Problema relatado</h3>
        ${os.prazoData ? `<span class="faint" style="font-size:.8rem;display:flex;gap:.3rem;align-items:center">${VG.icon('clock')}Prazo ${VG.fmtInputDate(os.prazoData)} ${VG.esc(os.prazoHora || '')}</span>` : ''}</div>
        <div class="panel__body"><p class="text-block">${VG.esc(os.problema)}</p></div></section>
      <section class="panel"><div class="panel__head"><h3>${VG.icon('video')}Equipamento</h3></div>
        <div class="panel__body kv kv--3">${VG.kv('Tipo', e.tipo)}${VG.kv('Marca', e.marca)}${VG.kv('Modelo', e.modelo)}${VG.kv('Nº de série', e.serie)}${VG.kv('Patrimônio', e.patrimonio)}${VG.kv('Local', e.local)}</div></section>`;
  }

  function atendimentoHTML(os) {
    const a = os.atendimento || {};
    return `
      <section class="panel"><div class="panel__head"><h3>${VG.icon('wrench')}Atendimento realizado</h3>
        <span class="faint" style="font-size:.8rem">${a.inicio ? `Início ${VG.fmtDateTime(a.inicio)}${a.fim ? ' · Fim ' + VG.fmtDateTime(a.fim) : ''}` : ''}</span></div>
        <div class="panel__body stack">
          <div><div class="kv__k">Diagnóstico</div><p class="text-block">${VG.esc(a.diagnostico || '—')}</p></div>
          <div><div class="kv__k">Serviço executado</div><p class="text-block">${VG.esc(a.servico || '—')}</p></div>
          <div><div class="kv__k" style="margin-bottom:.3rem">Materiais utilizados</div>${VG.OS.materiaisHTML(a.materiais)}</div>
          <div><div class="kv__k">Observações do técnico</div><p class="text-block">${VG.esc(a.observacoes || '—')}</p></div>
          ${os.assinaturaCliente && os.assinaturaCliente.observacoes ? `<div><div class="kv__k">Observações do cliente</div><p class="text-block">${VG.esc(os.assinaturaCliente.observacoes)}</p></div>` : ''}
        </div></section>
      <section class="panel"><div class="panel__head"><h3>${VG.icon('camera')}Fotos</h3></div><div class="panel__body" data-fotos>${VG.OS.fotosHTML(a.fotos)}</div></section>
      <section class="panel"><div class="panel__head"><h3>${VG.icon('pen')}Assinaturas</h3></div>
        <div class="panel__body sig-view">${VG.OS.sigHTML('Técnico', os.assinaturaTecnico)}${VG.OS.sigHTML('Cliente', os.assinaturaCliente)}</div></section>`;
  }

  function doneHTML(os) {
    return `
      <section class="panel done">
        <div class="done__check">${VG.icon('check')}</div>
        <h2>ORDEM DE SERVIÇO CONCLUÍDA</h2>
        <p>Obrigado. O atendimento foi registrado com sucesso.</p>
        <p class="faint" style="font-size:.85rem">OS #${os.numero} · ${VG.esc(os.cliente.nome)}${os.assinaturaCliente ? ' · assinada em ' + VG.fmtDateTime(os.assinaturaCliente.dataHora) : ''}</p>
        <div class="done__actions">
          <button class="btn btn-primary btn-lg" data-act="pdf">${VG.icon('pdf')}<span>Gerar PDF</span></button>
          <button class="btn btn-lg" data-act="ver">${VG.icon('eye')}<span>Visualizar OS</span></button>
        </div>
        ${VG.logoImg('done__logo')}
      </section>`;
  }

  function notice(icon, html, info = true) {
    return `<div class="notice ${info ? 'notice--info' : ''}">${VG.icon(icon)}<div>${html}</div></div>`;
  }

  /* ---------- Formulário do técnico ---------- */
  function tecnicoFormHTML(os) {
    const a = os.atendimento;
    const fotoGroup = (g, label) => `
      <div class="photo-group">
        <h4>${label} <span class="faint" data-count="${g}">(${a.fotos[g].length}/${MAX_FOTOS})</span></h4>
        <div class="thumbs" data-thumbs="${g}"></div>
        <input type="file" accept="image/*" multiple hidden data-file="${g}">
      </div>`;
    return `
      ${notice('play', `Atendimento iniciado em <strong>${VG.fmtDateTime(a.inicio)}</strong>. As informações são salvas automaticamente. <span class="faint" data-saved></span>`)}

      <section class="panel"><div class="panel__head"><h3>${VG.icon('search')}Diagnóstico<span class="req">*</span></h3></div>
        <div class="panel__body"><div class="field"><label for="p-diag" class="sr-only">Diagnóstico</label>
          <textarea id="p-diag" class="textarea" data-auto="diagnostico" placeholder="O que foi identificado no local?">${VG.esc(a.diagnostico)}</textarea></div></div></section>

      <section class="panel"><div class="panel__head"><h3>${VG.icon('wrench')}Serviço executado<span class="req">*</span></h3></div>
        <div class="panel__body"><div class="field"><label for="p-serv" class="sr-only">Serviço executado</label>
          <textarea id="p-serv" class="textarea lg" data-auto="servico" placeholder="Descreva o que foi realizado.">${VG.esc(a.servico)}</textarea></div></div></section>

      <section class="panel"><div class="panel__head"><h3>${VG.icon('box')}Materiais utilizados</h3></div>
        <div class="panel__body">
          <div class="mat-add">
            <div class="field"><label for="m-desc">Material</label><input id="m-desc" class="input" placeholder="Ex.: Cabo UTP" list="m-sug"></div>
            <div class="field"><label for="m-qtd">Qtd.</label><input id="m-qtd" class="input" type="number" min="0" step="any" inputmode="decimal" value="1"></div>
            <div class="field"><label for="m-un">Unidade</label><select id="m-un" class="select">${VG.options(VG.UNIDADES, VG.UNIDADES[0])}</select></div>
            <button type="button" class="btn" id="m-add">${VG.icon('plus')}<span>Adicionar</span></button>
          </div>
          <datalist id="m-sug">${['Cabo UTP', 'Conector RJ45', 'Fonte 12V', 'Conector BNC', 'Balun', 'Bateria 12V 7Ah', 'Sensor infravermelho', 'Cabo coaxial', 'HD 1TB', 'Fio de cerca elétrica', 'Isolador', 'Caixa de passagem'].map((x) => `<option value="${x}">`).join('')}</datalist>
          <ul class="mat-list" id="m-list"></ul>
        </div></section>

      <section class="panel"><div class="panel__head"><h3>${VG.icon('camera')}Fotos</h3><span class="faint" style="font-size:.8rem">Até ${MAX_FOTOS} por grupo</span></div>
        <div class="panel__body">${fotoGroup('antes', 'Antes')}${fotoGroup('depois', 'Depois')}</div></section>

      <section class="panel"><div class="panel__head"><h3>${VG.icon('message')}Observações do técnico</h3></div>
        <div class="panel__body"><div class="field"><label for="p-obs" class="sr-only">Observações</label>
          <textarea id="p-obs" class="textarea" data-auto="observacoes" placeholder="Recomendações, pendências, orientações ao cliente…">${VG.esc(a.observacoes)}</textarea></div></div></section>

      <section class="panel"><div class="panel__head"><h3>${VG.icon('pen')}Assinatura do técnico<span class="req">*</span></h3></div>
        <div class="panel__body stack">
          <div class="field"><label for="t-nome">Nome do técnico</label><input id="t-nome" class="input" value="${VG.esc(os.tecnicoNome || '')}"></div>
          ${VG.SignaturePad.markup('t-sig', 'Técnico: assine aqui')}
          <div class="sigpad__actions"><button type="button" class="btn btn-ghost btn-sm" id="t-clear">${VG.icon('refresh')}<span>Limpar assinatura</span></button>
            <span class="clock-line">${VG.icon('clock')}<span data-clock></span></span></div>
        </div></section>

      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-lg" id="t-finish" style="width:100%;max-width:420px">${VG.icon('check')}<span>Finalizar atendimento</span></button>
      </div>`;
  }

  function bindTecnicoForm(body, os, redraw) {
    const a = os.atendimento;
    const savedEl = VG.$('[data-saved]', body);
    const persist = () => {
      try {
        S().save('ordens', os);
        if (savedEl) savedEl.textContent = `Salvo às ${VG.fmtTime(VG.nowISO())}.`;
        return true;
      } catch (e) { return false; }
    };
    const autosave = VG.debounce(persist, 500);
    VG.$$('[data-auto]', body).forEach((t) => t.addEventListener('input', () => { a[t.dataset.auto] = t.value; autosave(); }));

    // Materiais
    const list = VG.$('#m-list', body);
    const drawMats = () => {
      list.innerHTML = a.materiais.length ? a.materiais.map((m) => `
        <li>${VG.icon('box')}<span>${VG.esc(m.descricao)}</span><b>${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</b>
          <button type="button" class="btn btn-ghost btn-icon" data-rm="${m.id}" aria-label="Remover material">${VG.icon('trash')}</button></li>`).join('')
        : '<li class="faint" style="justify-content:center">Nenhum material adicionado.</li>';
      VG.$$('[data-rm]', list).forEach((b) => (b.onclick = () => { a.materiais = a.materiais.filter((m) => m.id !== b.dataset.rm); persist(); drawMats(); }));
    };
    const addMat = () => {
      const d = VG.$('#m-desc', body), q = VG.$('#m-qtd', body), u = VG.$('#m-un', body);
      const desc = d.value.trim(), qtd = Number(String(q.value).replace(',', '.'));
      if (!desc) { d.focus(); return VG.toast('Informe o material.', 'warn'); }
      if (!(qtd > 0)) { q.focus(); return VG.toast('Informe uma quantidade válida.', 'warn'); }
      a.materiais.push({ id: VG.uid(), descricao: desc, quantidade: qtd, unidade: u.value });
      persist(); drawMats();
      d.value = ''; q.value = 1; d.focus();
    };
    VG.$('#m-add', body).onclick = addMat;
    VG.$('#m-desc', body).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMat(); } });
    drawMats();

    // Fotos
    ['antes', 'depois'].forEach((g) => {
      const box = VG.$(`[data-thumbs=${g}]`, body);
      const input = VG.$(`[data-file=${g}]`, body);
      const count = VG.$(`[data-count=${g}]`, body);
      const draw = () => {
        const arr = a.fotos[g];
        count.textContent = `(${arr.length}/${MAX_FOTOS})`;
        box.innerHTML = arr.map((src, i) => `
          <div class="thumb" style="position:relative">
            <img src="${src}" alt="Foto ${g} ${i + 1}" data-i="${i}" style="cursor:zoom-in">
            <button type="button" class="thumb__rm" data-i="${i}" aria-label="Remover foto">${VG.icon('x')}</button>
          </div>`).join('') + (arr.length < MAX_FOTOS ? `<button type="button" class="thumb-add">${VG.icon('camera')}<span>Adicionar</span></button>` : '');
        VG.$$('img[data-i]', box).forEach((im) => (im.onclick = () => VG.lightbox(arr[Number(im.dataset.i)], `Foto ${g}`)));
        VG.$$('.thumb__rm', box).forEach((b) => (b.onclick = async () => {
          if (!(await VG.confirm('Remover esta foto?', { title: 'Remover foto', ok: 'Remover', danger: true }))) return;
          arr.splice(Number(b.dataset.i), 1); persist(); draw();
        }));
        const add = VG.$('.thumb-add', box); if (add) add.onclick = () => input.click();
      };
      input.onchange = async () => {
        const files = Array.from(input.files || []).filter((f) => /^image\//.test(f.type));
        input.value = '';
        const livres = MAX_FOTOS - a.fotos[g].length;
        if (!files.length) return;
        if (files.length > livres) VG.toast(`Limite de ${MAX_FOTOS} fotos por grupo. ${livres} ${livres === 1 ? 'foto será adicionada' : 'fotos serão adicionadas'}.`, 'warn');
        box.insertAdjacentHTML('beforeend', '<div class="thumb" data-loading style="display:grid;place-items:center"><span class="spinner"></span></div>');
        let added = 0;
        for (const f of files.slice(0, livres)) {
          try { a.fotos[g].push(await VG.compressImage(f, 1024, 0.68)); added++; }
          catch (e) { VG.toast(e.message || 'Não foi possível carregar a foto.', 'error'); }
        }
        if (!persist()) { a.fotos[g].splice(a.fotos[g].length - added, added); added = 0; }
        draw();
        if (added) VG.toast(`${added} ${added > 1 ? 'fotos adicionadas' : 'foto adicionada'}.`, 'success');
      };
      draw();
    });

    // Assinatura do técnico
    const pad = VG.SignaturePad.mount(VG.$('#t-sig', body));
    pads.push(pad);
    VG.$('#t-clear', body).onclick = () => pad.clear();
    startClock(body);

    VG.$('#t-finish', body).onclick = async () => {
      a.diagnostico = VG.$('#p-diag', body).value.trim();
      a.servico = VG.$('#p-serv', body).value.trim();
      a.observacoes = VG.$('#p-obs', body).value.trim();
      const nome = VG.$('#t-nome', body).value.trim();
      const bad = (sel, msg) => { const f = VG.$(sel, body); f.closest('.field') && f.closest('.field').classList.add('invalid'); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); VG.toast(msg, 'warn'); };
      VG.$$('.field.invalid', body).forEach((x) => x.classList.remove('invalid'));
      if (!a.diagnostico) return bad('#p-diag', 'Informe o diagnóstico.');
      if (!a.servico) return bad('#p-serv', 'Descreva o serviço executado.');
      if (!nome) return bad('#t-nome', 'Informe o nome do técnico.');
      if (pad.isEmpty()) { VG.$('#t-sig', body).scrollIntoView({ behavior: 'smooth', block: 'center' }); return VG.toast('Assine no quadro antes de finalizar.', 'warn'); }
      if (!(await VG.confirm('Depois de finalizar, o atendimento não poderá mais ser alterado pelo técnico e seguirá para a assinatura do cliente.', { title: 'Finalizar atendimento?', ok: 'Finalizar' }))) return;
      const agora = VG.nowISO();
      os.assinaturaTecnico = { nome, imagem: pad.toDataURL(), dataHora: agora };
      a.fim = agora;
      os.status = 'aguardando_cliente';
      S().hist(os, 'Técnico finalizou atendimento.', nome);
      S().hist(os, 'Técnico assinou.', nome);
      S().save('ordens', os);
      S().log(`OS #${os.numero} finalizada`, os.id, 'check');
      VG.toast('Atendimento finalizado. Agora falta a assinatura do cliente.', 'success');
      redraw();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  function startClock(scope) {
    const tick = () => VG.$$('[data-clock]', scope).forEach((c) => (c.textContent = VG.fmtDateTime(new Date().toISOString())));
    tick();
    timers.push(setInterval(tick, 1000));
  }

  /* ---------- Assinatura do cliente ---------- */
  function clienteSignHTML(os) {
    return `
      <section class="panel" id="c-sign-panel"><div class="panel__head"><h3>${VG.icon('pen')}Confirmação e assinatura</h3></div>
        <div class="panel__body stack">
          <p class="declaration">Declaro que o serviço descrito nesta Ordem de Serviço foi realizado e estou ciente das informações registradas.</p>
          <div class="grid grid-2">
            <div class="field"><label for="c-nome">Nome do cliente<span class="req">*</span></label><input id="c-nome" class="input" autocomplete="name" placeholder="Nome de quem está assinando"></div>
            <div class="field"><label for="c-doc">Documento (CPF ou RG)</label><input id="c-doc" class="input" inputmode="numeric" placeholder="Opcional"></div>
          </div>
          <div class="field"><label for="c-obs">Observações do cliente</label><textarea id="c-obs" class="textarea" placeholder="Algo que queira registrar sobre o atendimento (opcional)"></textarea></div>
          <div class="field"><span class="label">Assinatura<span class="req">*</span></span>${VG.SignaturePad.markup('c-sig')}</div>
          <div class="sigpad__actions">
            <span class="clock-line">${VG.icon('clock')}<span data-clock></span></span>
          </div>
          <div class="form-actions" style="justify-content:space-between">
            <button type="button" class="btn btn-lg" id="c-clear">${VG.icon('refresh')}<span>Limpar assinatura</span></button>
            <button type="button" class="btn btn-primary btn-lg" id="c-confirm">${VG.icon('check')}<span>Confirmar assinatura</span></button>
          </div>
        </div></section>`;
  }

  function bindClienteSign(body, os, redraw) {
    const pad = VG.SignaturePad.mount(VG.$('#c-sig', body));
    pads.push(pad);
    startClock(body);
    VG.$('#c-clear', body).onclick = () => pad.clear();
    VG.$('#c-confirm', body).onclick = () => {
      const nome = VG.$('#c-nome', body).value.trim();
      const doc = VG.$('#c-doc', body).value.trim();
      const obs = VG.$('#c-obs', body).value.trim();
      VG.$$('.field.invalid', body).forEach((x) => x.classList.remove('invalid'));
      if (!nome) { const f = VG.$('#c-nome', body); f.closest('.field').classList.add('invalid'); f.focus(); return VG.toast('Informe seu nome.', 'warn'); }
      if (pad.isEmpty()) return VG.toast('Assine no quadro para confirmar.', 'warn');
      const fresh = S().get('ordens', os.id);
      if (!fresh || fresh.status !== 'aguardando_cliente') { VG.toast('Esta OS não está mais aguardando assinatura.', 'warn'); return redraw(); }
      const agora = VG.nowISO();
      fresh.assinaturaCliente = { nome, documento: doc, imagem: pad.toDataURL(), dataHora: agora, observacoes: obs };
      fresh.status = 'concluida';
      S().hist(fresh, obs ? `Cliente assinou. Observação: ${obs}` : 'Cliente assinou.', nome);
      S().hist(fresh, 'OS concluída.', 'Sistema');
      S().save('ordens', fresh);
      S().log(`Cliente assinou OS #${fresh.numero}`, fresh.id, 'pen');
      S().log(`OS #${fresh.numero} concluída`, fresh.id, 'check');
      Object.assign(os, fresh);
      redraw();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  /* ---------- Render ---------- */
  function render(root, osId, papel, opts = {}) {
    cleanup();
    const embedded = !!opts.embedded;
    const sess = VG.Auth.current();

    if (embedded) {
      root.innerHTML = `<div class="page"><div><a class="btn btn-ghost btn-sm" href="#/minhas-os">${VG.icon('back')}<span>Minhas OS</span></a></div><div class="stack" id="pb"></div></div>`;
    } else {
      const voltar = sess ? `<a class="btn btn-ghost btn-sm" href="${sess.papel === 'tecnico' ? '#/minhas-os' : '#/os/ver/' + osId}">${VG.icon('back')}<span>Sistema</span></a>` : '';
      root.innerHTML = `
        <div class="portal">
          <header class="portal__bar">
            ${VG.logoImg()}
            <div class="portal__bar-actions">${voltar}${VG.Theme ? VG.Theme.button(true) : ''}</div>
          </header>
          <main class="portal__body" id="pb"></main>
          <footer class="portal__foot">${VG.icon('lock')}<span>Link exclusivo desta ordem de serviço · ${VG.esc(S().getConfig().empresa.nome)}</span></footer>
        </div>`;
      VG.Theme && VG.Theme.bind(root);
    }
    const body = VG.$('#pb', root);
    const state = { verResumo: false };

    const draw = () => {
      cleanup();
      const os = S().get('ordens', osId);
      if (!os) { body.innerHTML = VG.empty('alert', 'OS não encontrada', 'Esta ordem de serviço não existe mais.'); return; }
      if (!os.atendimento) os.atendimento = { inicio: null, fim: null, diagnostico: '', servico: '', materiais: [], observacoes: '', fotos: { antes: [], depois: [] } };
      os.atendimento.fotos = os.atendimento.fotos || { antes: [], depois: [] };
      os.atendimento.materiais = os.atendimento.materiais || [];

      let html = headHTML(os, papel);
      const st = os.status;

      if (st === 'cancelada') {
        html += notice('ban', `<strong>Esta ordem de serviço foi cancelada</strong>${os.canceladaMotivo ? '. Motivo: ' + VG.esc(os.canceladaMotivo) : ''}. Em caso de dúvida, fale com a supervisão.`, false);
        body.innerHTML = html;
        return;
      }

      if (st === 'concluida') {
        html += doneHTML(os);
        if (state.verResumo) html += `<div class="stack" id="resumo">${clienteHTML(os, papel)}${problemaEquipHTML(os)}${atendimentoHTML(os)}</div>`;
        body.innerHTML = html;
        VG.$('[data-act=pdf]', body).onclick = (e) => VG.PDF.gerar(S().get('ordens', osId), e.currentTarget);
        VG.$('[data-act=ver]', body).onclick = () => {
          state.verResumo = !state.verResumo; draw();
          const r = VG.$('#resumo', body); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        const f = VG.$('[data-fotos]', body); if (f) VG.OS.bindThumbs(f, os.atendimento.fotos);
        return;
      }

      if (papel === 'tecnico') {
        html += clienteHTML(os, papel) + problemaEquipHTML(os);
        if (st === 'aberta' || st === 'aguardando_tecnico') {
          html += `
            <section class="panel"><div class="panel__body" style="display:grid;gap:.8rem;justify-items:center;text-align:center;padding:1.8rem 1.25rem">
              <p style="margin:0;color:var(--text-2)">Ao chegar no local, inicie o atendimento. A data e o horário serão registrados automaticamente.</p>
              <button class="btn btn-primary btn-lg" id="t-start" style="width:100%;max-width:420px">${VG.icon('play')}<span>Iniciar atendimento</span></button>
            </div></section>`;
          body.innerHTML = html;
          VG.$('#t-start', body).onclick = () => {
            const o = S().get('ordens', osId);
            o.atendimento = o.atendimento || os.atendimento;
            o.atendimento.inicio = VG.nowISO();
            o.status = 'em_atendimento';
            S().hist(o, 'Técnico iniciou atendimento.', o.tecnicoNome || 'Técnico');
            S().save('ordens', o);
            S().log(`Técnico ${(o.tecnicoNome || '').split(' ')[0]} iniciou a OS #${o.numero}`, o.id, 'play');
            VG.toast('Atendimento iniciado.', 'success');
            draw();
          };
          return;
        }
        if (st === 'em_atendimento') {
          body.innerHTML = html + tecnicoFormHTML(os);
          bindTecnicoForm(body, os, draw);
          return;
        }
        if (st === 'aguardando_cliente') {
          html += notice('check', '<strong>Atendimento finalizado.</strong> Agora o cliente precisa conferir e assinar. Envie o link abaixo ou colete a assinatura neste aparelho.');
          html += `<section class="panel"><div class="panel__head"><h3>${VG.icon('share')}Enviar para o cliente</h3></div>
            <div class="panel__body stack">${VG.OS.linkCard(os, 'cliente')}
              <a class="btn btn-primary btn-lg" href="${clienteHash(os)}" style="justify-self:center;width:100%;max-width:420px">${VG.icon('pen')}<span>Coletar assinatura do cliente neste aparelho</span></a>
            </div></section>`;
          html += atendimentoHTML(os);
          body.innerHTML = html;
          VG.OS.bindLinkCards(body, os);
          VG.OS.bindThumbs(VG.$('[data-fotos]', body), os.atendimento.fotos);
          return;
        }
      }

      // CLIENTE
      html += clienteHTML(os, 'cliente') + problemaEquipHTML(os);
      if (st === 'aguardando_cliente') {
        html += notice('info', 'Confira abaixo o que foi realizado. No final da página, informe seu nome e assine para confirmar.');
        html += atendimentoHTML(os) + clienteSignHTML(os);
        body.innerHTML = html;
        VG.OS.bindThumbs(VG.$('[data-fotos]', body), os.atendimento.fotos);
        bindClienteSign(body, os, draw);
        return;
      }
      html += notice('hourglass', st === 'em_atendimento'
        ? '<strong>Atendimento em andamento.</strong> Assim que o técnico finalizar, você poderá conferir o serviço e assinar por este mesmo link.'
        : '<strong>Atendimento agendado.</strong> O técnico ainda não iniciou o serviço. Você poderá assinar por este link quando ele finalizar.');
      body.innerHTML = html;
    };

    draw();
  }

  /** Página de erro para links inválidos/expirados */
  function renderErro(root, msg) {
    cleanup();
    root.innerHTML = `
      <div class="portal">
        <header class="portal__bar">${VG.logoImg()}<div class="portal__bar-actions">${VG.Theme ? VG.Theme.button(true) : ''}</div></header>
        <main class="portal__body"><section class="panel">${VG.empty('lock', 'Acesso indisponível', msg, VG.Auth.current() ? '<a class="btn" href="#/">Voltar ao sistema</a>' : '')}</section></main>
      </div>`;
    VG.Theme && VG.Theme.bind(root);
  }

  VG.Portal = { render, renderErro, cleanup };
})();
