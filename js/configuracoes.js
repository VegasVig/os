/* =========================================================
   VEGAS OS — CONFIGURAÇÕES
   Empresa, logo, aparência, senha, links, backup e segurança.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const S = () => VG.Store;

  function render(el) {
    const cfg = S().getConfig();
    const emp = cfg.empresa;
    const sess = VG.Auth.current();
    const v = (x) => VG.esc(x || '');
    const tema = S().getTheme();

    el.innerHTML = `
      <div class="page">
        <div class="page-head"><div><h1>Configurações</h1><p>Dados da empresa, aparência, segurança e armazenamento.</p></div></div>
        <div class="settings-grid">
          <div class="stack">
            <section class="panel"><div class="panel__head"><h3>${VG.icon('shield')}Dados da empresa</h3><span class="faint" style="font-size:.8rem">Usados no PDF</span></div>
              <form class="panel__body grid grid-2" id="cf-emp" novalidate>
                <div class="field span-all"><label for="cf-nome">Nome da empresa</label><input id="cf-nome" name="nome" class="input" value="${v(emp.nome)}"></div>
                <div class="field"><label for="cf-cnpj">CNPJ</label><input id="cf-cnpj" name="cnpj" class="input" data-mask="doc" value="${v(VG.fmtDoc(emp.cnpj))}"></div>
                <div class="field"><label for="cf-tel">Telefone</label><input id="cf-tel" name="telefone" class="input" data-mask="phone" value="${v(VG.fmtPhone(emp.telefone))}"></div>
                <div class="field"><label for="cf-mail">E-mail</label><input id="cf-mail" name="email" type="email" class="input" value="${v(emp.email)}"></div>
                <div class="field"><label for="cf-site">Site</label><input id="cf-site" name="site" class="input" value="${v(emp.site)}"></div>
                <div class="field span-all"><label for="cf-end">Endereço</label><input id="cf-end" name="endereco" class="input" value="${v(emp.endereco)}"></div>
                <div class="span-all" style="display:flex;justify-content:flex-end"><button class="btn btn-primary" type="submit">${VG.icon('check')}<span>Salvar dados</span></button></div>
              </form></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('image')}Logo</h3></div>
              <div class="panel__body stack">
                <div class="logo-preview"><img src="${VG.logoSrc()}" alt="Logo atual" id="cf-logo-img"></div>
                <p class="hint" style="margin:0">Padrão: <code>/assets/logo.png</code>. Para trocar em definitivo, substitua esse arquivo. Aqui você pode enviar uma versão (PNG com fundo transparente) que fica salva neste navegador e também é usada no PDF.</p>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                  <button class="btn" id="cf-logo-up">${VG.icon('upload')}<span>Enviar logo</span></button>
                  ${cfg.logoDataUrl ? `<button class="btn btn-ghost" id="cf-logo-reset">${VG.icon('refresh')}<span>Usar logo padrão</span></button>` : ''}
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden id="cf-logo-file">
                </div>
              </div></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('moon')}Aparência</h3></div>
              <div class="panel__body"><div class="seg" role="radiogroup" aria-label="Tema">
                <input type="radio" name="tema" id="tm-dark" value="dark" ${tema === 'dark' ? 'checked' : ''}><label for="tm-dark" style="--c:var(--silver)"><i></i>🌙 Modo escuro</label>
                <input type="radio" name="tema" id="tm-light" value="light" ${tema === 'light' ? 'checked' : ''}><label for="tm-light" style="--c:var(--silver)"><i></i>☀️ Modo claro</label>
              </div><p class="hint" style="margin:.6rem 0 0">A preferência fica salva neste navegador.</p></div></section>
          </div>

          <div class="stack">
            <section class="panel"><div class="panel__head"><h3>${VG.icon('lock')}Alterar minha senha</h3></div>
              <form class="panel__body stack" id="cf-pw" novalidate>
                <p class="hint" style="margin:0">Usuário conectado: <strong>${v(sess && sess.usuario)}</strong></p>
                <div class="field"><label for="pw-atual">Senha atual</label><input id="pw-atual" type="password" class="input" autocomplete="current-password"></div>
                <div class="field"><label for="pw-nova">Nova senha</label><input id="pw-nova" type="password" class="input" autocomplete="new-password"><span class="hint">Mínimo de 8 caracteres, com letras e números.</span></div>
                <div class="field"><label for="pw-conf">Confirmar nova senha</label><input id="pw-conf" type="password" class="input" autocomplete="new-password"></div>
                <div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" type="submit">${VG.icon('check')}<span>Alterar senha</span></button></div>
              </form></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('link')}Links das OS</h3></div>
              <form class="panel__body stack" id="cf-link" novalidate>
                <div class="field"><label for="cf-val">Validade dos links (dias)</label><input id="cf-val" type="number" min="0" max="365" class="input" value="${Number(cfg.validadeLinkDias) || 0}">
                  <span class="hint">0 = sem expiração. Contado a partir da abertura da OS; links de OS concluídas continuam acessíveis para consulta.</span></div>
                <div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" type="submit">${VG.icon('check')}<span>Salvar</span></button></div>
              </form></section>

            <section class="panel"><div class="panel__head"><h3>${VG.icon('database')}Banco de dados</h3></div>
              <div class="panel__body stack">
                <p class="hint" style="margin:0">Os dados ficam numa Planilha Google e as fotos e assinaturas numa pasta do Google Drive, na conta de quem publicou o sistema.</p>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                  ${cfg._planilhaUrl ? `<a class="btn" href="${VG.esc(cfg._planilhaUrl)}" target="_blank" rel="noopener">${VG.icon('sheet')}<span>Abrir planilha</span></a>` : ''}
                  ${cfg._pastaUrl ? `<a class="btn" href="${VG.esc(cfg._pastaUrl)}" target="_blank" rel="noopener">${VG.icon('image')}<span>Abrir pasta de fotos</span></a>` : ''}
                </div>
                ${sess && sess.verTodas ? '' : `<p class="hint" style="margin:0">Importar backup e apagar dados ficam disponíveis só para a supervisão geral (usuário <b>supervisora</b>), porque afetam as OS de todas.</p>`}
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                  <button class="btn" id="cf-exp">${VG.icon('download')}<span>Exportar backup</span></button>
                  ${sess && sess.verTodas ? `<button class="btn" id="cf-imp">${VG.icon('upload')}<span>Importar backup</span></button>` : ''}
                  <input type="file" accept="application/json,.json" hidden id="cf-imp-file">
                </div>
                ${sess && sess.verTodas ? `<div style="display:flex;gap:.5rem;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:.9rem">
                  <button class="btn btn-danger" id="cf-reset">${VG.icon('trash')}<span>Apagar todos os dados</span></button>
                </div>
                <span class="hint">Apaga clientes, técnicos, OS e usuários da planilha. Faça um backup antes.</span>` : ''}
              </div></section>

            <div class="notice notice--info">${VG.icon('info')}<div><strong>Segurança.</strong> As senhas são conferidas no servidor (Google Apps Script) e nunca chegam ao navegador. Cada link de OS só dá acesso àquela ordem, e o cliente só consegue assinar — não altera o serviço registrado. Troque a senha inicial da supervisora e dos técnicos.</div></div>
          </div>
        </div>
      </div>`;

    VG.bindMasks(el);

    VG.$('#cf-emp', el).onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      if (!fd.nome.trim()) return VG.toast('Informe o nome da empresa.', 'warn');
      try { await S().setConfig({ empresa: { nome: fd.nome.trim(), cnpj: VG.digits(fd.cnpj), telefone: VG.digits(fd.telefone), email: fd.email.trim(), site: fd.site.trim(), endereco: fd.endereco.trim() } }); }
      catch (err) { return; }
      VG.toast('Dados da empresa salvos.', 'success');
    };

    const fileLogo = VG.$('#cf-logo-file', el);
    VG.$('#cf-logo-up', el).onclick = () => fileLogo.click();
    fileLogo.onchange = () => {
      const f = fileLogo.files && fileLogo.files[0];
      fileLogo.value = '';
      if (!f) return;
      if (f.size > 1.5 * 1024 * 1024) return VG.toast('Use uma imagem de até 1,5 MB.', 'warn');
      const r = new FileReader();
      r.onload = () => {
        VG.toast('Enviando logo…');
        S().setConfig({ logoDataUrl: r.result }).then(() => { VG.toast('Logo atualizada.', 'success'); VG.App && VG.App.refresh(); }).catch(() => {});
      };
      r.readAsDataURL(f);
    };
    const lr = VG.$('#cf-logo-reset', el);
    if (lr) lr.onclick = () => S().setConfig({ logoDataUrl: '' }).then(() => { VG.toast('Logo padrão restaurada.', 'success'); VG.App && VG.App.refresh(); }).catch(() => {});

    VG.$$('input[name=tema]', el).forEach((r) => (r.onchange = () => VG.Theme.set(r.value)));

    VG.$('#cf-pw', el).onsubmit = async (e) => {
      e.preventDefault();
      const atual = VG.$('#pw-atual', el).value, nova = VG.$('#pw-nova', el).value, conf = VG.$('#pw-conf', el).value;
      if (!atual || !nova) return VG.toast('Preencha a senha atual e a nova senha.', 'warn');
      if (nova !== conf) return VG.toast('A confirmação não confere com a nova senha.', 'warn');
      const r = await VG.Auth.changePassword(sess.userId, atual, nova);
      if (!r.ok) return VG.toast(r.erro, 'error');
      e.target.reset();
      VG.toast('Senha alterada com sucesso.', 'success');
    };

    VG.$('#cf-link', el).onsubmit = async (e) => {
      e.preventDefault();
      const n = Math.max(0, Math.min(365, parseInt(VG.$('#cf-val', el).value, 10) || 0));
      try { await S().setConfig({ validadeLinkDias: n }); } catch (err) { return; }
      VG.toast(n ? `Links expiram ${n} dia${n > 1 ? 's' : ''} após a abertura da OS.` : 'Links sem expiração.', 'success');
    };

    VG.$('#cf-exp', el).onclick = () => {
      VG.download(`backup_vegas_os_${VG.toInputDate()}.json`, JSON.stringify(S().exportAll()), 'application/json');
      VG.toast('Backup exportado.', 'success');
    };
    const fileImp = VG.$('#cf-imp-file', el);
    const bImp = VG.$('#cf-imp', el); if (bImp) bImp.onclick = () => fileImp.click();
    fileImp.onchange = async () => {
      const f = fileImp.files && fileImp.files[0];
      fileImp.value = '';
      if (!f) return;
      if (!(await VG.confirm('Os dados atuais serão substituídos pelos dados do backup. Deseja continuar?', { title: 'Importar backup', ok: 'Importar', danger: true }))) return;
      try {
        const data = JSON.parse(await f.text());
        VG.toast('Importando backup…');
        await S().importAll(data);
        encerrar('Backup importado. Entre novamente.');
      } catch (err) { VG.toast(err.message || 'Não foi possível ler o arquivo de backup.', 'error', 7000); }
    };

    const encerrar = (msg) => {
      VG.toast(msg, 'success', 6000);
      VG.Store.write('session', null);
      VG.Store.clear();
      setTimeout(() => { location.hash = '#/login'; VG.App.refresh(); }, 400);
    };

    const bReset = VG.$('#cf-reset', el);
    if (bReset) bReset.onclick = async () => {
      if (!(await VG.confirm('Todos os clientes, técnicos, OS e usuários serão apagados da planilha. Fica apenas o usuário "supervisora" com a senha inicial. As fotos já enviadas continuam na pasta do Drive.', { title: 'Apagar todos os dados', ok: 'Apagar tudo', danger: true }))) return;
      const txt = await VG.promptText({ title: 'Confirmação', label: 'Digite APAGAR para confirmar', ok: 'Apagar tudo', danger: true });
      if (txt == null) return;
      if (txt.trim().toUpperCase() !== 'APAGAR') return VG.toast('Confirmação incorreta. Nada foi apagado.', 'warn');
      try { await S().resetAll(); encerrar('Dados apagados. Entre com o usuário supervisora.'); }
      catch (err) { VG.toast(err.message, 'error', 7000); }
    };
  }

  VG.Configuracoes = { render };
})();
