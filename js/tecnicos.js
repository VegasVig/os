/* =========================================================
   VEGAS OS — TÉCNICOS
   Cada técnico tem um usuário de acesso ao sistema.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;
  const SENHA_PADRAO = 'Vegas4747@!';

  const userOf = (t) => S().list('users').find((u) => u.tecnicoId === t.id);
  const ativos = () => S().list('tecnicos').filter((t) => t.ativo !== false);

  function render(el) {
    const tecnicos = S().list('tecnicos').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const ordens = S().list('ordens');
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div><h1>Técnicos</h1><p>Equipe de campo e acesso de cada técnico ao sistema.</p></div>
          <div class="page-head__actions">
            <button class="btn" id="tc-import">${VG.icon('upload')}<span>Importar técnicos CSV</span></button>
            <button class="btn btn-primary" id="tc-new">${VG.icon('plus')}<span>Novo técnico</span></button>
          </div>
        </div>
        <section class="panel">
          ${tecnicos.length ? `<div class="table-wrap"><table class="table table--cards">
            <thead><tr><th>Técnico</th><th>Especialidade</th><th>Telefone</th><th>Usuário</th><th>Em aberto</th><th>Concluídas</th><th>Status</th><th style="text-align:right">Ações</th></tr></thead>
            <tbody>${tecnicos.map((t) => {
              const u = userOf(t);
              const minhas = ordens.filter((o) => o.tecnicoId === t.id);
              const abertas = minhas.filter((o) => ['aguardando_tecnico', 'em_atendimento', 'aguardando_cliente'].includes(o.status)).length;
              const concl = minhas.filter((o) => o.status === 'concluida').length;
              return `<tr data-id="${t.id}">
                <td data-label="Técnico"><div style="display:flex;align-items:center;gap:.7rem"><span class="avatar" style="width:34px;height:34px;font-size:.78rem">${VG.initials(t.nome)}</span><div><span class="strong">${VG.esc(t.nome)}</span><span class="sub">${VG.esc(t.email || '')}</span></div></div></td>
                <td data-label="Especialidade">${VG.esc(t.especialidade || '—')}</td>
                <td data-label="Telefone">${t.telefone ? `<a href="tel:${VG.digits(t.telefone)}" style="text-decoration:none">${VG.esc(VG.fmtPhone(t.telefone))}</a>` : '—'}</td>
                <td data-label="Usuário"><span class="tag">${VG.esc(u ? u.usuario : '—')}</span></td>
                <td data-label="Em aberto" class="num">${abertas}</td>
                <td data-label="Concluídas" class="num">${concl}</td>
                <td data-label="Status">${t.ativo !== false ? '<span class="badge badge--green"><i></i>Ativo</span>' : '<span class="badge badge--gray"><i></i>Inativo</span>'}</td>
                <td data-label="" class="row-actions-cell"><div class="row-actions">
                  <button class="btn btn-ghost btn-icon" data-act="os" title="Ver OS do técnico" aria-label="Ver OS do técnico">${VG.icon('os')}</button>
                  <button class="btn btn-ghost btn-icon" data-act="edit" title="Editar" aria-label="Editar">${VG.icon('edit')}</button>
                  <button class="btn btn-ghost btn-icon" data-act="del" title="Excluir" aria-label="Excluir">${VG.icon('trash')}</button>
                </div></td></tr>`;
            }).join('')}</tbody></table></div>`
          : VG.empty('shield', 'Nenhum técnico cadastrado', 'Cadastre a equipe um a um ou importe uma lista CSV para poder enviar ordens de serviço.', `<div style="display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center"><button class="btn" data-act="import">${VG.icon('upload')}<span>Importar lista CSV</span></button><button class="btn btn-primary" data-act="new">${VG.icon('plus')}<span>Novo técnico</span></button></div>`)}
        </section>
      </div>`;
    const refresh = () => render(el);
    VG.$('#tc-new', el).onclick = () => form(null, refresh);
    const b = el.querySelector('[data-act=new]'); if (b) b.onclick = () => form(null, refresh);
    VG.$('#tc-import', el).onclick = () => importar(refresh);
    const bi = el.querySelector('[data-act=import]'); if (bi) bi.onclick = () => importar(refresh);
    el.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelector('[data-act=os]').onclick = () => (location.hash = `#/os?tecnico=${id}`);
      tr.querySelector('[data-act=edit]').onclick = () => form(id, refresh);
      tr.querySelector('[data-act=del]').onclick = () => excluir(id, refresh);
    });
  }

  function form(id, done) {
    const t = id ? S().get('tecnicos', id) : { ativo: true };
    const u = id ? userOf(t) : null;
    VG.modal({
      title: id ? 'Editar técnico' : 'Novo técnico', size: 'lg',
      body: `
        <form id="tf" class="grid grid-2" novalidate>
          <div class="field span-2"><label for="tf-nome">Nome completo<span class="req">*</span></label><input id="tf-nome" name="nome" class="input" value="${VG.esc(t.nome || '')}"></div>
          <div class="field"><label for="tf-tel">Telefone / WhatsApp</label><input id="tf-tel" name="telefone" class="input" data-mask="phone" inputmode="tel" value="${VG.esc(VG.fmtPhone(t.telefone))}"></div>
          <div class="field"><label for="tf-email">E-mail</label><input id="tf-email" name="email" type="email" class="input" value="${VG.esc(t.email || '')}"></div>
          <div class="field span-2"><label for="tf-esp">Especialidade</label><input id="tf-esp" name="especialidade" class="input" placeholder="Ex.: CFTV, alarmes, controle de acesso" value="${VG.esc(t.especialidade || '')}"></div>
          <hr class="divider span-2" style="margin:.2rem 0">
          <div class="field"><label for="tf-user">Usuário de acesso<span class="req">*</span></label><input id="tf-user" name="usuario" class="input" autocapitalize="none" autocomplete="off" value="${VG.esc(u ? u.usuario : '')}"><span class="hint">Usado pelo técnico para entrar no sistema.</span></div>
          <div class="field"><label for="tf-pass">${id ? 'Nova senha (opcional)' : 'Senha inicial'}</label><input id="tf-pass" name="senha" type="password" class="input" autocomplete="new-password" placeholder="${id ? 'Deixe em branco para manter' : 'Em branco = senha padrão do sistema'}"></div>
          <label class="check span-2"><input type="checkbox" name="ativo" ${t.ativo !== false ? 'checked' : ''}> Técnico ativo (pode receber OS e acessar o sistema)</label>
        </form>`,
      onOpen: (m) => {
        VG.bindMasks(m);
        const nome = m.querySelector('#tf-nome'), user = m.querySelector('#tf-user');
        if (!id) nome.addEventListener('input', () => { if (!user.dataset.touched) user.value = VG.norm(nome.value.split(' ')[0]).replace(/[^a-z0-9]/g, ''); });
        user.addEventListener('input', () => (user.dataset.touched = '1'));
      },
      actions: [
        { label: 'Cancelar' },
        { label: id ? 'Salvar alterações' : 'Cadastrar técnico', cls: 'btn-primary', icon: 'check', onClick: (m) => {
          const fd = Object.fromEntries(new FormData(m.el.querySelector('#tf')));
          const usuario = VG.norm(fd.usuario).replace(/\s+/g, '');
          if (!fd.nome.trim()) { VG.toast('Informe o nome do técnico.', 'warn'); return false; }
          if (!/^[a-z0-9._-]{3,}$/.test(usuario)) { VG.toast('O usuário precisa ter 3 ou mais letras ou números, sem espaços.', 'warn'); return false; }
          const conflito = S().list('users').find((x) => VG.norm(x.usuario) === usuario && (!u || x.id !== u.id));
          if (conflito) { VG.toast('Este usuário já está em uso. Escolha outro.', 'warn'); return false; }
          if (fd.senha) { const v = VG.Auth.validarSenha(fd.senha); if (v) { VG.toast(v, 'warn'); return false; } }

          const obj = Object.assign({}, t, { nome: fd.nome.trim(), telefone: VG.digits(fd.telefone), email: fd.email.trim(), especialidade: fd.especialidade.trim(), usuario, ativo: !!fd.ativo });
          if (!id) obj.criadoEm = VG.nowISO();
          S().save('tecnicos', obj);

          let user = u || { usuario, nome: obj.nome, papel: 'tecnico', tecnicoId: obj.id, criadoEm: VG.nowISO() };
          user = Object.assign(user, { usuario, nome: obj.nome, ativo: obj.ativo });
          if (!u || fd.senha) VG.Auth.setPassword(user, fd.senha || SENHA_PADRAO);
          else S().save('users', user);

          // mantém o nome atualizado nas OS em aberto
          if (id) S().list('ordens').filter((o) => o.tecnicoId === id && o.status !== 'concluida').forEach((o) => { o.tecnicoNome = obj.nome; S().save('ordens', o); });
          VG.toast(id ? 'Técnico atualizado.' : `Técnico cadastrado. Usuário: ${usuario}`, 'success');
          done && done();
        } },
      ],
    });
  }

  async function excluir(id, done) {
    const t = S().get('tecnicos', id);
    const qtd = S().list('ordens').filter((o) => o.tecnicoId === id).length;
    if (qtd) {
      const ok = await VG.confirm(`${t.nome} possui ${qtd} OS no histórico e não pode ser excluído. Deseja desativar o técnico? Ele perderá o acesso ao sistema.`, { title: 'Técnico com OS', ok: 'Desativar técnico' });
      if (!ok) return;
      t.ativo = false; S().save('tecnicos', t);
      const u = userOf(t); if (u) { u.ativo = false; S().save('users', u); }
      VG.toast('Técnico desativado.', 'success');
    } else {
      const ok = await VG.confirm(`Excluir ${t.nome} e o usuário de acesso dele?`, { title: 'Excluir técnico', ok: 'Excluir', danger: true });
      if (!ok) return;
      const u = userOf(t); if (u) S().remove('users', u.id);
      S().remove('tecnicos', id);
      VG.toast('Técnico excluído.', 'success');
    }
    done && done();
  }


  /* ---------- IMPORTAÇÃO CSV ---------- */
  const COLS_TEC = ['nome', 'usuario', 'telefone', 'email', 'especialidade', 'senha'];
  const ALIAS_TEC = {
    nome: ['nome', 'tecnico', 'nome_completo', 'funcionario', 'colaborador'],
    usuario: ['usuario', 'login', 'user', 'usuario_de_acesso'],
    telefone: ['telefone', 'celular', 'whatsapp', 'fone', 'tel'],
    email: ['email', 'e_mail', 'e-mail'],
    especialidade: ['especialidade', 'area', 'funcao', 'cargo'],
    senha: ['senha', 'password', 'senha_inicial'],
  };

  function baixarModeloTec() {
    const linhas = [
      COLS_TEC.join(','),
      'Nome Sobrenome,nome.sobrenome,21999990000,tecnico@empresa.com.br,CFTV e redes,',
      'Outro Técnico,,21988880000,,Alarmes e cercas elétricas,Senha2026x',
    ];
    VG.download('modelo_tecnicos_vegas.csv', '\uFEFF' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function analisarTec(text) {
    const rows = VG.CSV.parse(text);
    if (rows.length < 2) return { erroGeral: 'O arquivo está vazio ou só tem o cabeçalho.' };
    const head = rows[0].map((h) => VG.norm(h).replace(/\s+/g, '_'));
    const map = {};
    COLS_TEC.forEach((c) => { const i = head.findIndex((h) => ALIAS_TEC[c].includes(h)); if (i >= 0) map[c] = i; });
    if (map.nome == null) return { erroGeral: 'Não encontramos a coluna "nome" no cabeçalho. Baixe o modelo CSV e use os mesmos nomes de coluna.' };
    const usados = new Set(S().list('users').map((u) => VG.norm(u.usuario)));
    const registros = rows.slice(1).map((r, i) => {
      const d = {};
      COLS_TEC.forEach((c) => (d[c] = map[c] != null ? String(r[map[c]] ?? '').trim() : ''));
      const erros = [];
      let situacao = 'ok';
      if (!d.nome) erros.push('Nome em branco');
      let usuario = VG.norm(d.usuario).replace(/\s+/g, '');
      if (!usuario && d.nome) {
        // gera a partir do primeiro nome: joao, joao2, joao3…
        const base = VG.norm(d.nome.split(' ')[0]).replace(/[^a-z0-9]/g, '') || 'tecnico';
        usuario = base; let n = 2;
        while (usados.has(usuario)) usuario = base + n++;
        d.usuarioGerado = true;
      }
      if (usuario && !/^[a-z0-9._-]{3,}$/.test(usuario)) erros.push('Usuário inválido (mín. 3 letras/números, sem espaços)');
      if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) erros.push('E-mail inválido');
      if (d.senha) { const v = VG.Auth.validarSenha(d.senha); if (v) erros.push(v.replace('A senha', 'Senha')); }
      if (erros.length) situacao = 'erro';
      else if (usados.has(usuario)) { situacao = 'duplicado'; erros.push('Usuário já existe'); }
      if (usuario && situacao !== 'erro') usados.add(usuario);
      d.usuario = usuario;
      d.telefone = VG.digits(d.telefone);
      return { linha: i + 2, dados: d, erros, situacao };
    });
    return { registros, total: registros.length, validos: registros.filter((r) => r.situacao === 'ok').length, problemas: registros.filter((r) => r.situacao !== 'ok').length };
  }

  function importar(done) {
    let analise = null;
    const modal = VG.modal({
      title: 'Importar técnicos CSV', size: 'xl',
      body: `
        <label class="csv-drop" id="tcsv-drop" for="tcsv-file">
          <span class="empty__icon">${VG.icon('sheet')}</span>
          <strong>Selecione ou arraste um arquivo .csv</strong>
          <span class="muted" style="font-size:.85rem">Colunas: ${COLS_TEC.join(', ')}</span>
          <input type="file" id="tcsv-file" accept=".csv,text/csv" class="sr-only">
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-top:1rem;flex-wrap:wrap">
          <span class="hint">Só "nome" é obrigatório. Usuário em branco é criado a partir do primeiro nome; senha em branco usa a senha inicial do sistema.</span>
          <button type="button" class="btn btn-sm" id="tcsv-model">${VG.icon('download')}<span>Baixar modelo CSV</span></button>
        </div>
        <div id="tcsv-step2" class="hidden"></div>`,
      actions: [
        { label: 'Cancelar' },
        { label: 'Confirmar importação', cls: 'btn-primary', icon: 'check', onClick: async () => {
          if (!analise || !analise.validos) { VG.toast('Selecione um arquivo com técnicos válidos.', 'warn'); return false; }
          const items = analise.registros.filter((r) => r.situacao === 'ok').map((r) => ({
            nome: r.dados.nome, usuario: r.dados.usuario, telefone: r.dados.telefone, email: r.dados.email, especialidade: r.dados.especialidade, senha: r.dados.senha,
          }));
          const btn = modal.el.querySelector('.modal__foot .btn-primary');
          VG.setBusy(btn, true, 'Importando…');
          try {
            const r = await S().importTecnicos(items);
            VG.toast(`${r.tecnicos.length} ${r.tecnicos.length === 1 ? 'técnico importado' : 'técnicos importados'} com sucesso.`, 'success');
            done && done();
            listaAcessos(r.tecnicos, items);
          } catch (e) {
            VG.setBusy(btn, false);
            VG.toast(e.message, 'error', 7000);
            return false;
          }
        } },
      ],
    });
    const m = modal.el;
    const confirmBtn = m.querySelector('.modal__foot .btn-primary');
    confirmBtn.disabled = true;
    m.querySelector('#tcsv-model').onclick = baixarModeloTec;
    const input = m.querySelector('#tcsv-file');
    const drop = m.querySelector('#tcsv-drop');
    const processar = async (file) => {
      if (!file) return;
      if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') { VG.toast('Selecione um arquivo com extensão .csv.', 'warn'); return; }
      const step2 = m.querySelector('#tcsv-step2');
      step2.classList.remove('hidden'); step2.innerHTML = VG.loading('Lendo arquivo…');
      try { analise = analisarTec(await VG.CSV.lerArquivo(file)); } catch (e) { analise = { erroGeral: e.message }; }
      if (analise.erroGeral) {
        step2.innerHTML = `<div class="notice" style="margin-top:1rem">${VG.icon('alert')}<div>${VG.esc(analise.erroGeral)}</div></div>`;
        confirmBtn.disabled = true; analise = null; return;
      }
      const sit = { ok: '<span class="badge badge--green"><i></i>Pronto</span>', erro: '<span class="badge badge--red"><i></i>Erro</span>', duplicado: '<span class="badge badge--yellow"><i></i>Duplicado</span>' };
      step2.innerHTML = `
        <hr class="divider">
        <p style="margin:0 0 .8rem"><strong>${VG.esc(file.name)}</strong></p>
        <div class="csv-summary">
          <div><b>${analise.total}</b><span>${analise.total === 1 ? 'técnico encontrado' : 'técnicos encontrados'}</span></div>
          <div><b style="color:var(--st-green)">${analise.validos}</b><span>${analise.validos === 1 ? 'pronto' : 'prontos'} para importação</span></div>
          <div><b style="color:${analise.problemas ? 'var(--st-red)' : 'inherit'}">${analise.problemas}</b><span>${analise.problemas === 1 ? 'registro possui' : 'registros possuem'} problemas</span></div>
        </div>
        <div class="csv-preview"><table class="table"><thead><tr><th>Linha</th><th>Situação</th><th>Nome</th><th>Usuário</th><th>Telefone</th><th>Especialidade</th><th>Senha</th><th>Observação</th></tr></thead><tbody>
          ${analise.registros.slice(0, 500).map((r) => `<tr class="${r.situacao === 'erro' ? 'row-err' : r.situacao === 'duplicado' ? 'row-dup' : ''}">
            <td class="num">${r.linha}</td><td>${sit[r.situacao]}</td><td>${VG.esc(r.dados.nome || '—')}</td>
            <td>${VG.esc(r.dados.usuario || '—')}${r.dados.usuarioGerado ? ' <span class="faint">(gerado)</span>' : ''}</td>
            <td>${VG.esc(VG.fmtPhone(r.dados.telefone) || '—')}</td><td>${VG.esc(r.dados.especialidade || '—')}</td>
            <td class="faint">${r.dados.senha ? 'definida no arquivo' : 'senha inicial'}</td><td class="faint">${VG.esc(r.erros.join(', '))}</td></tr>`).join('')}
        </tbody></table></div>`;
      confirmBtn.disabled = !analise.validos;
      confirmBtn.querySelector('span').textContent = analise.validos ? `Importar ${analise.validos} ${analise.validos === 1 ? 'técnico' : 'técnicos'}` : 'Nada para importar';
    };
    input.onchange = () => processar(input.files[0]);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => processar(e.dataTransfer.files[0]));
  }

  /** Mostra os usuários criados para a supervisora repassar à equipe */
  function listaAcessos(tecnicos, items) {
    VG.modal({
      title: 'Acessos criados', size: 'lg',
      body: `
        <p style="margin-top:0">Repasse a cada técnico o usuário abaixo. Quem ficou com a <strong>senha inicial</strong> deve trocá-la no primeiro acesso.</p>
        <div class="table-wrap"><table class="table"><thead><tr><th>Técnico</th><th>Usuário</th><th>Senha</th></tr></thead><tbody>
          ${tecnicos.map((t, i) => `<tr><td>${VG.esc(t.nome)}</td><td><span class="tag">${VG.esc(t.usuario)}</span></td><td class="faint">${items[i] && items[i].senha ? 'a definida no arquivo' : 'senha inicial do sistema'}</td></tr>`).join('')}
        </tbody></table></div>`,
      actions: [{ label: 'Fechar', cls: 'btn-primary' }],
    });
  }

  VG.Tecnicos = { render, form, ativos, importar };
})();
