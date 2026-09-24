/* =========================================================
   VEGAS OS — AUTENTICAÇÃO E PERMISSÕES
   ---------------------------------------------------------
   PROTÓTIPO: as senhas são guardadas como hash SHA-256 com
   "salt" por usuário, e a sessão fica no navegador.

   PARA PRODUÇÃO, substituir por:
   • POST /api/auth/login  → servidor valida (bcrypt/argon2)
     e devolve sessão em cookie httpOnly + Secure + SameSite
   • GET  /api/auth/me     → dados do usuário logado
   • POST /api/auth/logout → invalida a sessão no servidor
   • Links de OS validados no servidor (token aleatório de
     32+ bytes, com expiração e revogação)
   Nunca confie em verificações feitas só no navegador.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;

  /* SHA-256 em JavaScript puro (funciona também fora de HTTPS) */
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
  const MAX_TENTATIVAS = 5;
  const BLOQUEIO_SEG = 60;

  const Auth = {
    sha256: (s) => sha256(utf8(s)),
    hash(senha, salt) { return sha256(utf8(`${salt}::${senha}`)); },
    papelLabel: (p) => PAPEL_LABEL[p] || p,

    /** Retorna { ok, erro } — no futuro: chamada à API */
    login(usuario, senha) {
      const S = VG.Store;
      const lock = S.read('login_lock', { falhas: 0, ate: 0 });
      if (lock.ate > Date.now()) {
        const s = Math.ceil((lock.ate - Date.now()) / 1000);
        return { ok: false, erro: `Muitas tentativas. Tente novamente em ${s}s.` };
      }
      const u = S.list('users').find((x) => VG.norm(x.usuario) === VG.norm(usuario));
      const valido = u && u.ativo !== false && this.hash(senha, u.salt) === u.senhaHash;
      if (!valido) {
        const falhas = (lock.falhas || 0) + 1;
        S.write('login_lock', falhas >= MAX_TENTATIVAS ? { falhas: 0, ate: Date.now() + BLOQUEIO_SEG * 1000 } : { falhas, ate: 0 });
        return { ok: false, erro: u && u.ativo === false ? 'Este usuário está desativado.' : 'Usuário ou senha incorretos.' };
      }
      if (u.papel === 'tecnico') {
        const t = S.get('tecnicos', u.tecnicoId);
        if (!t || t.ativo === false) return { ok: false, erro: 'Este técnico está inativo. Fale com a supervisão.' };
      }
      S.write('login_lock', { falhas: 0, ate: 0 });
      const session = {
        token: VG.token(32), userId: u.id, usuario: u.usuario, nome: u.nome, papel: u.papel,
        tecnicoId: u.tecnicoId || null, criadaEm: VG.nowISO(), expiraEm: Date.now() + SESSION_HOURS * 3600 * 1000,
      };
      S.write('session', session);
      u.ultimoAcesso = VG.nowISO();
      S.save('users', u);
      return { ok: true, session };
    },

    current() {
      const s = VG.Store.read('session', null);
      if (!s) return null;
      if (Date.now() > s.expiraEm) { VG.Store.write('session', null); return null; }
      return s;
    },
    logout() { VG.Store.write('session', null); },

    can(perm) { const s = this.current(); return !!s && (PERMISSOES[s.papel] || []).includes(perm); },

    changePassword(userId, atual, nova) {
      const u = VG.Store.get('users', userId);
      if (!u) return { ok: false, erro: 'Usuário não encontrado.' };
      if (this.hash(atual, u.salt) !== u.senhaHash) return { ok: false, erro: 'A senha atual está incorreta.' };
      const v = this.validarSenha(nova);
      if (v) return { ok: false, erro: v };
      this.setPassword(u, nova);
      return { ok: true };
    },
    setPassword(u, nova) {
      u.salt = VG.token(16);
      u.senhaHash = this.hash(nova, u.salt);
      VG.Store.save('users', u);
    },
    validarSenha(s) {
      if (!s || s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
      if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return 'Use letras e números na senha.';
      return '';
    },

    /** Valida o link #/os/NUMERO/TOKEN → { os, papel } ou { erro } */
    resolveLink(numero, token) {
      const os = VG.Store.getOSByNumero(numero);
      if (!os || !token) return { erro: 'Link inválido ou Ordem de Serviço não encontrada.' };
      let papel = null;
      if (token === os.tokenTecnico) papel = 'tecnico';
      else if (token === os.tokenCliente) papel = 'cliente';
      if (!papel) return { erro: 'Este link não é mais válido. Peça um novo link à supervisão.' };
      const dias = Number(VG.Store.getConfig().validadeLinkDias) || 0;
      if (dias > 0 && os.status !== 'concluida') {
        const expira = new Date(os.criadaEm).getTime() + dias * 86400000;
        if (Date.now() > expira) return { erro: 'Este link expirou. Peça um novo link à supervisão.' };
      }
      return { os, papel };
    },
  };

  VG.Auth = Auth;
})();
