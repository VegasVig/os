/* =========================================================
   VEGAS OS — MATERIAIS DA OS
   CÓDIGO + MATERIAL + QUANTIDADE. Técnico, cliente e PDF nunca veem valores;
   só a supervisão lança/vê o valor unitário dos materiais utilizados.
   • materiaisLevar  → separados pela supervisora para o técnico levar
   • atendimento.materiais + atendimento.usouMaterial → o que o técnico usou
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;

  const SUGESTOES = ['Cabo UTP', 'Conector RJ45', 'Fonte 12V', 'Conector BNC', 'Balun', 'Bateria 12V 7Ah', 'Sensor infravermelho', 'Cabo coaxial', 'HD 1TB', 'Fio de cerca elétrica', 'Isolador', 'Caixa de passagem'];
  const FEITAS = ['aguardando_cliente', 'concluida', 'processada', 'reaberta'];

  /** Item limpo: identificação, quantidade e — só quando a supervisão lança — o valor unitário */
  const limpar = (m) => {
    const o = {
      id: m.id || VG.uid(), codigo: String(m.codigo || '').trim(), descricao: String(m.descricao || '').trim(),
      quantidade: Number(m.quantidade) || 0, unidade: m.unidade || VG.UNIDADES[0],
    };
    const v = m.valor;
    if (v != null && v !== '' && isFinite(Number(v)) && Number(v) >= 0) o.valor = Math.round(Number(v) * 100) / 100;
    return o;
  };

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

  /**
   * Catálogo para a busca: todos os materiais já usados/separados nas OS + sugestões.
   * Guarda o último valor unitário lançado (para a supervisão) e quantas vezes foi usado.
   */
  function catalogo() {
    const map = {};
    const ordens = S().list('ordens').slice().sort((a, b) => String(a.criadaEm).localeCompare(String(b.criadaEm)));
    ordens.forEach((o) => {
      [].concat(o.materiaisLevar || [], (o.atendimento && o.atendimento.materiais) || []).forEach((m) => {
        if (!m || !m.descricao) return;
        const k = m.codigo ? 'c:' + VG.norm(m.codigo) : 'd:' + VG.norm(m.descricao);
        const it = map[k] || (map[k] = { codigo: m.codigo || '', descricao: m.descricao, unidade: m.unidade, usos: 0 });
        it.usos++;
        if (m.unidade) it.unidade = m.unidade;
        if (m.valor != null && m.valor !== '') it.valor = Number(m.valor);
      });
    });
    SUGESTOES.forEach((d) => {
      const jaTem = Object.values(map).some((x) => VG.norm(x.descricao) === VG.norm(d));
      if (!jaTem) map['d:' + VG.norm(d)] = { codigo: '', descricao: d, usos: 0 };
    });
    return Object.values(map).sort((a, b) => b.usos - a.usos || String(a.descricao).localeCompare(String(b.descricao), 'pt-BR'));
  }

  /** Procura no catálogo por nome ou código (todas as palavras digitadas, sem acento) */
  function buscar(cat, q, max = 8) {
    const n = VG.norm(q);
    if (!n) return [];
    const palavras = n.split(/\s+/).filter(Boolean);
    return cat.map((x) => {
      const nd = VG.norm(x.descricao), nc = VG.norm(x.codigo);
      if (!palavras.every((w) => nd.includes(w) || nc.includes(w))) return null;
      const peso = (nc && nc === n ? 0 : nc.startsWith(n) ? 1 : nd.startsWith(n) ? 2 : nd.split(/\s+/).some((w) => w.startsWith(palavras[0])) ? 3 : 4);
      return { x, peso };
    }).filter(Boolean).sort((a, b) => a.peso - b.peso || b.x.usos - a.x.usos).slice(0, max).map((r) => r.x);
  }

  /** Tabela de leitura: Código | Material | Quantidade (+ Valor unit. | Total para a supervisão) */
  function tabelaHTML(mats, qtdLabel = 'Quantidade', vazio = 'Nenhum material registrado.', opts = {}) {
    if (!mats || !mats.length) return `<p class="faint" style="margin:0">${VG.esc(vazio)}</p>`;
    const val = !!opts.valores;
    const total = VG.matsTotal(mats);
    return `<div class="mat-table"><table class="materials materials--cod${val ? ' materials--val' : ''}"><thead><tr><th>Código</th><th>Material</th><th>${VG.esc(qtdLabel)}</th>${val ? '<th class="num">Valor unit.</th><th class="num">Total</th>' : ''}</tr></thead><tbody>${mats.map((m) => `
      <tr><td class="mono-num">${m.codigo ? VG.esc(m.codigo) : '<span class="faint">—</span>'}</td><td>${VG.esc(m.descricao)}</td><td class="mono-num">${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</td>${val ? `<td class="mono-num num">${m.valor != null ? VG.fmtMoney(m.valor) : '<span class="faint">—</span>'}</td><td class="mono-num num">${VG.matTotal(m) != null ? VG.fmtMoney(VG.matTotal(m)) : '<span class="faint">—</span>'}</td>` : ''}</tr>`).join('')}</tbody>
      ${val ? `<tfoot><tr><td colspan="4">Total dos materiais</td><td class="mono-num num">${total != null ? VG.fmtMoney(total) : '<span class="faint">sem valores</span>'}</td></tr></tfoot>` : ''}</table></div>`;
  }

  /** Bloco "Utilizou material" + materiais utilizados (técnico, cliente e supervisão) */
  function utilizadosHTML(os, opts = {}) {
    const a = (os && os.atendimento) || {};
    const u = usou(os);
    return `<div class="mat-usou"><span class="kv__k">Utilizou material:</span> ${usouBadge(os)}</div>
      ${u === false ? '<p class="faint" style="margin:.4rem 0 0">Não foi utilizado material.</p>'
        : u === null ? '<p class="faint" style="margin:.4rem 0 0">O técnico ainda não informou os materiais utilizados.</p>'
        : tabelaHTML(a.materiais, 'Qtd. utilizada', undefined, opts)}`;
  }

  /* ---------- Editor (adicionar / remover itens) ---------- */
  function editorHTML(p, opts = {}) {
    const levar = opts.levar || [];
    const val = !!opts.valores;
    return `
      ${levar.length ? `<div class="mat-pick"><div class="kv__k">Separados pela supervisão — toque para usar</div>
        <div class="mat-pick__list">${levar.map((m) => `
          <button type="button" class="mat-chip" data-pick="${VG.esc(m.id)}">${VG.icon('box')}<span>${m.codigo ? `<b>${VG.esc(m.codigo)}</b>` : ''}${VG.esc(m.descricao)}</span><em>${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</em></button>`).join('')}</div></div>` : ''}
      <div class="mat-add mat-add--cod${val ? ' mat-add--val' : ''}">
        <div class="field mat-search"><label for="${p}-cod">Código${opts.codigoObrigatorio ? '<span class="req">*</span>' : ''}</label><input id="${p}-cod" class="input" placeholder="Ex.: MAT-001" autocomplete="off" autocapitalize="characters" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${p}-cod-sug"><div class="mat-sug hidden" id="${p}-cod-sug" role="listbox"></div></div>
        <div class="field mat-search"><label for="${p}-desc">Material<span class="req">*</span></label><div class="input-group">${VG.icon('search')}<input id="${p}-desc" class="input" placeholder="Digite para buscar…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${p}-desc-sug"></div><div class="mat-sug hidden" id="${p}-desc-sug" role="listbox"></div></div>
        <div class="field"><label for="${p}-qtd">${VG.esc(opts.qtdLabel || 'Qtd.')}</label><input id="${p}-qtd" class="input" type="number" min="0" step="any" inputmode="decimal" value="1"></div>
        <div class="field"><label for="${p}-un">Unidade</label><select id="${p}-un" class="select">${VG.options(VG.UNIDADES, VG.UNIDADES[0])}</select></div>
        ${val ? `<div class="field"><label for="${p}-val">Valor unit. (R$)</label><input id="${p}-val" class="input" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>` : ''}
        <button type="button" class="btn" id="${p}-add">${VG.icon('plus')}<span>Adicionar</span></button>
      </div>
      <ul class="mat-list${val ? ' mat-list--val' : ''}" id="${p}-list"></ul>`;
  }

  /** Lista de sugestões embaixo do campo, filtrando enquanto digita */
  function ligarBusca(input, box, cat, onPick, mostrarValor) {
    let itens = [], ativo = -1;
    const fechar = () => { box.classList.add('hidden'); box.innerHTML = ''; itens = []; ativo = -1; input.setAttribute('aria-expanded', 'false'); };
    const marcar = () => VG.$$('[data-i]', box).forEach((b, i) => { b.classList.toggle('is-on', i === ativo); if (i === ativo) b.scrollIntoView({ block: 'nearest' }); });
    const abrir = () => {
      itens = buscar(cat, input.value);
      ativo = -1;
      if (!itens.length) {
        if (!input.value.trim()) return fechar();
        box.innerHTML = '<div class="mat-sug__vazio">Nenhum material encontrado. Pode digitar um novo.</div>';
      } else {
        box.innerHTML = itens.map((x, i) => `
          <button type="button" class="mat-sug__item" data-i="${i}" role="option" tabindex="-1">
            <span>${x.codigo ? `<small class="mat-cod">${VG.esc(x.codigo)}</small>` : ''}${VG.esc(x.descricao)}</span>
            <em>${mostrarValor && x.valor != null ? VG.esc(VG.fmtMoney(x.valor)) : VG.esc(x.unidade || '')}</em>
          </button>`).join('');
        // mousedown: escolhe antes do campo perder o foco
        VG.$$('[data-i]', box).forEach((b) => b.addEventListener('mousedown', (e) => { e.preventDefault(); escolher(Number(b.dataset.i)); }));
      }
      box.classList.remove('hidden');
      input.setAttribute('aria-expanded', 'true');
    };
    const escolher = (i) => { const x = itens[i]; fechar(); if (x) onPick(x); };
    input.addEventListener('input', abrir);
    input.addEventListener('focus', () => { if (input.value.trim()) abrir(); });
    input.addEventListener('blur', () => setTimeout(fechar, 150));
    input.addEventListener('keydown', (e) => {
      if (box.classList.contains('hidden') || !itens.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); ativo = (ativo + 1) % itens.length; marcar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = (ativo - 1 + itens.length) % itens.length; marcar(); }
      else if (e.key === 'Enter' && ativo >= 0) { e.preventDefault(); e.stopImmediatePropagation(); escolher(ativo); }
      else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
    });
  }

  /**
   * Liga o editor. `getItens()` devolve o array a ser alterado (sempre o atual);
   * `onChange()` é chamado após incluir/remover/alterar.
   * opts.valores: supervisão — informa valor unitário e pode ajustar quantidade/valor de cada item.
   */
  function bindEditor(root, p, getItens, opts = {}) {
    const $ = (id) => VG.$('#' + p + '-' + id, root);
    const cod = $('cod'), desc = $('desc'), qtd = $('qtd'), un = $('un'), list = $('list');
    const valIn = $('val');
    const val = !!opts.valores && !!valIn;
    const cat = catalogo();
    const avisar = () => opts.onChange && opts.onChange();

    const preencher = (x) => {
      cod.value = x.codigo || '';
      desc.value = x.descricao || '';
      if (x.unidade && VG.UNIDADES.includes(x.unidade)) un.value = x.unidade;
      if (val && x.valor != null && !valIn.value.trim()) valIn.value = String(x.valor.toFixed(2)).replace('.', ',');
      qtd.focus(); try { qtd.select(); } catch (e) {}
    };
    ligarBusca(desc, $('desc-sug'), cat, preencher, val);
    ligarBusca(cod, $('cod-sug'), cat, preencher, val);

    const totalHTML = () => {
      const t = VG.matsTotal(getItens());
      return `<li class="mat-total"><span>Total dos materiais</span><b data-total>${t != null ? VG.fmtMoney(t) : '—'}</b></li>`;
    };
    const draw = () => {
      const itens = getItens();
      if (!itens.length) {
        list.innerHTML = `<li class="faint" style="justify-content:center">${VG.esc(opts.vazio || 'Nenhum material adicionado.')}</li>`;
      } else if (val) {
        list.innerHTML = itens.map((m) => `
          <li data-id="${VG.esc(m.id)}">${VG.icon('box')}
            <span class="mat-list__nome">${m.codigo ? `<small class="mat-cod">${VG.esc(m.codigo)}</small>` : ''}${VG.esc(m.descricao)}</span>
            <label class="mat-ed"><small>Qtd.${m.unidade ? ' (' + VG.esc(m.unidade) + ')' : ''}</small><input class="input" data-q type="number" min="0" step="any" inputmode="decimal" value="${VG.esc(m.quantidade)}"></label>
            <label class="mat-ed"><small>Valor unit.</small><input class="input" data-v inputmode="decimal" placeholder="0,00" value="${m.valor != null ? VG.esc(Number(m.valor).toFixed(2).replace('.', ',')) : ''}"></label>
            <b class="mat-sub" data-sub>${VG.matTotal(m) != null ? VG.fmtMoney(VG.matTotal(m)) : '—'}</b>
            <button type="button" class="btn btn-ghost btn-icon" data-rm="${VG.esc(m.id)}" aria-label="Remover material">${VG.icon('trash')}</button></li>`).join('') + totalHTML();
        // ajuste direto na lista: quantidade e valor de cada item (inclusive os do técnico)
        VG.$$('li[data-id]', list).forEach((li) => {
          const m = getItens().find((x) => x.id === li.dataset.id);
          const q = VG.$('[data-q]', li), v = VG.$('[data-v]', li);
          const atualizar = () => {
            li.querySelector('[data-sub]').textContent = VG.matTotal(m) != null ? VG.fmtMoney(VG.matTotal(m)) : '—';
            const t = VG.matsTotal(getItens());
            list.querySelector('[data-total]').textContent = t != null ? VG.fmtMoney(t) : '—';
            avisar();
          };
          q.addEventListener('input', () => { const n = Number(String(q.value).replace(',', '.')); q.closest('.mat-ed').classList.toggle('invalid', !(n > 0)); if (n > 0) { m.quantidade = Math.round(n * 1000) / 1000; atualizar(); } });
          v.addEventListener('input', () => {
            const n = VG.parseMoney(v.value);
            v.closest('.mat-ed').classList.toggle('invalid', Number.isNaN(n));
            if (Number.isNaN(n)) return;
            if (n == null) delete m.valor; else m.valor = n;
            atualizar();
          });
          v.addEventListener('blur', () => { if (m.valor != null) v.value = Number(m.valor).toFixed(2).replace('.', ','); });
        });
      } else {
        list.innerHTML = itens.map((m) => `
        <li>${VG.icon('box')}<span>${m.codigo ? `<small class="mat-cod">${VG.esc(m.codigo)}</small>` : ''}${VG.esc(m.descricao)}</span><b>${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</b>
          <button type="button" class="btn btn-ghost btn-icon" data-rm="${VG.esc(m.id)}" aria-label="Remover material">${VG.icon('trash')}</button></li>`).join('');
      }
      VG.$$('[data-rm]', list).forEach((b) => (b.onclick = () => {
        const arr = getItens();
        const i = arr.findIndex((m) => m.id === b.dataset.rm);
        if (i >= 0) arr.splice(i, 1);
        avisar();
        draw();
      }));
    };

    const add = () => {
      const c = cod.value.trim(), d = desc.value.trim(), q = Number(String(qtd.value).replace(',', '.'));
      const v = val ? VG.parseMoney(valIn.value) : null;
      VG.$$('.mat-add .field.invalid', root).forEach((x) => x.classList.remove('invalid'));
      const bad = (el, msg) => { el.closest('.field').classList.add('invalid'); el.focus(); VG.toast(msg, 'warn'); };
      if (opts.codigoObrigatorio && !c) return bad(cod, 'Informe o código do material.');
      if (!d) return bad(desc, 'Informe o material.');
      if (!(q > 0)) return bad(qtd, 'Informe uma quantidade válida.');
      if (val && Number.isNaN(v)) return bad(valIn, 'Valor inválido. Use, por exemplo, 12,50.');
      const arr = getItens();
      // mesmo código (ou mesmo material sem código) e mesma unidade: soma a quantidade
      const igual = arr.find((m) => m.unidade === un.value && (c ? VG.norm(m.codigo) === VG.norm(c) : !m.codigo && VG.norm(m.descricao) === VG.norm(d)));
      if (igual) {
        igual.quantidade = Math.round((Number(igual.quantidade) + q) * 1000) / 1000;
        if (val && v != null) igual.valor = v;
      } else arr.push(limpar({ codigo: c, descricao: d, quantidade: q, unidade: un.value, valor: val ? v : null }));
      avisar();
      draw();
      cod.value = ''; desc.value = ''; qtd.value = 1; un.value = VG.UNIDADES[0];
      if (val) valIn.value = '';
      (opts.codigoObrigatorio ? cod : desc).focus();
    };
    $('add').onclick = add;
    [cod, desc, qtd].concat(val ? [valIn] : []).forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }));

    // toca no material separado pela supervisão e confirma a quantidade usada
    VG.$$('[data-pick]', root).forEach((b) => (b.onclick = () => {
      const m = (opts.levar || []).find((x) => x.id === b.dataset.pick);
      if (!m) return;
      cod.value = m.codigo || ''; desc.value = m.descricao || ''; un.value = m.unidade || VG.UNIDADES[0]; qtd.value = m.quantidade || 1;
      if (val) { const x = cat.find((k) => m.codigo && VG.norm(k.codigo) === VG.norm(m.codigo)); valIn.value = x && x.valor != null ? x.valor.toFixed(2).replace('.', ',') : ''; }
      qtd.focus(); try { qtd.select(); } catch (e) {}
      VG.toast('Confira a quantidade utilizada e toque em Adicionar.', 'info', 2600);
    }));

    draw();
    return { draw };
  }

  /** "MAT-001 Sensor (4 unidade(s)); Cabo UTP (10 metro(s))" — usado no histórico */
  const resumo = (mats) => (mats || []).map((m) => `${m.codigo ? m.codigo + ' ' : ''}${m.descricao} (${m.quantidade}${m.unidade ? ' ' + m.unidade : ''})`).join('; ');

  VG.Mat = { limpar, resumo, usou, usouTexto, usouBadge, catalogo, buscar, tabelaHTML, utilizadosHTML, editorHTML, bindEditor };
})();
