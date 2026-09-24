/* =========================================================
   VEGAS OS — CLIENTES
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;

  let state = { q: '', status: '' };

  function nextCodigo() {
    const nums = S().list('clientes').map((c) => parseInt(String(c.codigo || '').replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
    return 'C' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
  }

  function filtrados() {
    const q = VG.norm(state.q), qd = VG.digits(state.q);
    return S().list('clientes')
      .filter((c) => !state.status || (c.status || 'ativo') === state.status)
      .filter((c) => !q || VG.norm([c.codigo, c.nome, c.email, c.cidade, c.bairro, c.endereco, c.cpf_cnpj ? '' : 'sem documento'].join(' ')).includes(q) || (qd.length >= 3 && (VG.digits(c.cpf_cnpj).includes(qd) || VG.digits(c.telefone).includes(qd))))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function render(el) {
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div><h1>Clientes</h1><p>Cadastre, importe e consulte os clientes atendidos.</p></div>
          <div class="page-head__actions">
            <button class="btn" id="cl-import">${VG.icon('upload')}<span>Importar clientes CSV</span></button>
            <button class="btn btn-primary" id="cl-new">${VG.icon('plus')}<span>Novo cliente</span></button>
          </div>
        </div>
        <section class="panel">
          <div class="toolbar">
            <div class="field field--search"><label for="cl-q">Pesquisar</label>
              <div class="input-group">${VG.icon('search')}<input id="cl-q" class="input" placeholder="Nome, código, CPF/CNPJ, telefone ou cidade" value="${VG.esc(state.q)}"></div></div>
            <div class="field"><label for="cl-st">Status</label>
              <select id="cl-st" class="select"><option value="">Todos</option><option value="ativo" ${state.status === 'ativo' ? 'selected' : ''}>Ativos</option><option value="inativo" ${state.status === 'inativo' ? 'selected' : ''}>Inativos</option></select></div>
          </div>
          <div id="cl-table"></div>
        </section>
      </div>`;
    VG.$('#cl-new', el).onclick = () => form(null, () => table(el));
    VG.$('#cl-import', el).onclick = () => importar(() => table(el));
    VG.$('#cl-q', el).addEventListener('input', VG.debounce((e) => { state.q = e.target.value; state.limite = 100; table(el); }, 200));
    VG.$('#cl-st', el).onchange = (e) => { state.status = e.target.value; table(el); };
    table(el);
  }

  function table(el) {
    const box = VG.$('#cl-table', el);
    const todos = filtrados();
    const limite = state.limite || 100;
    const list = todos.slice(0, limite);
    const total = S().list('clientes').length;
    if (!list.length) {
      box.innerHTML = total
        ? VG.empty('search', 'Nenhum cliente encontrado', 'Ajuste a pesquisa ou o filtro de status.')
        : VG.empty('users', 'Nenhum cliente cadastrado', 'Cadastre o primeiro cliente ou importe uma planilha CSV.', `<button class="btn btn-primary" data-act="new">${VG.icon('plus')}<span>Novo cliente</span></button>`);
      const b = box.querySelector('[data-act=new]'); if (b) b.onclick = () => form(null, () => table(el));
      return;
    }
    box.innerHTML = `
      <div class="table-wrap"><table class="table table--cards">
        <thead><tr><th>Código</th><th>Nome / Razão social</th><th>CPF/CNPJ</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th>Status</th><th style="text-align:right">Ações</th></tr></thead>
        <tbody>${list.map((c) => `
          <tr data-id="${c.id}">
            <td data-label="Código" class="num">${VG.esc(c.codigo)}</td>
            <td data-label="Nome"><span class="strong">${VG.esc(c.nome)}</span><span class="sub">${VG.esc([[c.endereco, c.numero].filter(Boolean).join(', '), c.bairro].filter(Boolean).join(' · '))}</span></td>
            <td data-label="CPF/CNPJ">${c.cpf_cnpj ? VG.esc(VG.fmtDoc(c.cpf_cnpj)) : '<span class="badge badge--yellow"><i></i>Sem documento</span>'}</td>
            <td data-label="Telefone">${VG.esc(VG.fmtPhone(c.telefone))}</td>
            <td data-label="E-mail">${VG.esc(c.email || '—')}</td>
            <td data-label="Cidade">${VG.esc([c.cidade, c.estado].filter(Boolean).join(' - ') || '—')}</td>
            <td data-label="Status">${(c.status || 'ativo') === 'ativo' ? '<span class="badge badge--green"><i></i>Ativo</span>' : '<span class="badge badge--gray"><i></i>Inativo</span>'}</td>
            <td data-label="" class="row-actions-cell"><div class="row-actions">
              <button class="btn btn-ghost btn-icon" data-act="view" title="Visualizar" aria-label="Visualizar">${VG.icon('eye')}</button>
              <button class="btn btn-ghost btn-icon" data-act="edit" title="Editar" aria-label="Editar">${VG.icon('edit')}</button>
              <button class="btn btn-ghost btn-icon" data-act="del" title="Excluir" aria-label="Excluir">${VG.icon('trash')}</button>
            </div></td>
          </tr>`).join('')}</tbody>
      </table></div>
      <div class="table-foot"><span>Mostrando ${list.length} de ${todos.length}${todos.length !== total ? ` (${total} no total)` : ''} clientes</span>
        ${todos.length > list.length ? `<button class="btn btn-sm" id="cl-mais">${VG.icon('plus')}<span>Mostrar mais ${Math.min(100, todos.length - list.length)}</span></button>` : ''}</div>`;
    const mais = VG.$('#cl-mais', box); if (mais) mais.onclick = () => { state.limite = limite + 100; table(el); };
    box.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelector('[data-act=view]').onclick = () => ver(id);
      tr.querySelector('[data-act=edit]').onclick = () => form(id, () => table(el));
      tr.querySelector('[data-act=del]').onclick = () => excluir(id, () => table(el));
    });
  }

  function ver(id) {
    const c = S().get('clientes', id);
    if (!c) return;
    const ordens = S().list('ordens').filter((o) => o.clienteId === id).sort((a, b) => b.numero - a.numero);
    VG.modal({
      title: c.nome, size: 'lg',
      body: `
        <div class="kv">
          ${VG.kv('Código', c.codigo)}${VG.kv('CPF/CNPJ', VG.fmtDoc(c.cpf_cnpj))}
          ${VG.kv('Telefone', c.telefone ? `<a href="tel:${VG.digits(c.telefone)}">${VG.esc(VG.fmtPhone(c.telefone))}</a>` : '', true)}
          ${VG.kv('E-mail', c.email ? `<a href="mailto:${VG.esc(c.email)}">${VG.esc(c.email)}</a>` : '', true)}
          <div class="kv__item span-all" style="grid-column:1/-1">${'<div class="kv__k">Endereço</div><div class="kv__v">' + VG.esc(VG.enderecoCompleto(c) || '—') + '</div>'}</div>
        </div>
        <hr class="divider">
        <h4 style="margin-bottom:.6rem;font-size:.95rem">Ordens de serviço (${ordens.length})</h4>
        ${ordens.length ? `<div class="table-wrap"><table class="table"><tbody>${ordens.map((o) => `
          <tr class="clickable" data-os="${o.id}"><td class="num">#${o.numero}</td><td>${VG.esc(o.tipo)}</td><td>${VG.fmtDate(o.criadaEm)}</td><td>${VG.badge(o.status)}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="muted" style="margin:0">Nenhuma OS para este cliente.</p>'}`,
      actions: [
        { label: 'Fechar' },
        ...(VG.Auth.can('os.criar') ? [{ label: 'Nova OS para este cliente', cls: 'btn-primary', icon: 'plus', onClick: () => { location.hash = `#/os/nova?cliente=${c.id}`; } }] : []),
      ],
      onOpen: (m, api) => m.querySelectorAll('[data-os]').forEach((tr) => (tr.onclick = () => { api.close(); location.hash = '#/os/ver/' + tr.dataset.os; })),
    });
  }

  /** Formulário de cliente (novo/editar). onSaved(cliente) */
  function form(id, onSaved) {
    const c = id ? S().get('clientes', id) : { codigo: nextCodigo(), status: 'ativo' };
    const f = (name, label, opts = {}) => `
      <div class="field ${opts.cls || ''}"><label for="cf-${name}">${label}${opts.req ? '<span class="req">*</span>' : ''}</label>
      <input id="cf-${name}" name="${name}" class="input" value="${VG.esc(opts.value != null ? opts.value : c[name] || '')}" ${opts.attrs || ''}></div>`;
    VG.modal({
      title: id ? 'Editar cliente' : 'Novo cliente', size: 'lg',
      body: `
        <form id="cf" class="grid grid-4" novalidate>
          ${f('codigo', 'Código', {})}
          ${f('nome', 'Nome / Razão social', { req: true, cls: 'span-3', attrs: 'autocomplete="organization"' })}
          ${f('cpf_cnpj', 'CPF/CNPJ', { value: VG.fmtDoc(c.cpf_cnpj), attrs: 'data-mask="doc" inputmode="numeric"' })}
          ${f('telefone', 'Telefone', { value: VG.fmtPhone(c.telefone), attrs: 'data-mask="phone" inputmode="tel"' })}
          ${f('email', 'E-mail', { cls: 'span-2', attrs: 'type="email" inputmode="email"' })}
          ${f('cep', 'CEP', { value: VG.fmtCEP(c.cep), attrs: 'data-mask="cep" inputmode="numeric" placeholder="Preenche o endereço"' })}
          ${f('endereco', 'Endereço', { cls: 'span-2' })}
          ${f('numero', 'Número')}
          ${f('complemento', 'Complemento')}
          ${f('bairro', 'Bairro')}
          ${f('cidade', 'Cidade')}
          ${f('estado', 'UF', { attrs: 'maxlength="2" style="text-transform:uppercase"' })}
          <div class="field"><label for="cf-status">Status</label>
            <select id="cf-status" name="status" class="select"><option value="ativo">Ativo</option><option value="inativo" ${c.status === 'inativo' ? 'selected' : ''}>Inativo</option></select></div>
        </form>`,
      onOpen: (m) => {
        VG.bindMasks(m);
        const cep = m.querySelector('#cf-cep');
        cep.addEventListener('blur', async () => {
          const d = VG.digits(cep.value);
          if (d.length !== 8 || m.querySelector('#cf-endereco').value) return;
          try {
            const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
            const j = await r.json();
            if (j.erro) return;
            m.querySelector('#cf-endereco').value = j.logradouro || '';
            m.querySelector('#cf-bairro').value = j.bairro || '';
            m.querySelector('#cf-cidade').value = j.localidade || '';
            m.querySelector('#cf-estado').value = j.uf || '';
            m.querySelector('#cf-numero').focus();
          } catch (e) { /* sem internet: preenchimento manual */ }
        });
      },
      actions: [
        { label: 'Cancelar' },
        { label: id ? 'Salvar alterações' : 'Cadastrar cliente', cls: 'btn-primary', icon: 'check', onClick: (m) => {
          const fd = Object.fromEntries(new FormData(m.el.querySelector('#cf')));
          m.el.querySelectorAll('.field').forEach((x) => x.classList.remove('invalid'));
          const bad = (n) => { m.el.querySelector(`#cf-${n}`).closest('.field').classList.add('invalid'); };
          const doc = VG.digits(fd.cpf_cnpj);
          if (!fd.nome.trim()) { bad('nome'); VG.toast('Informe o nome ou razão social.', 'warn'); return false; }
          if (doc && !VG.validDoc(doc)) { bad('cpf_cnpj'); VG.toast('CPF/CNPJ inválido. Confira os números ou deixe em branco para completar depois.', 'warn', 5000); return false; }
          // o mesmo CPF/CNPJ pode ter várias unidades; só bloqueia se o endereço também for igual
          const k = VG.CSV.chave({ cpf_cnpj: doc, nome: fd.nome, endereco: fd.endereco, numero: fd.numero });
          const dup = S().list('clientes').find((x) => x.id !== id && VG.CSV.chave(x) === k);
          if (dup) { bad('cpf_cnpj'); VG.toast(`Já existe o cadastro ${dup.nome} (${dup.codigo}) com este ${doc ? 'CPF/CNPJ' : 'nome'} neste endereço.`, 'warn', 5000); return false; }
          if (fd.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fd.email)) { bad('email'); VG.toast('E-mail inválido.', 'warn'); return false; }
          const obj = Object.assign({}, id ? c : { criadoEm: VG.nowISO() }, {
            codigo: fd.codigo.trim() || nextCodigo(), nome: fd.nome.trim(), cpf_cnpj: doc, telefone: VG.digits(fd.telefone), email: fd.email.trim(),
            cep: VG.digits(fd.cep), endereco: fd.endereco.trim(), numero: fd.numero.trim(), complemento: fd.complemento.trim(),
            bairro: fd.bairro.trim(), cidade: fd.cidade.trim(), estado: fd.estado.trim().toUpperCase(), status: fd.status,
          });
          S().save('clientes', obj);
          if (!id) S().log(`Cliente ${obj.nome} cadastrado`, null, 'users');
          VG.toast(id ? 'Cliente atualizado.' : 'Cliente cadastrado.', 'success');
          onSaved && onSaved(obj);
        } },
      ],
    });
  }

  async function excluir(id, done) {
    const c = S().get('clientes', id);
    if (!c) return;
    const qtd = S().list('ordens').filter((o) => o.clienteId === id).length;
    if (qtd) {
      const ok = await VG.confirm(`${c.nome} possui ${qtd} OS no histórico e não pode ser excluído. Deseja marcar como inativo?`, { title: 'Cliente com OS', ok: 'Marcar como inativo' });
      if (!ok) return;
      c.status = 'inativo'; S().save('clientes', c);
      VG.toast('Cliente marcado como inativo.', 'success');
    } else {
      const ok = await VG.confirm(`Excluir o cliente ${c.nome}? Esta ação não pode ser desfeita.`, { title: 'Excluir cliente', ok: 'Excluir', danger: true });
      if (!ok) return;
      S().remove('clientes', id);
      VG.toast('Cliente excluído.', 'success');
    }
    done && done();
  }

  /* ---------- IMPORTAÇÃO CSV ---------- */
  function importar(done) {
    let analise = null;
    const modal = VG.modal({
      title: 'Importar clientes CSV', size: 'xl',
      body: `
        <div id="csv-step1">
          <label class="csv-drop" id="csv-drop" for="csv-file">
            <span class="empty__icon">${VG.icon('sheet')}</span>
            <strong>Selecione ou arraste um arquivo .csv</strong>
            <span class="muted" style="font-size:.85rem">Colunas: ${VG.CSV.COLUNAS.join(', ')}</span>
            <input type="file" id="csv-file" accept=".csv,text/csv" class="sr-only">
          </label>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-top:1rem;flex-wrap:wrap">
            <span class="hint">Aceita vírgula ou ponto e vírgula. O mesmo CPF/CNPJ pode ter várias unidades; só é ignorado quando o endereço também é igual. Sem CPF/CNPJ entra com aviso para completar depois.</span>
            <button type="button" class="btn btn-sm" id="csv-model">${VG.icon('download')}<span>Baixar modelo CSV</span></button>
          </div>
        </div>
        <div id="csv-step2" class="hidden"></div>`,
      actions: [
        { label: 'Cancelar' },
        { label: 'Confirmar importação', cls: 'btn-primary', icon: 'check', onClick: () => {
          if (!analise || !analise.validos) { VG.toast('Selecione um arquivo com registros válidos.', 'warn'); return false; }
          let seq = parseInt(nextCodigo().slice(1), 10);
          const codigos = new Set(S().list('clientes').map((c) => c.codigo));
          const novos = analise.registros.filter((r) => r.situacao === 'ok').map((r) => {
            const d = r.dados;
            let codigo = d.codigo && !codigos.has(d.codigo) ? d.codigo : null;
            if (!codigo) { codigo = 'C' + String(seq++).padStart(4, '0'); }
            codigos.add(codigo);
            return { ...d, codigo, status: 'ativo', criadoEm: VG.nowISO() };
          });
          try { S().saveMany('clientes', novos); } catch (e) { return false; }
          S().log(`${novos.length} clientes importados via CSV`, null, 'users');
          VG.toast(`${novos.length} clientes importados com sucesso.`, 'success');
          done && done();
        } },
      ],
    });
    const m = modal.el;
    const confirmBtn = m.querySelector('.modal__foot .btn-primary');
    confirmBtn.disabled = true;
    m.querySelector('#csv-model').onclick = VG.CSV.baixarModelo;
    const input = m.querySelector('#csv-file');
    const drop = m.querySelector('#csv-drop');

    const processar = async (file) => {
      if (!file) return;
      if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') { VG.toast('Selecione um arquivo com extensão .csv.', 'warn'); return; }
      const step2 = m.querySelector('#csv-step2');
      step2.classList.remove('hidden'); step2.innerHTML = VG.loading('Lendo arquivo…');
      try {
        const text = await VG.CSV.lerArquivo(file);
        analise = VG.CSV.analisar(text, S().list('clientes'));
      } catch (e) { analise = { erroGeral: e.message }; }
      if (analise.erroGeral) {
        step2.innerHTML = `<div class="notice" style="margin-top:1rem">${VG.icon('alert')}<div>${VG.esc(analise.erroGeral)}</div></div>`;
        confirmBtn.disabled = true; analise = null; return;
      }
      const sit = { ok: '<span class="badge badge--green"><i></i>Pronto</span>', erro: '<span class="badge badge--red"><i></i>Erro</span>', duplicado: '<span class="badge badge--yellow"><i></i>Duplicado</span>' };
      step2.innerHTML = `
        <hr class="divider">
        <p style="margin:0 0 .8rem"><strong>${VG.esc(file.name)}</strong></p>
        <div class="csv-summary">
          <div><b>${analise.total}</b><span>${analise.total === 1 ? 'cliente encontrado' : 'clientes encontrados'}</span></div>
          <div><b style="color:var(--st-green)">${analise.validos}</b><span>${analise.validos === 1 ? 'cliente pronto' : 'clientes prontos'} para importação</span></div>
          <div><b style="color:${analise.problemas ? 'var(--st-red)' : 'inherit'}">${analise.problemas}</b><span>${analise.problemas === 1 ? 'registro possui' : 'registros possuem'} problemas</span></div>
        </div>
        <div class="csv-preview"><table class="table"><thead><tr><th>Linha</th><th>Situação</th><th>Nome</th><th>CPF/CNPJ</th><th>Telefone</th><th>Cidade</th><th>Observação</th></tr></thead><tbody>
          ${analise.registros.slice(0, 500).map((r) => `<tr class="${r.situacao === 'erro' ? 'row-err' : r.situacao === 'duplicado' ? 'row-dup' : ''}">
            <td class="num">${r.linha}</td><td>${sit[r.situacao]}</td><td>${VG.esc(r.dados.nome || '—')}</td><td>${VG.esc(VG.fmtDoc(r.dados.cpf_cnpj) || 'sem documento')}</td>
            <td>${VG.esc(VG.fmtPhone(r.dados.telefone) || '—')}</td><td>${VG.esc(r.dados.cidade || '—')}</td><td class="faint">${VG.esc(r.erros.join(', '))}</td></tr>`).join('')}
        </tbody></table></div>
        ${analise.registros.length > 500 ? `<p class="hint">Mostrando as 500 primeiras linhas.</p>` : ''}`;
      confirmBtn.disabled = !analise.validos;
      confirmBtn.querySelector('span').textContent = analise.validos ? `Importar ${analise.validos} ${analise.validos === 1 ? 'cliente' : 'clientes'}` : 'Nada para importar';
    };
    input.onchange = () => processar(input.files[0]);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => processar(e.dataTransfer.files[0]));
  }

  VG.Clientes = { render, form, ver };
})();
