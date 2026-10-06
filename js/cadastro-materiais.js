/* =========================================================
   VEGAS OS — MATERIAIS E VALORES (cadastro da supervisão)
   • Lista de materiais com código, nome, marca, unidade,
     valor (custo) e valor de venda.
   • Importa e ATUALIZA por lista CSV: o código manda —
     código existente é atualizado, código novo é incluído.
   • É desta lista que sai a busca do campo "Material"
     na OS (abre já na primeira letra).
   • Os valores ficam só aqui: a OS, o técnico, o cliente
     e o PDF continuam mostrando só código, material e qtd.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;

  let state = { q: '', status: 'ativo', marca: '', limite: 100 };

  /* ---------- números ---------- */
  /** "26,964" · "1.234,56" · "R$ 30" · "12.5" → número (4 casas); vazio → null; inválido → NaN */
  function lerNumero(txt, virgulaDecimal) {
    let t = String(txt == null ? '' : txt).replace(/r\$|\s/gi, '');
    if (!t) return null;
    const comVirgula = virgulaDecimal === undefined ? t.includes(',') : virgulaDecimal;
    if (comVirgula) t = t.replace(/\./g, '').replace(',', '.');
    else if (virgulaDecimal === undefined && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const n = Number(t);
    return isFinite(n) && n >= 0 ? Math.round(n * 10000) / 10000 : NaN;
  }
  const paraCampo = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));
  const dinheiro = (v) => (v == null || v === '' ? '<span class="faint">—</span>' : VG.esc(VG.fmtMoney(v)));
  const igualNum = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.00005);
  const limparCodigo = (c) => String(c == null ? '' : c).trim().replace(/^(\d+)\.0+$/, '$1');

  /* ---------- lista ---------- */
  const todos = () => S().list('materiais');
  const marcas = () => Array.from(new Set(todos().map((m) => m.marca).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  function filtrados() {
    const termos = VG.norm(state.q).split(/\s+/).filter(Boolean);
    return todos()
      .filter((m) => !state.status || (state.status === 'ativo' ? m.ativo !== false : m.ativo === false))
      .filter((m) => !state.marca || m.marca === state.marca)
      .filter((m) => { if (!termos.length) return true; const t = VG.norm([m.codigo, m.descricao, m.marca].join(' ')); return termos.every((x) => t.includes(x)); })
      .sort((a, b) => {
        // com pesquisa: código exato e "começa com" primeiro
        if (termos.length) {
          const q = VG.norm(state.q);
          const p = (m) => (VG.norm(m.codigo) === q ? 0 : VG.norm(m.codigo).startsWith(q) ? 1 : VG.norm(m.descricao).startsWith(q) ? 2 : 3);
          const d = p(a) - p(b);
          if (d) return d;
        }
        return String(a.descricao).localeCompare(String(b.descricao), 'pt-BR', { numeric: true });
      });
  }

  function render(el) {
    const ativos = todos().filter((m) => m.ativo !== false).length;
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div><h1>Materiais e valores</h1><p>Lista de materiais usada na busca da OS. Importe a planilha CSV para incluir e atualizar os valores.</p></div>
          <div class="page-head__actions">
            <button class="btn" id="mc-export" ${todos().length ? '' : 'disabled'}>${VG.icon('download')}<span>Exportar CSV</span></button>
            <button class="btn" id="mc-import">${VG.icon('upload')}<span>Importar / atualizar CSV</span></button>
            <button class="btn btn-primary" id="mc-new">${VG.icon('plus')}<span>Novo material</span></button>
          </div>
        </div>
        <div class="notice notice--info">${VG.icon('info')}<div>Os valores ficam só nesta tela. Na OS, para o técnico, no link do cliente e no PDF aparecem apenas <b>código, material e quantidade</b>. ${ativos ? `<b>${ativos}</b> ${ativos === 1 ? 'material ativo' : 'materiais ativos'} na busca.` : ''}</div></div>
        <section class="panel">
          <div class="toolbar">
            <div class="field field--search"><label for="mc-q">Pesquisar</label>
              <div class="input-group">${VG.icon('search')}<input id="mc-q" class="input" placeholder="Código, material ou marca" value="${VG.esc(state.q)}" autocomplete="off"></div></div>
            <div class="field"><label for="mc-marca">Marca</label>
              <select id="mc-marca" class="select">${VG.options(marcas(), state.marca, 'Todas')}</select></div>
            <div class="field"><label for="mc-st">Status</label>
              <select id="mc-st" class="select">${VG.options([{ value: 'ativo', label: 'Ativos' }, { value: 'inativo', label: 'Inativos' }], state.status, 'Todos')}</select></div>
          </div>
          <div id="mc-table"></div>
        </section>
      </div>`;
    const redraw = () => render(el);
    VG.$('#mc-new', el).onclick = () => form(null, redraw);
    VG.$('#mc-import', el).onclick = () => importar(redraw);
    VG.$('#mc-export', el).onclick = exportar;
    VG.$('#mc-q', el).addEventListener('input', VG.debounce((e) => { state.q = e.target.value; state.limite = 100; table(el); }, 150));
    VG.$('#mc-marca', el).onchange = (e) => { state.marca = e.target.value; state.limite = 100; table(el); };
    VG.$('#mc-st', el).onchange = (e) => { state.status = e.target.value; state.limite = 100; table(el); };
    table(el);
  }

  function table(el) {
    const box = VG.$('#mc-table', el);
    const lista = filtrados();
    const pagina = lista.slice(0, state.limite);
    const total = todos().length;
    const redraw = () => render(el);
    if (!pagina.length) {
      box.innerHTML = total
        ? VG.empty('search', 'Nenhum material encontrado', 'Ajuste a pesquisa ou os filtros.')
        : VG.empty('box', 'Nenhum material cadastrado', 'Importe a lista CSV do estoque (código, material, unidade, valor e valor de venda) ou cadastre um por um.',
          `<button class="btn btn-primary" data-act="imp">${VG.icon('upload')}<span>Importar lista CSV</span></button>`);
      const b = box.querySelector('[data-act=imp]'); if (b) b.onclick = () => importar(redraw);
      return;
    }
    box.innerHTML = `
      <div class="table-wrap"><table class="table table--cards">
        <thead><tr><th>Código</th><th>Material</th><th>Marca</th><th>Unidade</th><th style="text-align:right">Valor</th><th style="text-align:right">Valor venda</th><th>Status</th><th style="text-align:right">Ações</th></tr></thead>
        <tbody>${pagina.map((m) => `
          <tr data-id="${VG.esc(m.id)}">
            <td data-label="Código" class="num">${VG.esc(m.codigo)}</td>
            <td data-label="Material"><span class="strong">${VG.esc(m.descricao)}</span></td>
            <td data-label="Marca">${VG.esc(m.marca || '—')}</td>
            <td data-label="Unidade">${VG.esc(m.unidade || '—')}</td>
            <td data-label="Valor" style="text-align:right" class="mat-cad-val">${dinheiro(m.valor)}</td>
            <td data-label="Valor venda" style="text-align:right" class="mat-cad-val">${dinheiro(m.valorVenda)}</td>
            <td data-label="Status">${m.ativo !== false ? '<span class="badge badge--green"><i></i>Ativo</span>' : '<span class="badge badge--gray"><i></i>Inativo</span>'}</td>
            <td data-label="" class="row-actions-cell"><div class="row-actions">
              <button class="btn btn-ghost btn-icon" data-act="edit" title="Editar" aria-label="Editar">${VG.icon('edit')}</button>
              <button class="btn btn-ghost btn-icon" data-act="del" title="Excluir" aria-label="Excluir">${VG.icon('trash')}</button>
            </div></td>
          </tr>`).join('')}</tbody>
      </table></div>
      <div class="table-foot"><span>Mostrando ${pagina.length} de ${lista.length}${lista.length !== total ? ` (${total} no total)` : ''} materiais</span>
        ${lista.length > pagina.length ? `<button class="btn btn-sm" id="mc-mais">${VG.icon('plus')}<span>Mostrar mais ${Math.min(100, lista.length - pagina.length)}</span></button>` : ''}</div>`;
    const mais = VG.$('#mc-mais', box); if (mais) mais.onclick = () => { state.limite += 100; table(el); };
    box.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.querySelector('[data-act=edit]').onclick = () => form(tr.dataset.id, redraw);
      tr.querySelector('[data-act=del]').onclick = () => excluir(tr.dataset.id, redraw);
    });
  }

  /* ---------- novo / editar ---------- */
  function form(id, done) {
    const m = id ? S().get('materiais', id) : { ativo: true, unidade: VG.UNIDADES[0] };
    if (!m) return;
    const unidades = VG.UNIDADES.includes(m.unidade) || !m.unidade ? VG.UNIDADES : VG.UNIDADES.concat(m.unidade);
    VG.modal({
      title: id ? 'Editar material' : 'Novo material', size: 'lg',
      body: `
        <form id="mf" class="grid grid-4" novalidate>
          <div class="field"><label for="mf-codigo">Código<span class="req">*</span></label><input id="mf-codigo" class="input" value="${VG.esc(m.codigo || '')}" autocomplete="off" autocapitalize="characters"></div>
          <div class="field span-3"><label for="mf-descricao">Material<span class="req">*</span></label><input id="mf-descricao" class="input" value="${VG.esc(m.descricao || '')}" autocomplete="off"></div>
          <div class="field span-2"><label for="mf-marca">Marca</label><input id="mf-marca" class="input" value="${VG.esc(m.marca || '')}" list="mf-marcas" autocomplete="off"><datalist id="mf-marcas">${marcas().map((x) => `<option value="${VG.esc(x)}">`).join('')}</datalist></div>
          <div class="field span-2"><label for="mf-unidade">Unidade</label><select id="mf-unidade" class="select">${VG.options(unidades, m.unidade || VG.UNIDADES[0])}</select></div>
          <div class="field span-2"><label for="mf-valor">Valor (R$)</label><input id="mf-valor" class="input" inputmode="decimal" placeholder="0,00" value="${VG.esc(paraCampo(m.valor))}"></div>
          <div class="field span-2"><label for="mf-venda">Valor de venda (R$)</label><input id="mf-venda" class="input" inputmode="decimal" placeholder="0,00" value="${VG.esc(paraCampo(m.valorVenda))}"></div>
          <label class="check span-all"><input type="checkbox" id="mf-ativo" ${m.ativo !== false ? 'checked' : ''}> Material ativo (aparece na busca da OS)</label>
        </form>`,
      actions: [
        { label: 'Cancelar' },
        { label: id ? 'Salvar alterações' : 'Cadastrar material', cls: 'btn-primary', icon: 'check', onClick: (md) => {
          const v = (n) => md.el.querySelector('#mf-' + n);
          md.el.querySelectorAll('.field').forEach((x) => x.classList.remove('invalid'));
          const bad = (n, msg) => { v(n).closest('.field').classList.add('invalid'); v(n).focus(); VG.toast(msg, 'warn', 5000); return false; };
          const codigo = limparCodigo(v('codigo').value), descricao = v('descricao').value.replace(/\s+/g, ' ').trim();
          if (!codigo) return bad('codigo', 'Informe o código do material.');
          if (!descricao) return bad('descricao', 'Informe o nome do material.');
          const dup = todos().find((x) => x.id !== id && VG.norm(x.codigo) === VG.norm(codigo));
          if (dup) return bad('codigo', `O código ${dup.codigo} já é do material ${dup.descricao}.`);
          const valor = lerNumero(v('valor').value), valorVenda = lerNumero(v('venda').value);
          if (Number.isNaN(valor)) return bad('valor', 'Valor inválido. Use, por exemplo, 14,98.');
          if (Number.isNaN(valorVenda)) return bad('venda', 'Valor de venda inválido. Use, por exemplo, 26,96.');
          const obj = Object.assign({}, id ? m : { criadoEm: VG.nowISO() }, {
            codigo, descricao, marca: v('marca').value.trim(), unidade: v('unidade').value, valor, valorVenda, ativo: v('ativo').checked,
          });
          S().save('materiais', obj);
          if (!id) S().log(`Material ${obj.codigo} ${obj.descricao} cadastrado`, null, 'box');
          VG.toast(id ? 'Material atualizado.' : 'Material cadastrado.', 'success');
          done && done();
        } },
      ],
    });
  }

  /** Material já usado em alguma OS (separado ou utilizado)? */
  function usadoEmOS(m) {
    const k = VG.norm(m.codigo);
    return S().list('ordens').some((o) => [].concat(o.materiaisLevar || [], (o.atendimento && o.atendimento.materiais) || []).some((x) => x && VG.norm(x.codigo) === k));
  }

  async function excluir(id, done) {
    const m = S().get('materiais', id);
    if (!m) return;
    if (usadoEmOS(m)) {
      if (m.ativo === false) { VG.toast('Este material já está inativo. Ele foi usado em OS e fica guardado no histórico.', 'info', 5000); return; }
      if (!(await VG.confirm(`${m.descricao} já foi usado em OS e não pode ser excluído. Deseja marcar como inativo? Ele sai da busca, mas continua no histórico.`, { title: 'Material usado em OS', ok: 'Marcar como inativo' }))) return;
      m.ativo = false;
      S().save('materiais', m);
      VG.toast('Material marcado como inativo.', 'success');
    } else {
      if (!(await VG.confirm(`Excluir o material ${m.codigo} — ${m.descricao}? Esta ação não pode ser desfeita.`, { title: 'Excluir material', ok: 'Excluir', danger: true }))) return;
      S().remove('materiais', id);
      VG.toast('Material excluído.', 'success');
    }
    done && done();
  }

  /* ---------- exportar ---------- */
  function exportar() {
    const num = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));
    const lista = todos().slice().sort((a, b) => String(a.descricao).localeCompare(String(b.descricao), 'pt-BR', { numeric: true }));
    const csv = VG.CSV.gerar([
      { label: 'codigo', get: (m) => m.codigo }, { label: 'material', get: (m) => m.descricao }, { label: 'marca', get: (m) => m.marca || '' },
      { label: 'unidade', get: (m) => m.unidade || '' }, { label: 'valor', get: (m) => num(m.valor) }, { label: 'valor_venda', get: (m) => num(m.valorVenda) },
      { label: 'ativo', get: (m) => (m.ativo !== false ? 'sim' : 'não') },
    ], lista);
    VG.download(`materiais_vegas_${VG.toInputDate()}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function baixarModelo() {
    const linhas = ['codigo;material;marca;unidade;valor;valor_venda', '1110;ABRAÇADEIRA;MARCA GERAL;UN;14,98;26,96', '2050;CABO UTP CAT5E;INTELBRAS;MT;1,35;2,43'];
    VG.download('modelo_materiais_vegas.csv', '\uFEFF' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
  }

  /* ---------- importar / atualizar por CSV ---------- */
  const ALIASES = {
    codigo: ['codigo', 'cod', 'codproduto', 'codigoproduto', 'codigodoproduto', 'referencia', 'ref', 'sku', 'idproduto', 'codmaterial', 'codigomaterial'],
    descricao: ['descricao', 'material', 'produto', 'nome', 'descricaoproduto', 'descricaodoproduto', 'nomedoproduto', 'item', 'nomematerial'],
    marca: ['marca', 'codmarca', 'fabricante', 'nomemarca'],
    unidade: ['unidade', 'un', 'und', 'unid', 'medida', 'unidademedida', 'unidadedemedida'],
    valor: ['valor', 'custo', 'valorcusto', 'precocusto', 'preco', 'valorunitario', 'vlcusto', 'valorcompra', 'precocompra', 'vlunitario'],
    valorVenda: ['valorvenda', 'valordevenda', 'precovenda', 'precodevenda', 'venda', 'vlvenda'],
  };
  const chaveCab = (h) => VG.norm(h).replace(/[^a-z0-9]/g, '');

  function analisar(text) {
    const rows = VG.CSV.parse(text);
    if (rows.length < 2) return { erroGeral: 'O arquivo está vazio ou só tem o cabeçalho.' };
    // o cabeçalho pode não estar na 1ª linha (planilhas com título em cima): procura nas 10 primeiras
    let hi = -1, map = null;
    for (let i = 0; i < Math.min(10, rows.length) && hi < 0; i++) {
      const cab = rows[i].map(chaveCab);
      const mm = {};
      Object.keys(ALIASES).forEach((k) => { const j = cab.findIndex((h) => ALIASES[k].includes(h)); if (j >= 0) mm[k] = j; });
      if (mm.codigo != null && mm.descricao != null) { hi = i; map = mm; }
    }
    if (hi < 0) return { erroGeral: 'Não encontramos as colunas de código e material no cabeçalho. Use, por exemplo: codigo; material; marca; unidade; valor; valor_venda (ou CodProduto; Descrição; CodMarca; Unidade; Valor; Valor venda).' };

    const corpo = rows.slice(hi + 1);
    const cel = (r, k) => (map[k] != null ? String(r[map[k]] == null ? '' : r[map[k]]).trim() : '');
    // decimal com vírgula (padrão brasileiro) se algum valor do arquivo tiver vírgula
    const virgula = corpo.some((r) => /,/.test(cel(r, 'valor')) || /,/.test(cel(r, 'valorVenda')));
    const porCod = {};
    todos().forEach((m) => (porCod[VG.norm(m.codigo)] = m));
    const vistos = new Set();

    const registros = corpo.map((r, i) => {
      const d = {
        codigo: limparCodigo(cel(r, 'codigo')), descricao: cel(r, 'descricao').replace(/\s+/g, ' '),
        marca: cel(r, 'marca'), unidade: VG.unidadeDe(cel(r, 'unidade')),
        valor: lerNumero(cel(r, 'valor'), virgula), valorVenda: lerNumero(cel(r, 'valorVenda'), virgula),
      };
      const erros = [];
      if (!d.codigo) erros.push('Código em branco');
      if (!d.descricao) erros.push('Material em branco');
      if (Number.isNaN(d.valor)) erros.push(`Valor inválido (${cel(r, 'valor')})`);
      if (Number.isNaN(d.valorVenda)) erros.push(`Valor de venda inválido (${cel(r, 'valorVenda')})`);
      const k = VG.norm(d.codigo);
      let situacao, antes = null;
      if (erros.length) situacao = 'erro';
      else if (vistos.has(k)) { situacao = 'repetido'; erros.push('Código repetido no arquivo: vale a primeira linha'); }
      else {
        vistos.add(k);
        antes = porCod[k] || null;
        if (!antes) situacao = 'novo';
        else {
          const mudou = antes.descricao !== d.descricao || (d.marca && antes.marca !== d.marca) || (d.unidade && antes.unidade !== d.unidade)
            || (d.valor != null && !igualNum(antes.valor, d.valor)) || (d.valorVenda != null && !igualNum(antes.valorVenda, d.valorVenda)) || antes.ativo === false;
          situacao = mudou ? 'atualizado' : 'igual';
        }
      }
      return { linha: hi + i + 2, dados: d, antes, erros, situacao };
    });
    const conta = (s) => registros.filter((x) => x.situacao === s).length;
    const ausentes = todos().filter((m) => m.ativo !== false && !vistos.has(VG.norm(m.codigo))).length;
    return { registros, total: registros.length, novos: conta('novo'), atualizados: conta('atualizado'), iguais: conta('igual'), erros: conta('erro') + conta('repetido'), ausentes, virgula };
  }

  function importar(done) {
    let analise = null;
    const modal = VG.modal({
      title: 'Importar / atualizar materiais (CSV)', size: 'xl',
      body: `
        <div>
          <label class="csv-drop" id="mci-drop" for="mci-file">
            <span class="empty__icon">${VG.icon('sheet')}</span>
            <strong>Selecione ou arraste a lista .csv</strong>
            <span class="muted" style="font-size:.85rem">Colunas: código, material, marca, unidade, valor, valor de venda</span>
            <input type="file" id="mci-file" accept=".csv,text/csv" class="sr-only">
          </label>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-top:1rem;flex-wrap:wrap">
            <span class="hint">O <b>código</b> é a chave: código que já existe tem nome, marca, unidade e valores atualizados; código novo é incluído. Aceita vírgula ou ponto e vírgula e o cabeçalho da planilha de estoque (CodProduto, Descrição, CodMarca, Unidade, Valor, Valor venda).</span>
            <button type="button" class="btn btn-sm" id="mci-model">${VG.icon('download')}<span>Baixar modelo CSV</span></button>
          </div>
        </div>
        <div id="mci-res" class="hidden"></div>`,
      actions: [
        { label: 'Cancelar' },
        { label: 'Confirmar', cls: 'btn-primary', icon: 'check', onClick: async (md) => {
          if (!analise) return false;
          const validos = analise.registros.filter((r) => ['novo', 'atualizado', 'igual'].includes(r.situacao)).map((r) => r.dados);
          const desativar = !!(md.el.querySelector('#mci-desat') || {}).checked;
          if (!analise.novos && !analise.atualizados && !(desativar && analise.ausentes)) { VG.toast('A lista já está igual ao arquivo. Nada para atualizar.', 'info'); return false; }
          const btn = md.el.querySelector('.modal__foot .btn-primary');
          VG.setBusy(btn, true, 'Atualizando a lista…');
          try {
            const r = await S().importMateriais(validos, desativar);
            VG.toast(`Lista de materiais atualizada: ${r.inseridos} novos, ${r.atualizados} atualizados${r.desativados ? `, ${r.desativados} desativados` : ''}.`, 'success', 6000);
            done && done();
            return true;
          } catch (e) {
            VG.setBusy(btn, false);
            VG.toast('Não foi possível atualizar a lista: ' + e.message, 'error', 8000);
            return false;
          }
        } },
      ],
    });
    const m = modal.el;
    const confirmar = m.querySelector('.modal__foot .btn-primary');
    confirmar.disabled = true;
    m.querySelector('#mci-model').onclick = baixarModelo;
    const input = m.querySelector('#mci-file'), drop = m.querySelector('#mci-drop');

    const SIT = {
      novo: '<span class="badge badge--blue"><i></i>Novo</span>', atualizado: '<span class="badge badge--orange"><i></i>Atualizar</span>',
      igual: '<span class="badge badge--gray"><i></i>Sem mudança</span>', erro: '<span class="badge badge--red"><i></i>Erro</span>', repetido: '<span class="badge badge--yellow"><i></i>Repetido</span>',
    };
    const valCel = (novo, velho, existe) => {
      if (novo == null) return '<span class="faint">mantém</span>';
      if (!existe || igualNum(novo, velho)) return VG.esc(VG.fmtMoney(novo));
      return `<span class="mat-cad-diff">${velho == null ? '—' : VG.esc(VG.fmtMoney(velho))} → <b>${VG.esc(VG.fmtMoney(novo))}</b></span>`;
    };

    const processar = async (file) => {
      if (!file) return;
      if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text/.test(file.type)) { VG.toast('Selecione um arquivo .csv. No Excel: Arquivo → Salvar como → CSV.', 'warn', 6000); return; }
      const res = m.querySelector('#mci-res');
      res.classList.remove('hidden'); res.innerHTML = VG.loading('Lendo arquivo…');
      try { analise = analisar(await VG.CSV.lerArquivo(file)); } catch (e) { analise = { erroGeral: e.message }; }
      if (analise.erroGeral) {
        res.innerHTML = `<div class="notice" style="margin-top:1rem">${VG.icon('alert')}<div>${VG.esc(analise.erroGeral)}</div></div>`;
        analise = null; confirmar.disabled = true; return;
      }
      const a = analise;
      // primeiro o que muda (novos, atualizações, erros); depois o resto
      const ordem = { erro: 0, repetido: 1, novo: 2, atualizado: 3, igual: 4 };
      const mostrar = a.registros.slice().sort((x, y) => ordem[x.situacao] - ordem[y.situacao] || x.linha - y.linha).slice(0, 400);
      res.innerHTML = `
        <hr class="divider">
        <p style="margin:0 0 .8rem"><strong>${VG.esc(file.name)}</strong> <span class="faint">· ${a.total} linhas · decimal com ${a.virgula ? 'vírgula' : 'ponto'}</span></p>
        <div class="csv-summary csv-summary--4">
          <div><b style="color:var(--st-blue)">${a.novos}</b><span>${a.novos === 1 ? 'material novo' : 'materiais novos'}</span></div>
          <div><b style="color:var(--st-orange)">${a.atualizados}</b><span>${a.atualizados === 1 ? 'material atualizado' : 'materiais atualizados'}</span></div>
          <div><b>${a.iguais}</b><span>sem mudança</span></div>
          <div><b style="color:${a.erros ? 'var(--st-red)' : 'inherit'}">${a.erros}</b><span>${a.erros === 1 ? 'linha ignorada' : 'linhas ignoradas'}</span></div>
        </div>
        ${a.ausentes ? `<div class="mat-cad-opt"><label class="check"><input type="checkbox" id="mci-desat"><span>Desativar ${a.ausentes === 1 ? 'o <b>1</b> material cadastrado que não está' : `os <b>${a.ausentes}</b> materiais cadastrados que não estão`} neste arquivo</span></label>
          <span class="hint">Eles saem da busca da OS, mas não são apagados. Deixe desmarcado para manter tudo como está.</span></div>` : ''}
        <div class="csv-preview" style="margin-top:1rem"><table class="table"><thead><tr><th>Linha</th><th>Situação</th><th>Código</th><th>Material</th><th>Unidade</th><th style="text-align:right">Valor</th><th style="text-align:right">Valor venda</th><th>Observação</th></tr></thead><tbody>
          ${mostrar.map((r) => `<tr class="${r.situacao === 'erro' ? 'row-err' : r.situacao === 'repetido' ? 'row-dup' : ''}">
            <td class="num">${r.linha}</td><td>${SIT[r.situacao]}</td><td class="num">${VG.esc(r.dados.codigo || '—')}</td>
            <td>${VG.esc(r.dados.descricao || '—')}${r.antes && r.antes.descricao !== r.dados.descricao ? `<span class="sub faint">antes: ${VG.esc(r.antes.descricao)}</span>` : ''}</td>
            <td>${VG.esc(r.dados.unidade || '—')}</td>
            <td style="text-align:right">${Number.isNaN(r.dados.valor) ? '—' : valCel(r.dados.valor, r.antes && r.antes.valor, !!r.antes)}</td>
            <td style="text-align:right">${Number.isNaN(r.dados.valorVenda) ? '—' : valCel(r.dados.valorVenda, r.antes && r.antes.valorVenda, !!r.antes)}</td>
            <td class="faint">${VG.esc(r.erros.join(', '))}</td></tr>`).join('')}
        </tbody></table></div>
        ${a.registros.length > mostrar.length ? `<p class="hint">Mostrando ${mostrar.length} de ${a.registros.length} linhas (primeiro as que mudam).</p>` : ''}`;
      const atualizarBotao = () => {
        const desat = !!(m.querySelector('#mci-desat') || {}).checked;
        const n = a.novos + a.atualizados;
        confirmar.disabled = !n && !(desat && a.ausentes);
        confirmar.querySelector('span').textContent = n || desat
          ? `Atualizar lista${a.novos ? ` · ${a.novos} novos` : ''}${a.atualizados ? ` · ${a.atualizados} alterados` : ''}${desat && a.ausentes ? ` · ${a.ausentes} desativados` : ''}`
          : 'Nada para atualizar';
      };
      const chk = m.querySelector('#mci-desat'); if (chk) chk.onchange = atualizarBotao;
      atualizarBotao();
    };
    input.onchange = () => processar(input.files[0]);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => processar(e.dataTransfer.files[0]));
  }

  VG.Materiais = { render, form, importar, lerNumero };
})();
