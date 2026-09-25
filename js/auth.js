/* =========================================================
   VEGAS OS — AUTENTICAÇÃO (versão Google Apps Script)
   A senha é conferida no servidor (Code.gs). O navegador
   guarda apenas o token de sessão, que expira no servidor.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;

  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    const maxWord = Math.pow(2, 32);
    let result = '';
    const words = [];
    const bitLen = ascii.length * 8;
    let hash = [], k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    ascii += '\x80';
    while ((ascii.length % 64) - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (bitLen / maxWord) | 0;
    words[words.length] = bitLen;
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash;
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
    }
    return result;
  }
  const utf8 = (s) => unescape(encodeURIComponent(s));

  const PERMISSOES = {
    supervisora: ['dashboard', 'os.criar', 'os.editar', 'os.cancelar', 'os.todas', 'clientes', 'clientes.importar', 'tecnicos', 'links', 'pdf', 'relatorios', 'config', 'historico'],
    tecnico: ['os.proprias', 'atendimento', 'pdf', 'historico'],
    cliente: ['os.link'],
  };
  const PAPEL_LABEL = { supervisora: 'Supervisora', tecnico: 'Técnico', cliente: 'Cliente' };
  const SESSION_HOURS = 10;

  const Auth = {
    sha256: (s) => sha256(utf8(s)),
    /** mesmo cálculo do servidor: SHA-256( salt + '::' + senha ) */
    hash(senha, salt) { return sha256(utf8(`${salt}::${senha}`)); },
    papelLabel: (p) => PAPEL_LABEL[p] || p,

    async login(usuario, senha) {
      try {
        VG.Store.setPublic(null);
        const r = await VG.Store.call('login', { usuario, senha }, { semCredencial: true, silencioso: true });
        const session = Object.assign({}, r.session, { expiraEm: Date.now() + SESSION_HOURS * 3600 * 1000 });
        VG.Store.write('session', session);
        VG.Store.load(r.snapshot);
        return { ok: true, session };
      } catch (e) {
        return { ok: false, erro: e.message };
      }
    },

    /** Nomes dos técnicos ativos para a tela de entrada */
    listTecnicos() {
      return VG.Store.call('listTecnicos', {}, { semCredencial: true, silencioso: true });
    },

    /** Técnico entra tocando no próprio nome */
    async loginTecnico(tecnicoId, opts) {
      try {
        VG.Store.setPublic(null);
        const r = await VG.Store.call('loginTecnico', { tecnicoId }, { semCredencial: true, silencioso: true });
        const session = Object.assign({}, r.session, { expiraEm: Date.now() + 30 * 24 * 3600 * 1000 });
        VG.Store.write('session', session);
        VG.Store.write('last_tecnico', { id: r.session.tecnicoId, nome: r.session.nome });
        if (!(opts && opts.manterDados)) VG.Store.load(r.snapshot);
        return { ok: true, session };
      } catch (e) {
        return { ok: false, erro: e.message };
      }
    },

    /** Recarrega os dados do servidor usando a sessão salva */
    async restore() {
      const s = this.current();
      if (!s) return false;
      try {
        const r = await VG.Store.call('bootstrap', { token: s.token }, { semCredencial: true, silencioso: true });
        VG.Store.load(r.snapshot);
        return true;
      } catch (e) {
        if (/sess|acesso/i.test(e.message)) VG.Store.write('session', null);
        throw e;
      }
    },

    current() {
      const s = VG.Store.read('session', null);
      if (!s) return null;
      if (Date.now() > s.expiraEm) { VG.Store.write('session', null); return null; }
      return s;
    },
    logout() {
      const s = VG.Store.read('session', null);
      if (s) VG.Store.call('logout', { token: s.token }, { semCredencial: true, silencioso: true }).catch(() => {});
      VG.Store.write('session', null);
      VG.Store.clear();
    },

    can(perm) { const s = this.current(); return !!s && (PERMISSOES[s.papel] || []).includes(perm); },

    async changePassword(userId, atual, nova) {
      const v = this.validarSenha(nova);
      if (v) return { ok: false, erro: v };
      try { await VG.Store.call('changePassword', { atual, nova }); return { ok: true }; }
      catch (e) { return { ok: false, erro: e.message }; }
    },
    /** Define a senha de outro usuário (tela de Técnicos). O hash vai para o servidor. */
    setPassword(u, nova) {
      u.salt = VG.token(16);
      u.senhaHash = this.hash(nova, u.salt);
      VG.Store.save('users', u);
      // depois de gravado, não mantém o hash em memória
      VG.Store.flush(u.id).then(() => { delete u.senhaHash; delete u.salt; }).catch(() => {});
    },
    validarSenha(s) {
      if (!s || s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
      if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return 'Use letras e números na senha.';
      return '';
    },

    /** Valida o link ?os=NUMERO&t=TOKEN no servidor → { os, papel } ou { erro } */
    async resolveLink(numero, token) {
      try {
        VG.Store.setPublic({ numero: String(numero), t: String(token) });
        const r = await VG.Store.call('resolveLink', {});
        const existente = this.current() && VG.Store.get('ordens', r.os.id);
        if (existente) Object.assign(existente, r.os, { tokenTecnico: existente.tokenTecnico || r.os.tokenTecnico });
        else if (this.current()) VG.Store.put('ordens', r.os);
        else { VG.Store.load({ ordens: [r.os], config: r.config }); }
        return { os: VG.Store.get('ordens', r.os.id), papel: r.papel };
      } catch (e) {
        VG.Store.setPublic(null);
        return { erro: e.message };
      }
    },
  };

  VG.Auth = Auth;
})();
