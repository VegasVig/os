/* =========================================================
   VEGAS OS — ARMAZENAMENTO (versão Google Apps Script)
   ---------------------------------------------------------
   Os dados ficam na Planilha Google (via Code.gs).
   O navegador mantém uma cópia em memória para as telas
   ficarem rápidas; cada alteração é enviada ao servidor
   em segundo plano (fila por registro, sem perder dados).
   Fotos e assinaturas vão para o Google Drive e voltam
   como referências "drive:ID", carregadas sob demanda.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const PREFIX = 'vegas_os_';

  const DEFAULT_CONFIG = {
    empresa: { nome: 'Vegas Vigilância e Segurança', cnpj: '', telefone: '', email: '', endereco: '', site: '' },
    ultimoNumeroOS: 1000,
    validadeLinkDias: 0,
    logoDataUrl: '',
  };
  const COLS = ['users', 'clientes', 'tecnicos', 'ordens', 'atividades'];

  let mem = { users: [], clientes: [], tecnicos: [], ordens: [], atividades: [], config: {}, rev: 0 };
  let publico = null; // { numero, t } quando a tela foi aberta por link exclusivo
  const memLocal = {};

  /* ---------- chamada ao servidor ---------- */
  function credenciais() {
    if (publico) return { numero: publico.numero, t: publico.t };
    const s = VG.Store.read('session', null);
    return s ? { token: s.token } : {};
  }
  function call(action, payload, opts) {
    const o = opts || {};
    return new Promise((resolve, reject) => {
      const req = Object.assign({ action }, o.semCredencial ? {} : credenciais(), payload || {});
      const apiUrl = window.VG_CONFIG && window.VG_CONFIG.API_URL;
      const run = window.google && window.google.script && window.google.script.run;
      const tratar = (txt) => {
          let r;
          try { r = JSON.parse(txt); } catch (e) { return reject(new Error('O servidor não respondeu corretamente. Confira se a implantação do Apps Script está como "Qualquer pessoa" e se o endereço termina em /exec.')); }
          if (r.ok) return resolve(r.data);
          const msg = String(r.erro || 'Erro no servidor.');
          if (msg.indexOf('SESSAO:') === 0) {
            const clean = msg.replace('SESSAO:', '').trim();
            if (!o.silencioso) {
              VG.Store.write('session', null);
              VG.toast(clean, 'warn');
              if (!publico) location.hash = '#/login';
            }
            return reject(new Error(clean));
          }
          reject(new Error(msg));
      };
      const falha = (err) => reject(new Error((err && err.message && !/fetch/i.test(err.message) ? err.message : '') || 'Falha de conexão com o servidor. Verifique a internet.'));
      if (apiUrl) {
        // GitHub Pages (ou outro site): POST em texto simples, sem pré-verificação CORS
        fetch(apiUrl, { method: 'POST', body: JSON.stringify(req), redirect: 'follow' })
          .then((r) => r.text()).then(tratar).catch(falha);
      } else if (run) {
        run.withSuccessHandler(tratar).withFailureHandler(falha).api(req);
      } else {
        reject(new Error('Servidor não configurado. Informe o endereço do Apps Script em js/config.js.'));
      }
    });
  }

  /* ---------- fila de gravação (por registro) ---------- */
  const filas = {};
  let pendentes = 0;
  function atualizarIndicador() {
    document.documentElement.classList.toggle('is-saving', pendentes > 0);
  }

  /** Copia referências drive: devolvidas pelo servidor para o objeto local */
  function aplicarRefs(local, enviado, salvo) {
    if (salvo == null || local == null) return;
    if (Array.isArray(salvo)) {
      salvo.forEach((v, i) => {
        if (typeof v === 'string') {
          if (v.indexOf('drive:') === 0 && typeof enviado[i] === 'string' && enviado[i].indexOf('data:') === 0) {
            VG.Images.cache[v.slice(6)] = enviado[i];
            if (local[i] === enviado[i]) local[i] = v;
          }
        } else if (v && typeof v === 'object' && enviado && enviado[i] && local[i]) aplicarRefs(local[i], enviado[i], v);
      });
      return;
    }
    if (typeof salvo === 'object') {
      Object.keys(salvo).forEach((k) => {
        const v = salvo[k];
        if (typeof v === 'string') {
          if (v.indexOf('drive:') === 0 && enviado && typeof enviado[k] === 'string' && enviado[k].indexOf('data:') === 0) {
            VG.Images.cache[v.slice(6)] = enviado[k];
            if (local[k] === enviado[k]) local[k] = v;
          }
        } else if (v && typeof v === 'object' && enviado && enviado[k] && local[k]) aplicarRefs(local[k], enviado[k], v);
      });
    }
  }

  function agendar(col, obj) {
    const k = col + ':' + obj.id;
    const f = filas[k] || (filas[k] = { chain: Promise.resolve(), agendado: false });
    f.col = col; f.obj = obj;
    if (f.agendado) return f.chain;
    f.agendado = true;
    pendentes++; atualizarIndicador();
    f.chain = f.chain.catch(() => {}).then(async () => {
      f.agendado = false;
      const enviado = JSON.parse(JSON.stringify(f.obj));
      try {
        const salvo = publico && col === 'ordens'
          ? await call('savePublic', { obj: enviado })
          : await call('save', { col, obj: enviado });
        aplicarRefs(f.obj, enviado, salvo);
        // supervisora: recebe a versão mesclada (atendimento feito em campo prevalece)
        const sess = VG.Auth.current();
        if (salvo && col === 'ordens' && !publico && sess && sess.papel === 'supervisora') {
          ['atendimento', 'assinaturaTecnico', 'assinaturaCliente', 'status', 'historico'].forEach((c) => { if (salvo[c] !== undefined) f.obj[c] = salvo[c]; });
        }
        if (salvo && salvo.atualizadoEm) f.obj.atualizadoEm = salvo.atualizadoEm;
        return salvo;
      } catch (e) {
        VG.toast('Não foi possível salvar no servidor: ' + e.message, 'error', 7000);
        throw e;
      } finally {
        pendentes--; atualizarIndicador();
      }
    });
    return f.chain;
  }

  window.addEventListener('beforeunload', (e) => {
    if (pendentes > 0) { e.preventDefault(); e.returnValue = 'Ainda há alterações sendo salvas.'; }
  });

  const Store = {
    call,

    /* chaves locais (sessão, último usuário, tema) */
    read(key, def) {
      if (COLS.indexOf(key) >= 0) return mem[key];
      if (key === 'config') return mem.config;
      try { const v = localStorage.getItem(PREFIX + key); return v == null ? def : JSON.parse(v); }
      catch (e) { return key in memLocal ? memLocal[key] : def; }
    },
    write(key, value) {
      if (COLS.indexOf(key) >= 0) { mem[key] = value; return true; }
      memLocal[key] = value;
      try { if (value == null) localStorage.removeItem(PREFIX + key); else localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* navegador sem armazenamento */ }
      return true;
    },

    /* ---------- estado ---------- */
    load(snap) {
      mem = {
        users: snap.users || [], clientes: snap.clientes || [], tecnicos: snap.tecnicos || [],
        ordens: snap.ordens || [], atividades: snap.atividades || [], config: snap.config || {}, rev: snap.rev || 0,
      };
    },
    clear() { mem = { users: [], clientes: [], tecnicos: [], ordens: [], atividades: [], config: mem.config || {}, rev: 0 }; },
    rev() { return mem.rev; },
    setRev(r) { mem.rev = r; },
    setPublic(link) { publico = link; },
    isPublic() { return !!publico; },
    pendentes: () => pendentes,
    /** Aguarda o envio das alterações pendentes (de um registro ou de todos) */
    flush(id) {
      const lista = Object.keys(filas).filter((k) => !id || k.endsWith(':' + id)).map((k) => filas[k].chain);
      return Promise.all(lista);
    },
    /** Insere/atualiza um registro vindo do servidor sem reenviar */
    put(col, obj) {
      const arr = mem[col];
      const i = arr.findIndex((x) => x.id === obj.id);
      if (i >= 0) arr[i] = obj; else arr.push(obj);
      return obj;
    },

    /* ---------- coleções ---------- */
    list(col) { return mem[col] || []; },
    get(col, id) { return this.list(col).find((x) => x.id === id) || null; },
    save(col, obj) {
      if (!obj.id) obj.id = VG.uid();
      obj.atualizadoEm = VG.nowISO();
      this.put(col, obj);
      agendar(col, obj).catch(() => { /* erro já exibido ao usuário */ });
      return obj;
    },
    saveMany(col, items) {
      items.forEach((obj) => { if (!obj.id) obj.id = VG.uid(); obj.atualizadoEm = VG.nowISO(); mem[col].push(obj); });
      pendentes++; atualizarIndicador();
      return call('saveMany', { col, items })
        .catch((e) => { VG.toast('Não foi possível salvar no servidor: ' + e.message, 'error', 7000); throw e; })
        .finally(() => { pendentes--; atualizarIndicador(); });
    },
    remove(col, id) {
      mem[col] = this.list(col).filter((x) => x.id !== id);
      return call('remove', { col, id }).catch((e) => VG.toast('Não foi possível excluir no servidor: ' + e.message, 'error', 7000));
    },

    /* ---------- ordens ---------- */
    getOSByNumero(numero) { return this.list('ordens').find((o) => String(o.numero) === String(numero)) || null; },
    /** Apenas prévia: o número definitivo é gerado no servidor */
    nextOSNumber() {
      const cfg = this.getConfig();
      return Math.max(cfg.ultimoNumeroOS || 1000, ...this.list('ordens').map((o) => Number(o.numero) || 0)) + 1;
    },
    /** Cadastra vários técnicos (com usuário e senha) de uma vez */
    async importTecnicos(items) {
      const r = await call('importTecnicos', { items });
      r.tecnicos.forEach((t) => this.put('tecnicos', t));
      r.users.forEach((u) => this.put('users', u));
      return r;
    },
    async createOS(os) {
      const salva = await call('createOS', { os });
      this.put('ordens', salva);
      mem.config.ultimoNumeroOS = salva.numero;
      return salva;
    },
    hist(os, texto, autor) {
      os.historico = os.historico || [];
      os.historico.push({ dataHora: VG.nowISO(), texto, autor: autor || '' });
    },

    /* ---------- atividade recente ---------- */
    log(texto, osId, icon = 'activity') {
      const entry = { id: VG.uid(), dataHora: VG.nowISO(), texto, osId: osId || null, icon };
      mem.atividades.unshift(entry);
      mem.atividades = mem.atividades.slice(0, 150);
      const s = VG.Auth.current();
      // transições feitas pelo técnico/cliente são registradas pelo próprio servidor
      if (!publico && s && s.papel === 'supervisora') call('log', { entry }).catch(() => {});
    },

    /* ---------- configurações ---------- */
    getConfig() {
      const c = mem.config || {};
      return Object.assign({}, DEFAULT_CONFIG, c, { empresa: Object.assign({}, DEFAULT_CONFIG.empresa, c.empresa || {}) });
    },
    async setConfig(patch) {
      const antes = Object.assign({}, mem.config);
      mem.config = Object.assign({}, mem.config, patch);
      try {
        const enviado = JSON.parse(JSON.stringify(patch));
        const salvo = await call('setConfig', { patch });
        aplicarRefs(mem.config, enviado, salvo);
        mem.config = Object.assign(mem.config, salvo);
        return mem.config;
      } catch (e) {
        mem.config = antes;
        VG.toast('Não foi possível salvar as configurações: ' + e.message, 'error', 7000);
        throw e;
      }
    },

    getTheme() { try { return localStorage.getItem(PREFIX + 'theme') || memLocal.theme || 'dark'; } catch (e) { return memLocal.theme || 'dark'; } },
    setTheme(t) { memLocal.theme = t; try { localStorage.setItem(PREFIX + 'theme', t); } catch (e) {} },

    /* ---------- backup e demonstração ---------- */
    exportAll() {
      const data = { app: 'vegas-os', versao: 1, exportadoEm: VG.nowISO(), observacao: 'Fotos e assinaturas permanecem no Google Drive (referências drive:).' };
      COLS.forEach((k) => (data[k] = mem[k]));
      const cfg = Object.assign({}, mem.config);
      Object.keys(cfg).forEach((k) => { if (k.charAt(0) === '_') delete cfg[k]; });
      data.config = cfg;
      return data;
    },
    importAll(data) { return call('importAll', { data }); },
    resetAll() { return call('resetAll', {}); },
    ensureSeed() { /* no servidor, o primeiro usuário é criado por instalar() */ },
  };

  /* ---------- imagens do Drive ---------- */
  const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const Images = {
    cache: {},
    esperando: {},
    fila: [],
    timer: null,
    get(id) {
      if (this.cache[id]) return Promise.resolve(this.cache[id]);
      if (this.esperando[id]) return this.esperando[id].p;
      let res;
      const p = new Promise((r) => (res = r));
      this.esperando[id] = { p, res };
      this.fila.push(id);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.buscar(), 30);
      return p;
    },
    async buscar() {
      const ids = this.fila.splice(0, 40);
      if (this.fila.length) this.timer = setTimeout(() => this.buscar(), 10);
      if (!ids.length) return;
      let r = {};
      try { r = await call('getImages', { ids }, { silencioso: true }); } catch (e) { r = {}; }
      ids.forEach((id) => {
        if (r[id]) this.cache[id] = r[id];
        const w = this.esperando[id];
        delete this.esperando[id];
        if (w) w.res(r[id] || null);
      });
    },
    /** Resolve <img src="drive:ID"> em qualquer parte da página */
    hidratar(root) {
      const imgs = root.querySelectorAll ? root.querySelectorAll('img[src^="drive:"]') : [];
      const lista = root.tagName === 'IMG' && String(root.getAttribute('src') || '').indexOf('drive:') === 0 ? [root] : Array.from(imgs);
      lista.forEach((img) => {
        const id = img.getAttribute('src').slice(6);
        img.setAttribute('data-drive', id);
        if (this.cache[id]) { img.src = this.cache[id]; return; }
        img.src = PIXEL;
        img.classList.add('img-loading');
        this.get(id).then((d) => { img.classList.remove('img-loading'); if (d) img.src = d; else img.alt = 'Imagem indisponível'; });
      });
    },
  };
  VG.Images = Images;
  const obs = new MutationObserver((muts) => {
    muts.forEach((m) => {
      if (m.type === 'attributes') Images.hidratar(m.target);
      else m.addedNodes.forEach((n) => { if (n.nodeType === 1) Images.hidratar(n); });
    });
  });
  const iniciarObs = () => obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  if (document.body) iniciarObs(); else document.addEventListener('DOMContentLoaded', iniciarObs);

  /** Logo em uso: personalizada (Configurações) ou a logo embutida */
  VG.logoSrc = () => {
    const l = Store.getConfig().logoDataUrl;
    if (l && l.indexOf('drive:') === 0) return Images.cache[l.slice(6)] || l;
    return l || VG.LOGO_EMBED || '';
  };
  VG.logoImg = (cls = '', alt = 'Vegas Vigilância e Segurança') => `<img src="${VG.logoSrc()}" alt="${VG.esc(alt)}" class="logo ${cls}" onerror="this.style.display='none'">`;

  VG.Store = Store;
})();
