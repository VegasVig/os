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
          <div class="page-head__actions"><button class="btn btn-primary" id="tc-new">${VG.icon('plus')}<span>Novo técnico</span></button></div>
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
          : VG.empty('shield', 'Nenhum técnico cadastrado', 'Cadastre a equipe para poder enviar ordens de serviço.', `<button class="btn btn-primary" data-act="new">${VG.icon('plus')}<span>Novo técnico</span></button>`)}
        </section>
      </div>`;
    const refresh = () => render(el);
    VG.$('#tc-new', el).onclick = () => form(null, refresh);
    const b = el.querySelector('[data-act=new]'); if (b) b.onclick = () => form(null, refresh);
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

  VG.Tecnicos = { render, form, ativos };
})();
