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

  /* ---------- Valores (somente supervisão) ----------
   * Os valores vêm da lista de Materiais (tela Materiais / CSV), pelo código.
   * Técnico, cliente e PDF nunca recebem valores (o servidor nem envia).
   */
  const verValores = () => { const s = VG.Auth && VG.Auth.current(); return !!s && s.papel === 'supervisora' && !S().isPublic(); };
  function precos() {
    const map = {};
    S().list('materiais').forEach((m) => { if (m && m.codigo) map[VG.norm(m.codigo)] = m; });
    return map;
  }
  const precoDe = (mapa, m) => (m && m.codigo ? mapa[VG.norm(m.codigo)] || null : null);
  const temValor = (v) => v != null && v !== '' && isFinite(Number(v));
  /**
   * Valor unitário de venda do item: o lançado pela supervisão na OS (fica gravado)
   * ou, se ainda não houver, o da lista de Materiais (só para a supervisão).
   */
  const vendaDe = (m, mapa) => {
    if (m && temValor(m.valorVenda)) return Number(m.valorVenda);
    if (!verValores()) return null;
    const p = precoDe(mapa || precos(), m);
    return p && temValor(p.valorVenda) ? Number(p.valorVenda) : null;
  };
  const custoDe = (m, mapa) => { const p = precoDe(mapa, m); return p && temValor(p.valor) ? Number(p.valor) : (m && temValor(m.valor) ? Number(m.valor) : null); };
  const mult = (q, v) => (v == null || v === '' ? null : Math.round(Number(q || 0) * Number(v) * 100) / 100);
  const reais = (v) => (v == null || v === '' ? '—' : VG.fmtMoney(v));
  /** Totais (custo e venda) de uma lista de materiais pela lista de preços atual */
  function totais(mats, mapa) {
    mapa = mapa || precos();
    let custo = 0, venda = 0, semPreco = 0;
    (mats || []).forEach((m) => {
      const c = mult(m.quantidade, custoDe(m, mapa)), v = mult(m.quantidade, vendaDe(m, mapa));
      if (c == null && v == null) semPreco++;
      custo += c || 0; venda += v || 0;
    });
    return { custo: Math.round(custo * 100) / 100, venda: Math.round(venda * 100) / 100, semPreco, n: (mats || []).length };
  }
  /** Lista de materiais ainda não chegou do servidor (Code.gs antigo) */
  const servidorSemLista = () => !!S().semListaMateriais && S().semListaMateriais();

  /** Item limpo: identificação, quantidade e o valor de venda lançado pela supervisão (se houver) */
  const limpar = (m) => {
    const o = {
      id: m.id || VG.uid(), codigo: String(m.codigo || '').trim(), descricao: String(m.descricao || '').trim(),
      quantidade: Number(m.quantidade) || 0, unidade: m.unidade || VG.UNIDADES[0],
    };
    if (temValor(m.valorVenda) && Number(m.valorVenda) >= 0) o.valorVenda = Math.round(Number(m.valorVenda) * 100) / 100;
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
   * Catálogo da busca: materiais cadastrados (tela Materiais / lista CSV) e,
   * depois, os códigos já usados em OS que não estão no cadastro.
   */
  function catalogo() {
    const map = {};
    const inativos = new Set();
    S().list('materiais').forEach((m) => {
      if (m && m.ativo === false) inativos.add(VG.norm(m.codigo));
      if (!m || m.ativo === false || !m.descricao) return;
      const k = VG.norm(m.codigo || m.descricao);
      if (!map[k]) map[k] = { codigo: m.codigo || '', descricao: m.descricao, unidade: VG.unidadeDe(m.unidade), marca: m.marca || '', cadastro: true, valor: m.valor, valorVenda: m.valorVenda };
    });
    S().list('ordens').forEach((o) => {
      [].concat(o.materiaisLevar || [], (o.atendimento && o.atendimento.materiais) || []).forEach((m) => {
        if (!m || !m.codigo) return;
        const k = VG.norm(m.codigo);
        if (inativos.has(k)) return; // desativado na tela Materiais: não volta pela busca
        if (!map[k]) map[k] = { codigo: m.codigo, descricao: m.descricao, unidade: m.unidade };
      });
    });
    return Object.values(map).sort((a, b) => String(a.descricao).localeCompare(String(b.descricao), 'pt-BR', { numeric: true }));
  }

  /* ---------- Busca de materiais (aparece já na primeira letra) ---------- */
  const MAX_SUG = 40;
  /** Prepara o catálogo para buscar rápido: textos normalizados uma vez só */
  function indice() {
    const cat = catalogo();
    // sem lista cadastrada: mantém as sugestões básicas de antes
    if (!S().list('materiais').length) SUGESTOES.forEach((d) => { if (!cat.some((c) => VG.norm(c.descricao) === VG.norm(d))) cat.push({ codigo: '', descricao: d, unidade: '', marca: '' }); });
    return cat.map((c) => {
      const cod = VG.norm(c.codigo), desc = VG.norm(c.descricao);
      return { c, cod, desc, txt: cod + ' ' + desc + ' ' + VG.norm(c.marca), palavras: desc.split(/[^a-z0-9]+/).filter(Boolean) };
    });
  }
  /**
   * Procura pelo código ou pelo nome. Ordem: código que começa com o texto,
   * nome que começa com o texto, palavra do nome que começa com o texto e,
   * por último, o texto em qualquer parte. Várias palavras: todas precisam aparecer.
   */
  function buscar(idx, q) {
    const nq = VG.norm(q);
    if (!nq) return [];
    const termos = nq.split(/\s+/).filter(Boolean);
    const out = [];
    for (const it of idx) {
      if (!termos.every((t) => it.txt.includes(t))) continue;
      let p = 4;
      if (it.cod && it.cod === nq) p = 0;
      else if (it.cod && it.cod.startsWith(nq)) p = 1;
      else if (it.desc.startsWith(nq)) p = 2;
      else if (it.palavras.some((w) => w.startsWith(termos[0]))) p = 3;
      out.push({ p, it });
    }
    out.sort((a, b) => a.p - b.p
      || (a.p === 1 ? a.it.cod.localeCompare(b.it.cod, 'pt-BR', { numeric: true }) : 0)
      || a.it.desc.localeCompare(b.it.desc, 'pt-BR', { numeric: true }));
    return out.map((x) => x.it.c);
  }
  /** Destaca no texto as partes digitadas (sem diferenciar acentos/maiúsculas) */
  function destacar(txt, q) {
    const s = String(txt || '');
    const termos = VG.norm(q).split(/\s+/).filter(Boolean);
    if (!termos.length) return VG.esc(s);
    const ns = VG.norm(s);
    // norm() pode encurtar o texto (acentos combinados); só destaca quando os tamanhos batem
    if (ns.length !== s.length) return VG.esc(s);
    const marca = new Array(s.length).fill(false);
    termos.forEach((t) => { let i = ns.indexOf(t); while (i >= 0) { for (let j = i; j < i + t.length; j++) marca[j] = true; i = ns.indexOf(t, i + t.length); } });
    let html = '', aberto = false;
    for (let i = 0; i < s.length; i++) {
      if (marca[i] && !aberto) { html += '<mark>'; aberto = true; }
      if (!marca[i] && aberto) { html += '</mark>'; aberto = false; }
      html += VG.esc(s[i]);
    }
    return html + (aberto ? '</mark>' : '');
  }

  /** Tabela de leitura: Código | Material | Quantidade */
  function tabelaHTML(mats, qtdLabel = 'Quantidade', vazio = 'Nenhum material registrado.', opts = {}) {
    if (!mats || !mats.length) return `<p class="faint" style="margin:0">${VG.esc(vazio)}</p>`;
    if (opts.valores && verValores()) return tabelaValoresHTML(mats, qtdLabel);
    return `<div class="mat-table"><table class="materials materials--cod"><thead><tr><th>Código</th><th>Material</th><th>${VG.esc(qtdLabel)}</th></tr></thead><tbody>${mats.map((m) => `
      <tr><td class="mono-num">${m.codigo ? VG.esc(m.codigo) : '<span class="faint">—</span>'}</td><td>${VG.esc(m.descricao)}</td><td class="mono-num">${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /** Supervisão: Código | Material | Qtd. | Valor un. | Venda un. | Total custo | Total venda (+ totais) */
  function tabelaValoresHTML(mats, qtdLabel) {
    const mapa = precos();
    const t = totais(mats, mapa);
    return `<div class="mat-table"><table class="materials materials--cod materials--val"><thead><tr><th>Código</th><th>Material</th><th>${VG.esc(qtdLabel)}</th>
      <th class="r">Valor un.</th><th class="r">Venda un.</th><th class="r">Total custo</th><th class="r">Total venda</th></tr></thead><tbody>${mats.map((m) => {
        const p = precoDe(mapa, m);
        const custo = custoDe(m, mapa), venda = vendaDe(m, mapa);
        const nota = temValor(m.valorVenda) ? '<span class="sub faint">valor lançado na OS</span>' : p ? '' : '<span class="sub faint">sem preço na lista</span>';
        return `<tr><td class="mono-num">${m.codigo ? VG.esc(m.codigo) : '<span class="faint">—</span>'}</td><td>${VG.esc(m.descricao)}${nota}</td>
          <td class="mono-num">${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</td>
          <td class="mono-num r">${reais(custo)}</td><td class="mono-num r">${reais(venda)}</td>
          <td class="mono-num r">${reais(mult(m.quantidade, custo))}</td><td class="mono-num r"><b>${reais(mult(m.quantidade, venda))}</b></td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td colspan="5"><span class="faint">Venda: valor lançado na OS ou, sem ele, o da lista de Materiais${t.semPreco ? ` · ${t.semPreco} ${t.semPreco === 1 ? 'item sem preço' : 'itens sem preço'}` : ''}</span></td>
        <td class="mono-num r"><b>${VG.esc(VG.fmtMoney(t.custo))}</b></td><td class="mono-num r"><b>${VG.esc(VG.fmtMoney(t.venda))}</b></td></tr></tfoot></table></div>`;
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
    const temCadastro = S().list('materiais').some((m) => m.ativo !== false);
    return `
      ${levar.length ? `<div class="mat-pick"><div class="kv__k">Separados pela supervisão — toque para usar</div>
        <div class="mat-pick__list">${levar.map((m) => `
          <button type="button" class="mat-chip" data-pick="${VG.esc(m.id)}">${VG.icon('box')}<span>${m.codigo ? `<b>${VG.esc(m.codigo)}</b>` : ''}${VG.esc(m.descricao)}</span><em>${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}</em></button>`).join('')}</div></div>` : ''}
      <div class="mat-add mat-add--cod">
        <div class="field mat-ac"><label for="${p}-cod">Código${opts.codigoObrigatorio ? '<span class="req">*</span>' : ''}</label><input id="${p}-cod" class="input" placeholder="Ex.: 1110" autocomplete="off" autocapitalize="characters" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${p}-sugbox"></div>
        <div class="field mat-ac"><label for="${p}-desc">Material<span class="req">*</span></label><input id="${p}-desc" class="input" placeholder="Digite para buscar…" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${p}-sugbox"></div>
        <div class="field"><label for="${p}-qtd">${VG.esc(opts.qtdLabel || 'Qtd.')}</label><input id="${p}-qtd" class="input" type="number" min="0" step="any" inputmode="decimal" value="1"></div>
        <div class="field"><label for="${p}-un">Unidade</label><select id="${p}-un" class="select">${VG.options(VG.UNIDADES, VG.UNIDADES[0])}</select></div>
        <button type="button" class="btn" id="${p}-add">${VG.icon('plus')}<span>Adicionar</span></button>
      </div>
      <div class="mat-sug hidden" id="${p}-sugbox" role="listbox" aria-label="Materiais encontrados"></div>
      ${temCadastro ? '' : servidorSemLista() && verValores()
        ? `<div class="notice" style="margin-top:.6rem">${VG.icon('alert')}<div>A lista de materiais não veio do servidor: o <b>Code.gs</b> publicado ainda é o antigo. Cole o Code.gs novo no Apps Script e publique uma <b>nova versão</b> em Implantar → Gerenciar implantações.</div></div>`
        : `<p class="hint" style="margin:.5rem 0 0">Nenhum material cadastrado ainda: digite o código e o nome. ${verValores() ? 'Importe a lista em <a href="#/materiais">Materiais</a> → Importar / atualizar CSV.' : 'A supervisão cadastra a lista em <b>Materiais</b>.'}</p>`}
      <ul class="mat-list" id="${p}-list"></ul>`;
  }

  /**
   * Liga o editor. `getItens()` devolve o array a ser alterado (sempre o atual);
   * `onChange()` é chamado após incluir/remover/alterar.
   * opts.editarValores (supervisão, Corrigir materiais): cada item tem quantidade e
   * valor unitário de venda editáveis direto na lista.
   */
  function bindEditor(root, p, getItens, opts = {}) {
    const $ = (id) => VG.$('#' + p + '-' + id, root);
    const cod = $('cod'), desc = $('desc'), qtd = $('qtd'), un = $('un'), list = $('list');
    const idx = indice();
    const valores = verValores();
    const editar = valores && !!opts.editarValores;
    const dinheiro = (v) => (temValor(v) ? Number(v).toFixed(2).replace('.', ',') : '');
    const porCodigo = (c) => { const n = VG.norm(c); const r = n && idx.find((x) => x.cod === n); return r && r.c; };
    const porDesc = (d) => { const n = VG.norm(d); const r = n && idx.find((x) => x.desc === n); return r && r.c; };
    const setUn = (u) => {
      if (!u) return;
      if (!Array.from(un.options).some((o) => o.value === u)) un.insertAdjacentHTML('beforeend', `<option value="${VG.esc(u)}">${VG.esc(u)}</option>`);
      un.value = u;
    };

    /* ----- lista de sugestões: abre na primeira letra digitada ----- */
    const box = $('sugbox');
    let achados = [], ativo = -1, campo = null;
    let host = null; // quadro (panel/modal) que fica por cima dos vizinhos enquanto a lista está aberta
    const fechar = () => {
      box.classList.add('hidden'); box.innerHTML = ''; achados = []; ativo = -1;
      if (host) { host.classList.remove('mat-sug-host'); host = null; }
      [cod, desc].forEach((i) => { i.setAttribute('aria-expanded', 'false'); i.removeAttribute('aria-activedescendant'); });
    };
    const escolher = (c) => {
      if (!c) return;
      cod.value = c.codigo || ''; desc.value = c.descricao || ''; setUn(c.unidade);
      fechar();
      VG.$$('.field.invalid', root).forEach((x) => x.classList.remove('invalid'));
      qtd.focus(); try { qtd.select(); } catch (e) {}
    };
    const marcar = (i) => {
      ativo = i;
      VG.$$('.mat-sug__item', box).forEach((b, j) => b.classList.toggle('on', j === i));
      const sel = box.querySelector('.mat-sug__item.on');
      if (sel) { sel.scrollIntoView({ block: 'nearest' }); campo && campo.setAttribute('aria-activedescendant', sel.id); }
    };
    const abrir = (input) => {
      campo = input;
      const q = input.value.trim();
      if (!q || !idx.length) return fechar();
      const todos = buscar(idx, q);
      achados = todos.slice(0, MAX_SUG);
      // a lista aparece logo abaixo do campo em que se está digitando, na largura do quadro
      const linha = input.closest('.mat-add');
      if (box.parentNode !== linha) linha.appendChild(box);
      box.style.top = (input.offsetTop + input.offsetHeight + 4) + 'px';
      box.innerHTML = achados.length
        ? achados.map((c, i) => `
          <button type="button" class="mat-sug__item" role="option" id="${p}-sug-${i}" data-i="${i}" tabindex="-1">
            <span class="mat-sug__cod">${c.codigo ? destacar(c.codigo, q) : '—'}</span>
            <span class="mat-sug__txt"><b>${destacar(c.descricao, q)}</b>${detalhe(c) ? `<small>${VG.esc(detalhe(c))}</small>` : ''}</span>
            ${valores && (c.valor != null || c.valorVenda != null) ? `<span class="mat-sug__val"><b>${VG.esc(reais(c.valorVenda))}</b><small>custo ${VG.esc(reais(c.valor))}</small></span>` : ''}
          </button>`).join('') + (todos.length > achados.length ? `<div class="mat-sug__mais">Mais ${todos.length - achados.length} resultados — continue digitando para filtrar.</div>` : '')
        : `<div class="mat-sug__vazio">Nenhum material com “${VG.esc(q)}”. Você pode digitar o material mesmo assim.</div>`;
      box.classList.remove('hidden');
      if (!host) { host = linha.closest('.panel, .modal'); if (host) host.classList.add('mat-sug-host'); }
      input.setAttribute('aria-expanded', 'true');
      ativo = -1;
      VG.$$('.mat-sug__item', box).forEach((b) => {
        b.addEventListener('mousedown', (e) => e.preventDefault()); // não tira o foco do campo antes do clique
        b.addEventListener('click', () => escolher(achados[Number(b.dataset.i)]));
      });
      if (achados.length) marcar(0);
      // celular: garante que a lista não fique escondida atrás do teclado
      requestAnimationFrame(() => { try { box.scrollIntoView({ block: 'nearest' }); } catch (e) {} });
    };
    // marca genérica ("MARCA GERAL") não ajuda a escolher: não aparece
    const detalhe = (c) => [/^marca geral$/i.test(String(c.marca || '').trim()) ? '' : c.marca, c.unidade].filter(Boolean).join(' · ');
    const teclas = (input) => (e) => {
      const aberta = !box.classList.contains('hidden') && achados.length;
      if (e.key === 'ArrowDown' && aberta) { e.preventDefault(); marcar((ativo + 1) % achados.length); }
      else if (e.key === 'ArrowUp' && aberta) { e.preventDefault(); marcar((ativo - 1 + achados.length) % achados.length); }
      else if (e.key === 'Escape' && !box.classList.contains('hidden')) { e.preventDefault(); e.stopPropagation(); fechar(); }
      else if ((e.key === 'Enter' || e.key === 'Tab') && aberta && ativo >= 0) {
        if (e.key === 'Tab' && e.shiftKey) return;
        e.preventDefault(); e.stopImmediatePropagation(); escolher(achados[ativo]);
      }
    };
    [cod, desc].forEach((input) => {
      input.addEventListener('input', () => abrir(input));
      input.addEventListener('focus', () => { if (input.value.trim()) abrir(input); });
      input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== cod && document.activeElement !== desc) fechar(); }, 150));
      input.addEventListener('keydown', teclas(input));
    });

    const draw = () => {
      const itens = getItens();
      const mapa = valores ? precos() : {};
      const valorItem = (m) => {
        if (!valores) return '';
        const p = precoDe(mapa, m);
        if (!p || (p.valor == null && p.valorVenda == null)) return '<span class="mat-val">sem preço na lista</span>';
        return `<span class="mat-val">${VG.esc(reais(p.valorVenda))} un. · total ${VG.esc(reais(mult(m.quantidade, p.valorVenda)))}</span><span class="mat-val">custo ${VG.esc(reais(mult(m.quantidade, p.valor)))}</span>`;
      };
      const t = valores && itens.length ? totais(itens, mapa) : null;
      if (editar && itens.length) return drawEditavel(itens, mapa);
      list.innerHTML = itens.length ? itens.map((m) => `
        <li>${VG.icon('box')}<span>${m.codigo ? `<small class="mat-cod">${VG.esc(m.codigo)}</small>` : ''}${VG.esc(m.descricao)}</span><b>${VG.esc(m.quantidade)} ${VG.esc(m.unidade || '')}${valorItem(m)}</b>
          <button type="button" class="btn btn-ghost btn-icon" data-rm="${VG.esc(m.id)}" aria-label="Remover material">${VG.icon('trash')}</button></li>`).join('')
          + (t ? `<li class="mat-total"><span>Total (${t.n} ${t.n === 1 ? 'item' : 'itens'})${t.semPreco ? ` <small class="faint">· ${t.semPreco} sem preço</small>` : ''}</span><b>${VG.esc(VG.fmtMoney(t.venda))}<span class="mat-val">custo ${VG.esc(VG.fmtMoney(t.custo))}</span></b></li>` : '')
        : `<li class="faint" style="justify-content:center">${VG.esc(opts.vazio || 'Nenhum material adicionado.')}</li>`;
      ligarRemover();
    };
    const ligarRemover = () => VG.$$('[data-rm]', list).forEach((b) => (b.onclick = () => {
      const arr = getItens();
      const i = arr.findIndex((m) => m.id === b.dataset.rm);
      if (i >= 0) arr.splice(i, 1);
      opts.onChange && opts.onChange();
      draw();
    }));
    /** Supervisão: quantidade e valor unitário de venda editáveis em cada item (inclusive os do técnico) */
    const drawEditavel = (itens, mapa) => {
      // item sem valor lançado começa com o valor da lista (pode ser trocado)
      itens.forEach((m) => { if (!temValor(m.valorVenda)) { const v = vendaDe(m, mapa); if (v != null) m.valorVenda = v; } });
      const totalTxt = () => { const t = totais(getItens(), mapa); return `${VG.fmtMoney(t.venda)}`; };
      list.innerHTML = itens.map((m) => `
        <li class="mat-li-ed" data-id="${VG.esc(m.id)}">${VG.icon('box')}
          <span class="mat-li-ed__nome">${m.codigo ? `<small class="mat-cod">${VG.esc(m.codigo)}</small>` : ''}${VG.esc(m.descricao)}</span>
          <label class="mat-ed"><small>Qtd.${m.unidade ? ' (' + VG.esc(m.unidade) + ')' : ''}</small><input class="input" data-q type="number" min="0" step="any" inputmode="decimal" value="${VG.esc(m.quantidade)}"></label>
          <label class="mat-ed"><small>Valor un. (R$)</small><input class="input" data-v inputmode="decimal" placeholder="0,00" autocomplete="off" value="${VG.esc(dinheiro(m.valorVenda))}"></label>
          <span class="mat-ed__tot"><small>Total</small><b data-sub>${VG.esc(reais(mult(m.quantidade, m.valorVenda)))}</b></span>
          <button type="button" class="btn btn-ghost btn-icon" data-rm="${VG.esc(m.id)}" aria-label="Remover material">${VG.icon('trash')}</button></li>`).join('')
        + `<li class="mat-total"><span>Total (${itens.length} ${itens.length === 1 ? 'item' : 'itens'})</span><b data-total>${VG.esc(totalTxt())}</b></li>`;
      VG.$$('li[data-id]', list).forEach((li) => {
        const m = getItens().find((x) => x.id === li.dataset.id);
        const q = VG.$('[data-q]', li), v = VG.$('[data-v]', li);
        const atualizar = () => {
          VG.$('[data-sub]', li).textContent = reais(mult(m.quantidade, m.valorVenda));
          VG.$('[data-total]', list).textContent = totalTxt();
          opts.onChange && opts.onChange();
        };
        q.addEventListener('input', () => {
          const n = Number(String(q.value).replace(',', '.'));
          q.closest('.mat-ed').classList.toggle('invalid', !(n > 0));
          if (n > 0) { m.quantidade = Math.round(n * 1000) / 1000; atualizar(); }
        });
        v.addEventListener('input', () => {
          const n = VG.parseMoney(v.value);
          const ruim = n !== null && !(n >= 0);
          v.closest('.mat-ed').classList.toggle('invalid', ruim);
          if (ruim) return;
          if (n == null) delete m.valorVenda; else m.valorVenda = Math.round(n * 100) / 100;
          atualizar();
        });
        v.addEventListener('blur', () => { v.value = dinheiro(m.valorVenda); });
      });
      ligarRemover();
    };

    // código ou nome digitado por inteiro (sem tocar na lista): completa o outro campo
    cod.addEventListener('change', () => {
      const c = porCodigo(cod.value);
      if (c) { desc.value = c.descricao || desc.value; setUn(c.unidade); }
    });
    desc.addEventListener('change', () => {
      if (cod.value.trim()) return;
      const c = porDesc(desc.value);
      if (c) { cod.value = c.codigo; setUn(c.unidade); }
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
      fechar();
      (idx.length ? desc : opts.codigoObrigatorio ? cod : desc).focus();
    };
    $('add').onclick = add;
    [cod, desc, qtd].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }));

    // técnico: toca no material separado pela supervisão e confirma a quantidade usada
    VG.$$('[data-pick]', root).forEach((b) => (b.onclick = () => {
      const m = (opts.levar || []).find((x) => x.id === b.dataset.pick);
      if (!m) return;
      cod.value = m.codigo || ''; desc.value = m.descricao || ''; setUn(m.unidade || VG.UNIDADES[0]); qtd.value = m.quantidade || 1;
      fechar();
      qtd.focus(); try { qtd.select(); } catch (e) {}
      VG.toast('Confira a quantidade utilizada e toque em Adicionar.', 'info', 2600);
    }));

    draw();
    return { draw };
  }

  /** "MAT-001 Sensor (4 unidade(s)); Cabo UTP (10 metro(s))" — usado no histórico */
  const resumo = (mats) => (mats || []).map((m) => `${m.codigo ? m.codigo + ' ' : ''}${m.descricao} (${m.quantidade}${m.unidade ? ' ' + m.unidade : ''})`).join('; ');

  VG.Mat = { limpar, resumo, usou, usouTexto, usouBadge, catalogo, indice, buscar, destacar, tabelaHTML, utilizadosHTML, editorHTML, bindEditor, totais, verValores, vendaDe };
})();
