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
    const kb = S().usageKB();
    const limite = 5120;
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

            <section class="panel"><div class="panel__head"><h3>${VG.icon('database')}Dados e backup</h3></div>
              <div class="panel__body stack">
                <div><div class="hbar__top"><span>Armazenamento usado neste navegador</span><b>${kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB'}</b></div>
                  <div class="meter"><div style="width:${Math.min(100, (kb / limite) * 100)}%"></div></div>
                  <span class="hint">Limite aproximado de 5 MB. Fotos ocupam a maior parte do espaço.</span></div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                  <button class="btn" id="cf-exp">${VG.icon('download')}<span>Exportar backup</span></button>
                  <button class="btn" id="cf-imp">${VG.icon('upload')}<span>Importar backup</span></button>
                  <input type="file" accept="application/json,.json" hidden id="cf-imp-file">
                  <button class="btn btn-danger" id="cf-reset">${VG.icon('refresh')}<span>Restaurar dados de demonstração</span></button>
                </div>
              </div></section>

            <div class="notice notice--info">${VG.icon('info')}<div><strong>Sobre segurança.</strong> Este protótipo guarda dados e senhas (com hash) no navegador, o que não é seguro para produção. A camada de dados (<code>js/storage.js</code>) e a de autenticação (<code>js/auth.js</code>) já estão isoladas para serem trocadas por uma API com banco de dados, sessão no servidor, tokens seguros e expiração de links.</div></div>
          </div>
        </div>
      </div>`;

    VG.bindMasks(el);

    VG.$('#cf-emp', el).onsubmit = (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      if (!fd.nome.trim()) return VG.toast('Informe o nome da empresa.', 'warn');
      S().setConfig({ empresa: { nome: fd.nome.trim(), cnpj: VG.digits(fd.cnpj), telefone: VG.digits(fd.telefone), email: fd.email.trim(), site: fd.site.trim(), endereco: fd.endereco.trim() } });
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
        try { S().setConfig({ logoDataUrl: r.result }); VG.toast('Logo atualizada.', 'success'); VG.App && VG.App.refresh(); }
        catch (err) { /* toast de espaço já exibido */ }
      };
      r.readAsDataURL(f);
    };
    const lr = VG.$('#cf-logo-reset', el);
    if (lr) lr.onclick = () => { S().setConfig({ logoDataUrl: '' }); VG.toast('Logo padrão restaurada.', 'success'); VG.App && VG.App.refresh(); };

    VG.$$('input[name=tema]', el).forEach((r) => (r.onchange = () => VG.Theme.set(r.value)));

    VG.$('#cf-pw', el).onsubmit = (e) => {
      e.preventDefault();
      const atual = VG.$('#pw-atual', el).value, nova = VG.$('#pw-nova', el).value, conf = VG.$('#pw-conf', el).value;
      if (!atual || !nova) return VG.toast('Preencha a senha atual e a nova senha.', 'warn');
      if (nova !== conf) return VG.toast('A confirmação não confere com a nova senha.', 'warn');
      const r = VG.Auth.changePassword(sess.userId, atual, nova);
      if (!r.ok) return VG.toast(r.erro, 'error');
      e.target.reset();
      VG.toast('Senha alterada com sucesso.', 'success');
    };

    VG.$('#cf-link', el).onsubmit = (e) => {
      e.preventDefault();
      const n = Math.max(0, Math.min(365, parseInt(VG.$('#cf-val', el).value, 10) || 0));
      S().setConfig({ validadeLinkDias: n });
      VG.toast(n ? `Links expiram ${n} dia${n > 1 ? 's' : ''} após a abertura da OS.` : 'Links sem expiração.', 'success');
    };

    VG.$('#cf-exp', el).onclick = () => {
      VG.download(`backup_vegas_os_${VG.toInputDate()}.json`, JSON.stringify(S().exportAll()), 'application/json');
      VG.toast('Backup exportado.', 'success');
    };
    const fileImp = VG.$('#cf-imp-file', el);
    VG.$('#cf-imp', el).onclick = () => fileImp.click();
    fileImp.onchange = async () => {
      const f = fileImp.files && fileImp.files[0];
      fileImp.value = '';
      if (!f) return;
      if (!(await VG.confirm('Os dados atuais serão substituídos pelos dados do backup. Deseja continuar?', { title: 'Importar backup', ok: 'Importar', danger: true }))) return;
      try {
        const data = JSON.parse(await f.text());
        S().importAll(data);
        VG.toast('Backup importado. Entre novamente.', 'success');
        VG.Auth.logout();
        setTimeout(() => { location.hash = '#/login'; VG.App.refresh(); }, 400);
      } catch (err) { VG.toast(err.message && err.message.includes('inválido') ? err.message : 'Não foi possível ler o arquivo de backup.', 'error'); }
    };

    VG.$('#cf-reset', el).onclick = async () => {
      if (!(await VG.confirm('Todos os dados deste navegador (clientes, técnicos, OS, fotos e assinaturas) serão apagados e substituídos pelos dados de demonstração. Senhas voltam ao padrão.', { title: 'Restaurar demonstração', ok: 'Apagar e restaurar', danger: true }))) return;
      S().resetAll();
      S().ensureSeed();
      VG.toast('Dados de demonstração restaurados. Entre novamente.', 'success');
      setTimeout(() => { location.hash = '#/login'; VG.App.refresh(); }, 400);
    };
  }

  VG.Configuracoes = { render };
})();
