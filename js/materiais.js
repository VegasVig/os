/* =========================================================
   VEGAS OS — MATERIAIS DA OS
   Controle somente de identificação e quantidade:
   CÓDIGO + MATERIAL + QUANTIDADE (nunca valores na OS).
   • materiaisLevar  → separados pela supervisora para o técnico levar
   • atendimento.materiais + atendimento.usouMaterial → o que o técnico usou
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;

  const SUGESTOES = ['Cabo UTP', 'Conector RJ45', 'Fonte 12V', 'Conector BNC', 'Balun', 'Bateria 12V 7Ah', 'Sensor infravermelho', 'Cabo coaxial', 'HD 1TB', 'Fio de cerca elétrica', 'Isolador', 'Caixa de passagem'];
  const FEITAS = ['aguardando_cliente', 'concluida', 'processada', 'reaberta'];

  /** Item limpo: só identificação e quantidade (o valor, se existir no banco, não é tocado aqui) */
  const limpar = (m) => ({
    id: m.id || VG.uid(), codigo: String(m.codigo || '').trim(), descricao: String(m.descricao || '').trim(),
    quantidade: Number(m.quantidade) || 0, unidade: m.unidade || VG.UNIDADES[0],
  });

  /**
   * Utilizou material?  true = Sim · false = Não · null = ainda não informado.
   * OS antigas (antes da pergunta existir) são deduzidas pela lista de materiais.
   */
  function usou(os) {
    const a = (os && os.atendimento) || {};
    if (a.usouMaterial === true || a.usouMaterial === false) return a.usouMaterial;
    if ((a.materiais || []).length) return true;
    if (os && FEITAS.includes(os.status)) return false;
    return null;
  }
  const usouTexto = (os) => ({ true: 'SIM', false: 'NÃO' }[String(usou(os))] || 'Não informado');
  const usouBadge = (os) => {
    const u = usou(os);
    return `<span class="badge badge--${u === true ? 'green' : u === false ? 'gray' : 'silver'}"><i></i>${u === true ? 'SIM' : u === false ? 'NÃO' : 'Não informado'}</span>`;
  };

  /** Códigos já usados em outras OS (para sugerir a descrição ao digitar o código) */
  function catalogo() {
    const map = {};
    S().list('ordens').forEach((o) => {
      [].concat(o.materiaisLevar || [], (o.atendimento && o.atendimento.materiais) || []).forEach((m) => {
        if (!m || !m.codigo) return;
        const k = VG.norm(m.codigo);
        if (!map[k]) map[k] = { codigo: m.codigo, descricao: m.descricao, unidade: m.unidade };
      });
    });
    return Object.values(map).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
  }

  /** Tabela de leitura: Código | Material | Quantidade */
  function tabelaHTML(mats, qtdLabel = 'Quantidade', vazio = 'Nenhum material registrado.') {
    if (!mats || !mats.length) return `<p class="faint" style="margin:0">${VG.esc(vazio)}</p>`;
    return `<div class="mat-table"><table class="materials materials--cod"><thead><tr><th>Código</th><th>Material</th><th>${VG.esc(qtdLabel)}</th></tr></thead><tbody>${mats.map((m) => `
      <tr><td class="mono-num">${m.codigo ? VG.esc(m.codigo) : '<span class="faint">—</span>'}</td><td>${VG.esc(m.descricao)}</td><td class="mono-num">${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /** Bloco "Utilizou material" + materiais utilizados (técnico, cliente e supervisão) */
  function utilizadosHTML(os) {
    const a = (os && os.atendimento) || {};
    const u = usou(os);
    return `<div class="mat-usou"><span class="kv__k">Utilizou material:</span> ${usouBadge(os)}</div>
      ${u === false ? '<p class="faint" style="margin:.4rem 0 0">Não foi utilizado material.</p>'
        : u === null ? '<p class="faint" style="margin:.4rem 0 0">O técnico ainda não informou os materiais utilizados.</p>'
        : tabelaHTML(a.materiais, 'Qtd. utilizada')}`;
  }

  /* ---------- Editor (adicionar / remover itens) ---------- */
  function editorHTML(p, opts = {}) {
    const levar = opts.levar || [];
    const cat = catalogo();
    return `
      ${levar.length ? `<div class="mat-pick"><div class="kv__k">Separados pela supervisão — toque para usar</div>
        <div class="mat-pick__list">${levar.map((m) => `
          <button type="button" class="mat-chip" data-pick="${VG.esc(m.id)}">${VG.icon('box')}<span>${m.codigo ? `<b>${VG.esc(m.codigo)}</b>` : ''}${VG.esc(m.descricao)}</span><em>${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</em></button>`).join('')}</div></div>` : ''}
      <div class="mat-add mat-add--cod">
        <div class="field"><label for="${p}-cod">Código${opts.codigoObrigatorio ? '<span class="req">*</span>' : ''}</label><input id="${p}-cod" class="input" placeholder="Ex.: MAT-001" list="${p}-cods" autocomplete="off" autocapitalize="characters"></div>
        <div class="field"><label for="${p}-desc">Material<span class="req">*</span></label><input id="${p}-desc" class="input" placeholder="Ex.: Sensor" list="${p}-sug" autocomplete="off"></div>
        <div class="field"><label for="${p}-qtd">${VG.esc(opts.qtdLabel || 'Qtd.')}</label><input id="${p}-qtd" class="input" type="number" min="0" step="any" inputmode="decimal" value="1"></div>
        <div class="field"><label for="${p}-un">Unidade</label><select id="${p}-un" class="select">${VG.options(VG.UNIDADES, VG.UNIDADES[0])}</select></div>
        <button type="button" class="btn" id="${p}-add">${VG.icon('plus')}<span>Adicionar</span></button>
      </div>
      <datalist id="${p}-cods">${cat.map((c) => `<option value="${VG.esc(c.codigo)}">${VG.esc(c.descricao)}</option>`).join('')}</datalist>
      <datalist id="${p}-sug">${Array.from(new Set(SUGESTOES.concat(cat.map((c) => c.descricao)))).map((x) => `<option value="${VG.esc(x)}">`).join('')}</datalist>
      <ul class="mat-list" id="${p}-list"></ul>`;
  }

  /**
   * Liga o editor. `getItens()` devolve o array a ser alterado (sempre o atual);
   * `onChange()` é chamado após incluir/remover.
   */
  function bindEditor(root, p, getItens, opts = {}) {
    const $ = (id) => VG.$('#' + p + '-' + id, root);
    const cod = $('cod'), desc = $('desc'), qtd = $('qtd'), un = $('un'), list = $('list');
    const cat = catalogo();
    const porCodigo = (c) => cat.find((x) => VG.norm(x.codigo) === VG.norm(c));
    const porDesc = (d) => cat.find((x) => VG.norm(x.descricao) === VG.norm(d));

    const draw = () => {
      const itens = getItens();
      list.innerHTML = itens.length ? itens.map((m) => `
        <li>${VG.icon('box')}<span>${m.codigo ? `<small class="mat-cod">${VG.esc(m.codigo)}</small>` : ''}${VG.esc(m.descricao)}</span><b>${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</b>
          <button type="button" class="btn btn-ghost btn-icon" data-rm="${VG.esc(m.id)}" aria-label="Remover material">${VG.icon('trash')}</button></li>`).join('')
        : `<li class="faint" style="justify-content:center">${VG.esc(opts.vazio || 'Nenhum material adicionado.')}</li>`;
      VG.$$('[data-rm]', list).forEach((b) => (b.onclick = () => {
        const arr = getItens();
        const i = arr.findIndex((m) => m.id === b.dataset.rm);
        if (i >= 0) arr.splice(i, 1);
        opts.onChange && opts.onChange();
        draw();
      }));
    };

    cod.addEventListener('change', () => {
      const c = porCodigo(cod.value);
      if (c) { desc.value = c.descricao || desc.value; if (c.unidade) un.value = c.unidade; }
    });
    desc.addEventListener('change', () => {
      if (cod.value.trim()) return;
      const c = porDesc(desc.value);
      if (c) { cod.value = c.codigo; if (c.unidade) un.value = c.unidade; }
    });

    const add = () => {
      const c = cod.value.trim(), d = desc.value.trim(), q = Number(String(qtd.value).replace(',', '.'));
      VG.$$('.field.invalid', root).forEach((x) => x.classList.remove('invalid'));
      const bad = (el, msg) => { el.closest('.field').classList.add('invalid'); el.focus(); VG.toast(msg, 'warn'); };
      if (opts.codigoObrigatorio && !c) return bad(cod, 'Informe o código do material.');
      if (!d) return bad(desc, 'Informe o material.');
      if (!(q > 0)) return bad(qtd, 'Informe uma quantidade válida.');
      const arr = getItens();
      // mesmo código (ou mesmo material sem código) e mesma unidade: soma a quantidade
      const igual = arr.find((m) => m.unidade === un.value && (c ? VG.norm(m.codigo) === VG.norm(c) : !m.codigo && VG.norm(m.descricao) === VG.norm(d)));
      if (igual) igual.quantidade = Math.round((Number(igual.quantidade) + q) * 1000) / 1000;
      else arr.push(limpar({ codigo: c, descricao: d, quantidade: q, unidade: un.value }));
      opts.onChange && opts.onChange();
      draw();
      cod.value = ''; desc.value = ''; qtd.value = 1; un.value = VG.UNIDADES[0];
      (opts.codigoObrigatorio ? cod : desc).focus();
    };
    $('add').onclick = add;
    [cod, desc, qtd].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }));

    // técnico: toca no material separado pela supervisão e confirma a quantidade usada
    VG.$$('[data-pick]', root).forEach((b) => (b.onclick = () => {
      const m = (opts.levar || []).find((x) => x.id === b.dataset.pick);
      if (!m) return;
      cod.value = m.codigo || ''; desc.value = m.descricao || ''; un.value = m.unidade || VG.UNIDADES[0]; qtd.value = m.quantidade || 1;
      qtd.focus(); try { qtd.select(); } catch (e) {}
      VG.toast('Confira a quantidade utilizada e toque em Adicionar.', 'info', 2600);
    }));

    draw();
    return { draw };
  }

  /** "MAT-001 Sensor (4 unidade(s)); Cabo UTP (10 metro(s))" — usado no histórico */
  const resumo = (mats) => (mats || []).map((m) => `${m.codigo ? m.codigo + ' ' : ''}${m.descricao} (${m.quantidade}${m.unidade ? ' ' + m.unidade : ''})`).join('; ');

  VG.Mat = { limpar, resumo, usou, usouTexto, usouBadge, catalogo, tabelaHTML, utilizadosHTML, editorHTML, bindEditor };
})();
