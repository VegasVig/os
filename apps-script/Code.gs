/* =========================================================================
   VEGAS OS — BACKEND (Google Apps Script)
   Vegas Vigilância e Segurança
   -------------------------------------------------------------------------
   • Banco de dados: uma Planilha Google (criada automaticamente)
       abas: Usuarios, Clientes, Tecnicos, Ordens, Atividades, Config
       cada linha = id | atualizadoEm | colunas legíveis | json (registro completo)
   • Fotos, assinaturas e logo: pasta no Google Drive (arquivos privados)
   • Sessões: token aleatório no CacheService (expira após 6 h sem uso)
   • Senhas: SHA-256 com salt individual (nunca são enviadas ao navegador)
   • Links do técnico/cliente: validados aqui no servidor, com permissões
     restritas ao que cada um pode alterar.

   INSTALAÇÃO (resumo — veja o arquivo LEIA-ME):
     1. Crie os arquivos deste projeto no Apps Script.
     2. Execute a função  instalar  uma vez e autorize.
     3. Implantar → Nova implantação → App da Web
          Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
   ========================================================================= */

const CFG = {
  PLANILHA: 'Vegas OS · Banco de Dados',
  PASTA: 'Vegas OS · Arquivos',
  SENHA_INICIAL: 'Vegas4747@!',
  SESSAO_SEG: 21600,        // 6 horas (máximo do CacheService), renovada a cada uso
  MAX_TENTATIVAS: 5,
  BLOQUEIO_SEG: 60,
  MAX_ATIVIDADES: 300,
  VERSAO_BANCO: '1',
};

const TABELAS = {
  users:      { aba: 'Usuarios',   campos: ['usuario', 'nome', 'papel', 'ativo', 'ultimoAcesso'] },
  clientes:   { aba: 'Clientes',   campos: ['codigo', 'nome', 'cpf_cnpj', 'telefone', 'email', 'cidade', 'estado', 'status'] },
  tecnicos:   { aba: 'Tecnicos',   campos: ['nome', 'usuario', 'telefone', 'email', 'especialidade', 'ativo'] },
  ordens:     { aba: 'Ordens',     campos: ['numero', 'status', 'prioridade', 'tipo', 'cliente.nome', 'tecnicoNome', 'criadaEm', 'prazoData'] },
  atividades: { aba: 'Atividades', campos: ['dataHora', 'texto', 'osId'] },
  config:     { aba: 'Config',     campos: [] },
};
const PAPEIS_SUP = ['supervisora'];

/* =========================================================================
   PÁGINA
   ========================================================================= */
function doGet(e) {
  garantirBanco_();
  // Versão GitHub: o projeto tem só o Code.gs (sem o arquivo Index) e funciona apenas como API
  try { HtmlService.createTemplateFromFile('Index'); }
  catch (err) { return ContentService.createTextOutput('API do Vegas OS ativa. Use o endereço do site (GitHub Pages) para acessar o sistema.'); }
  const p = (e && e.parameter) || {};
  const t = HtmlService.createTemplateFromFile('Index');
  t.boot = JSON.stringify({
    baseUrl: ScriptApp.getService().getUrl(),
    os: String(p.os || '').replace(/\D/g, ''),
    t: String(p.t || '').replace(/[^A-Za-z0-9]/g, ''),
  }).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle('Vegas OS · Ordens de Serviço')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/**
 * API para a versão hospedada fora do Google (ex.: GitHub Pages).
 * O navegador envia POST com o corpo em texto (JSON) e recebe texto (JSON).
 */
function doPost(e) {
  let req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: 'Requisição inválida.' })).setMimeType(ContentService.MimeType.JSON); }
  garantirBanco_();
  return ContentService.createTextOutput(api(req)).setMimeType(ContentService.MimeType.JSON);
}

function include(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

/** Execute UMA vez pelo editor (▶ Executar) para autorizar e criar o banco. */
function instalar() {
  props_().deleteProperty('DB_OK');
  const info = garantirBanco_();
  Logger.log('Banco de dados (planilha): ' + info.planilha);
  Logger.log('Pasta de arquivos (Drive): ' + info.pasta);
  Logger.log('Usuário inicial: supervisora · senha: ' + CFG.SENHA_INICIAL + ' (troque após o primeiro acesso)');
  return info;
}

/* =========================================================================
   API — ponto único chamado pelo navegador via google.script.run.api(req)
   Sempre devolve texto JSON: { ok, data } ou { ok:false, erro }
   ========================================================================= */
function api(req) {
  try {
    req = req || {};
    const fn = ACOES[req.action];
    if (!fn) throw new Error('Ação desconhecida.');
    const data = fn(req);
    return JSON.stringify({ ok: true, data: data === undefined ? null : data });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return JSON.stringify({ ok: false, erro: (err && err.message) || String(err) });
  }
}

const ACOES = {
  /* ---------- Autenticação ---------- */
  login(req) {
    const usuario = String(req.usuario || '').trim();
    const senha = String(req.senha || '');
    if (!usuario || !senha) throw new Error('Informe usuário e senha.');
    const cache = CacheService.getScriptCache();
    const key = 'lk_' + norm_(usuario);
    const lk = JSON.parse(cache.get(key) || '{"f":0}');
    if (lk.ate && lk.ate > Date.now()) throw new Error('Muitas tentativas. Tente novamente em ' + Math.ceil((lk.ate - Date.now()) / 1000) + 's.');

    const u = ler_('users').find((x) => norm_(x.usuario) === norm_(usuario));
    const valido = u && u.ativo !== false && hash_(senha, u.salt) === u.senhaHash;
    if (!valido) {
      const f = (lk.f || 0) + 1;
      cache.put(key, JSON.stringify(f >= CFG.MAX_TENTATIVAS ? { f: 0, ate: Date.now() + CFG.BLOQUEIO_SEG * 1000 } : { f: f }), 600);
      throw new Error(u && u.ativo === false ? 'Este usuário está desativado.' : 'Usuário ou senha incorretos.');
    }
    if (u.papel === 'tecnico') {
      const t = ler_('tecnicos').find((x) => x.id === u.tecnicoId);
      if (!t || t.ativo === false) throw new Error('Este técnico está inativo. Fale com a supervisão.');
    }
    cache.remove(key);
    const s = {
      token: tok_(48), userId: u.id, usuario: u.usuario, nome: u.nome, papel: u.papel,
      tecnicoId: u.tecnicoId || null, criadaEm: agora_(), geracao: props_().getProperty('SESS_GEN') || '0',
    };
    cache.put('s_' + s.token, JSON.stringify(s), CFG.SESSAO_SEG);
    comLock_(() => { u.ultimoAcesso = agora_(); upsert_('users', u); });
    return { session: s, snapshot: snapshot_(s) };
  },

  /** Tela inicial do técnico: lista pública só com os nomes dos técnicos ativos */
  listTecnicos() {
    return ler_('tecnicos').filter((t) => t.ativo !== false)
      .map((t) => ({ id: t.id, nome: t.nome, especialidade: t.especialidade || '' }))
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  },

  /** Entrada do técnico tocando no próprio nome (sem senha) */
  loginTecnico(req) {
    const t = ler_('tecnicos').find((x) => x.id === String(req.tecnicoId || ''));
    if (!t || t.ativo === false) throw new Error('Técnico não encontrado ou inativo. Fale com a supervisão.');
    let u = ler_('users').find((x) => x.papel === 'tecnico' && x.tecnicoId === t.id);
    return comLock_(() => {
      if (!u) {
        // técnico sem usuário (cadastro antigo): cria o acesso automaticamente
        const usados = {};
        ler_('users').forEach((x) => (usados[norm_(x.usuario)] = 1));
        const base = norm_(t.nome).replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'tecnico';
        let usuario = base, n = 2;
        while (usados[usuario]) usuario = base + n++;
        const salt = tok_(16);
        u = { id: tok_(16).toLowerCase(), usuario: usuario, nome: t.nome, papel: 'tecnico', tecnicoId: t.id, ativo: true, salt: salt, senhaHash: hash_(CFG.SENHA_INICIAL, salt), criadoEm: agora_() };
      }
      if (u.ativo === false) throw new Error('O acesso deste técnico está desativado. Fale com a supervisão.');
      u.ultimoAcesso = agora_();
      upsert_('users', u);
      const s = {
        token: tok_(48), userId: u.id, usuario: u.usuario, nome: t.nome, papel: 'tecnico',
        tecnicoId: t.id, criadaEm: agora_(), geracao: props_().getProperty('SESS_GEN') || '0',
      };
      CacheService.getScriptCache().put('s_' + s.token, JSON.stringify(s), CFG.SESSAO_SEG);
      return { session: s, snapshot: snapshot_(s) };
    });
  },

  logout(req) {
    if (req.token) CacheService.getScriptCache().remove('s_' + req.token);
    return true;
  },

  bootstrap(req) {
    const s = sessao_(req);
    return { session: s, snapshot: snapshot_(s) };
  },

  rev(req) {
    sessao_(req, null, true);
    return rev_();
  },

  changePassword(req) {
    const s = sessao_(req);
    return comLock_(() => {
      const u = ler_('users').find((x) => x.id === s.userId);
      if (!u) throw new Error('Usuário não encontrado.');
      if (hash_(String(req.atual || ''), u.salt) !== u.senhaHash) throw new Error('A senha atual está incorreta.');
      const nova = String(req.nova || '');
      if (nova.length < 8 || !/[A-Za-z]/.test(nova) || !/\d/.test(nova)) throw new Error('A nova senha precisa ter 8 caracteres ou mais, com letras e números.');
      u.salt = tok_(16);
      u.senhaHash = hash_(nova, u.salt);
      upsert_('users', u);
      return true;
    });
  },

  /* ---------- Dados (usuários logados) ---------- */
  save(req) {
    const s = sessao_(req);
    const col = colValida_(req.col);
    let obj = req.obj;
    if (!obj || typeof obj !== 'object') throw new Error('Registro inválido.');
    if (!obj.id) obj.id = tok_(16).toLowerCase();

    return comLock_(() => {
      if (s.papel !== 'supervisora') {
        // técnico logado: só pode atualizar o atendimento das OS dele
        if (col !== 'ordens') throw new Error('Você não tem permissão para esta ação.');
        const atual = ler_('ordens').find((o) => o.id === obj.id);
        if (!atual || atual.tecnicoId !== s.tecnicoId) throw new Error('Esta OS não está atribuída a você.');
        const antes = atual.status;
        obj = mesclarLink_(atual, obj, 'tecnico');
        obj = extrairImagens_(obj, 'OS_' + obj.numero);
        obj.atualizadoEm = agora_();
        upsert_('ordens', obj);
        logTransicao_(obj, antes);
        bump_();
        return obj;
      }
      if (col === 'config') throw new Error('Use a tela de Configurações.');
      if (col === 'users') {
        obj = mesclarSenha_(obj);
        const dup = ler_('users').find((x) => x.id !== obj.id && norm_(x.usuario) === norm_(obj.usuario));
        if (dup) throw new Error('Este usuário já está em uso.');
      }
      if (col === 'ordens') {
        const atual = ler_('ordens').find((o) => o.id === obj.id);
        if (atual) obj = mesclarSupervisao_(atual, obj);
        obj = extrairImagens_(obj, 'OS_' + obj.numero);
      }
      obj.atualizadoEm = agora_();
      upsert_(col, obj);
      bump_();
      return col === 'users' ? semSenha_(obj) : obj;
    });
  },

  saveMany(req) {
    sessao_(req, PAPEIS_SUP);
    const col = colValida_(req.col);
    if (['users', 'config'].indexOf(col) >= 0) throw new Error('Operação não permitida.');
    const itens = Array.isArray(req.items) ? req.items : [];
    return comLock_(() => {
      const mapa = {};
      ler_(col).forEach((x) => (mapa[x.id] = x));
      itens.forEach((x) => { if (!x.id) x.id = tok_(16).toLowerCase(); x.atualizadoEm = agora_(); mapa[x.id] = x; });
      substituirTudo_(col, Object.keys(mapa).map((k) => mapa[k]));
      bump_();
      return itens.length;
    });
  },

  remove(req) {
    sessao_(req, PAPEIS_SUP);
    const col = colValida_(req.col);
    return comLock_(() => { remover_(col, String(req.id)); bump_(); return true; });
  },

  /** Cadastro em lote de técnicos com usuário e senha (lista CSV) */
  importTecnicos(req) {
    sessao_(req, PAPEIS_SUP);
    const itens = Array.isArray(req.items) ? req.items.slice(0, 500) : [];
    if (!itens.length) throw new Error('Nenhum técnico para importar.');
    return comLock_(() => {
      const users = ler_('users');
      const usados = {};
      users.forEach((u) => (usados[norm_(u.usuario)] = 1));
      const novosT = [], novosU = [];
      itens.forEach((it, i) => {
        const nome = String(it.nome || '').trim();
        const usuario = norm_(it.usuario).replace(/[^a-z0-9._-]/g, '');
        if (!nome) throw new Error('Linha ' + (i + 1) + ': nome em branco.');
        if (usuario.length < 3) throw new Error('Linha ' + (i + 1) + ': usuário inválido.');
        if (usados[usuario]) throw new Error('O usuário "' + usuario + '" já existe. Nada foi importado.');
        usados[usuario] = 1;
        const senha = String(it.senha || '') || CFG.SENHA_INICIAL;
        if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) throw new Error('Linha ' + (i + 1) + ': a senha precisa ter 8 caracteres ou mais, com letras e números.');
        const t = {
          id: tok_(16).toLowerCase(), nome: nome, usuario: usuario, telefone: String(it.telefone || '').replace(/\D/g, ''),
          email: String(it.email || '').trim(), especialidade: String(it.especialidade || '').trim(), ativo: true,
          criadoEm: agora_(), atualizadoEm: agora_(),
        };
        const salt = tok_(16);
        const u = {
          id: tok_(16).toLowerCase(), usuario: usuario, nome: nome, papel: 'tecnico', tecnicoId: t.id, ativo: true,
          salt: salt, senhaHash: hash_(senha, salt), criadoEm: agora_(), atualizadoEm: agora_(),
        };
        novosT.push(t); novosU.push(u);
      });
      substituirTudo_('tecnicos', ler_('tecnicos').concat(novosT));
      substituirTudo_('users', users.concat(novosU));
      registrarAtividade_(novosT.length + ' técnicos importados via CSV', null, 'users');
      bump_();
      return { tecnicos: novosT, users: novosU.map(semSenha_) };
    });
  },

  createOS(req) {
    const s = sessao_(req, PAPEIS_SUP);
    const os = req.os;
    if (!os || !os.clienteId) throw new Error('Dados da OS incompletos.');
    return comLock_(() => {
      const cfg = config_();
      const maior = ler_('ordens').reduce((m, o) => Math.max(m, Number(o.numero) || 0), Number(cfg.ultimoNumeroOS) || 1000);
      os.id = os.id || tok_(16).toLowerCase();
      os.numero = maior + 1;
      os.tokenTecnico = tok_(12);
      os.tokenCliente = tok_(12);
      os.criadaEm = os.criadaEm || agora_();
      os.criadaPor = os.criadaPor || s.nome;
      os.atualizadoEm = agora_();
      upsert_('ordens', extrairImagens_(os, 'OS_' + os.numero));
      cfg.ultimoNumeroOS = os.numero;
      salvarConfig_(cfg);
      bump_();
      return os;
    });
  },

  log(req) {
    sessao_(req);
    const e = req.entry || {};
    return comLock_(() => {
      registrarAtividade_(String(e.texto || '').slice(0, 300), e.osId || null, e.icon || 'activity');
      bump_();
      return true;
    });
  },

  setConfig(req) {
    sessao_(req, PAPEIS_SUP);
    const patch = req.patch || {};
    return comLock_(() => {
      let cfg = Object.assign(config_(), patch);
      cfg = extrairImagens_(cfg, 'Logo');
      salvarConfig_(cfg);
      bump_();
      return publicoConfig_(cfg, true);
    });
  },

  importAll(req) {
    sessao_(req, PAPEIS_SUP);
    const d = req.data || {};
    if (d.app !== 'vegas-os') throw new Error('Arquivo de backup inválido.');
    const users = Array.isArray(d.users) ? d.users : [];
    if (!users.some((u) => u.papel === 'supervisora' && u.ativo !== false && u.senhaHash)) {
      throw new Error('O backup precisa ter ao menos um usuário supervisora com senha.');
    }
    return comLock_(() => {
      substituirTudo_('users', users);
      ['clientes', 'tecnicos', 'atividades'].forEach((c) => substituirTudo_(c, Array.isArray(d[c]) ? d[c] : []));
      substituirTudo_('ordens', (Array.isArray(d.ordens) ? d.ordens : []).map((o) => extrairImagens_(o, 'OS_' + o.numero)));
      salvarConfig_(extrairImagens_(Object.assign({}, d.config || {}), 'Logo'));
      invalidarSessoes_();
      bump_();
      return true;
    });
  },

  resetAll(req) {
    sessao_(req, PAPEIS_SUP);
    return comLock_(() => {
      Object.keys(TABELAS).forEach((c) => substituirTudo_(c, []));
      criarSupervisora_();
      invalidarSessoes_();
      bump_();
      return true;
    });
  },

  /* ---------- Links exclusivos (sem login) ---------- */
  resolveLink(req) {
    const r = resolverLink_(req.numero, req.t);
    const os = JSON.parse(JSON.stringify(r.os));
    if (r.papel === 'cliente') os.tokenTecnico = '';
    return { os: os, papel: r.papel, config: publicoConfig_(config_(), false) };
  },

  savePublic(req) {
    const r = resolverLink_(req.numero, req.t);
    return comLock_(() => {
      const atual = ler_('ordens').find((o) => o.id === r.os.id);
      const antes = atual.status;
      let obj = mesclarLink_(atual, req.obj || {}, r.papel);
      obj = extrairImagens_(obj, 'OS_' + obj.numero);
      obj.atualizadoEm = agora_();
      upsert_('ordens', obj);
      logTransicao_(obj, antes);
      bump_();
      const out = JSON.parse(JSON.stringify(obj));
      if (r.papel === 'cliente') out.tokenTecnico = '';
      return out;
    });
  },

  /* ---------- Imagens (Drive) ---------- */
  getImages(req) {
    const ids = (Array.isArray(req.ids) ? req.ids : []).slice(0, 40).map(String);
    let permitido = null; // null = todos (usuário logado)
    if (req.token) sessao_(req);
    else {
      const r = resolverLink_(req.numero, req.t);
      permitido = JSON.stringify(r.os) + JSON.stringify(config_());
    }
    const out = {};
    ids.forEach((id) => {
      if (!/^[\w-]{10,}$/.test(id)) return;
      if (permitido !== null && permitido.indexOf('drive:' + id) < 0) return;
      try {
        const blob = DriveApp.getFileById(id).getBlob();
        out[id] = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
      } catch (e) { out[id] = null; }
    });
    return out;
  },
};

/* =========================================================================
   REGRAS DE NEGÓCIO
   ========================================================================= */

/** Aplica somente o que o técnico/cliente pode alterar pelo link */
function mesclarLink_(atual, novo, papel) {
  const st = atual.status;
  if (st === 'cancelada') throw new Error('Esta OS foi cancelada.');
  if (papel === 'tecnico') {
    if (['aberta', 'aguardando_tecnico', 'em_atendimento'].indexOf(st) < 0) {
      throw new Error('Este atendimento já foi finalizado e não pode mais ser alterado pelo técnico.');
    }
    const permitidos = [st, 'em_atendimento', 'aguardando_cliente'];
    if (permitidos.indexOf(novo.status) < 0) throw new Error('Mudança de status não permitida.');
    if (novo.status === 'aguardando_cliente' && !(novo.assinaturaTecnico && novo.assinaturaTecnico.imagem)) {
      throw new Error('A assinatura do técnico é obrigatória para finalizar.');
    }
    if (novo.atendimento) atual.atendimento = novo.atendimento;
    if (novo.assinaturaTecnico) atual.assinaturaTecnico = novo.assinaturaTecnico;
    atual.status = novo.status;
  } else if (papel === 'cliente') {
    if (st !== 'aguardando_cliente') throw new Error('Esta OS não está aguardando assinatura.');
    if (novo.status !== 'concluida' || !(novo.assinaturaCliente && novo.assinaturaCliente.imagem && novo.assinaturaCliente.nome)) {
      throw new Error('Assinatura do cliente não recebida.');
    }
    atual.assinaturaCliente = novo.assinaturaCliente;
    atual.status = 'concluida';
  } else {
    throw new Error('Acesso negado.');
  }
  // histórico: só acrescenta (nunca apaga o que já existe)
  const h = atual.historico || [];
  if (Array.isArray(novo.historico) && novo.historico.length > h.length) {
    atual.historico = h.concat(novo.historico.slice(h.length).slice(0, 20).map((x) => ({
      dataHora: String(x.dataHora || agora_()), texto: String(x.texto || '').slice(0, 500), autor: String(x.autor || '').slice(0, 120),
    })));
  }
  return atual;
}

/**
 * A supervisora edita dados cadastrais da OS, mas o atendimento pertence ao
 * técnico e ao cliente: preserva sempre a versão do servidor desses campos,
 * para que uma tela desatualizada nunca apague o trabalho feito em campo.
 */
function mesclarSupervisao_(atual, novo) {
  const ordem = { aberta: 0, aguardando_tecnico: 0, em_atendimento: 1, aguardando_cliente: 2, concluida: 3 };
  ['atendimento', 'assinaturaTecnico', 'assinaturaCliente', 'tokenCliente', 'criadaEm', 'numero'].forEach((k) => {
    if (atual[k] !== undefined) novo[k] = atual[k];
  });
  if (atual.status === 'concluida' || atual.status === 'cancelada') novo.status = atual.status;
  else if (novo.status !== 'cancelada' && (ordem[novo.status] || 0) < (ordem[atual.status] || 0)) novo.status = atual.status;
  // histórico: une as duas versões sem duplicar
  const visto = {};
  const h = [];
  (atual.historico || []).concat(novo.historico || []).forEach((x) => {
    const k = x.dataHora + '|' + x.texto;
    if (!visto[k]) { visto[k] = 1; h.push(x); }
  });
  novo.historico = h.sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)));
  return novo;
}

function logTransicao_(os, antes) {
  if (os.status === antes) return;
  const pnome = String(os.tecnicoNome || 'Técnico').split(' ')[0];
  if (os.status === 'em_atendimento') registrarAtividade_('Técnico ' + pnome + ' iniciou a OS #' + os.numero, os.id, 'play');
  if (os.status === 'aguardando_cliente') registrarAtividade_('OS #' + os.numero + ' finalizada', os.id, 'check');
  if (os.status === 'concluida') {
    registrarAtividade_('Cliente assinou OS #' + os.numero, os.id, 'pen');
    registrarAtividade_('OS #' + os.numero + ' concluída', os.id, 'check');
  }
}

function resolverLink_(numero, token) {
  numero = String(numero || '').replace(/\D/g, '');
  token = String(token || '');
  const os = ler_('ordens').find((o) => String(o.numero) === numero);
  if (!os || !token) throw new Error('Link inválido ou Ordem de Serviço não encontrada.');
  let papel = null;
  if (token === os.tokenTecnico) papel = 'tecnico';
  else if (token === os.tokenCliente) papel = 'cliente';
  if (!papel) throw new Error('Este link não é mais válido. Peça um novo link à supervisão.');
  const dias = Number(config_().validadeLinkDias) || 0;
  if (dias > 0 && os.status !== 'concluida' && Date.now() > new Date(os.criadaEm).getTime() + dias * 86400000) {
    throw new Error('Este link expirou. Peça um novo link à supervisão.');
  }
  return { os: os, papel: papel };
}

function snapshot_(s) {
  const cfg = config_();
  const out = { rev: rev_(), atividades: [], users: [], clientes: [], tecnicos: [], ordens: [] };
  if (s.papel === 'supervisora') {
    out.users = ler_('users').map(semSenha_);
    out.clientes = ler_('clientes');
    out.tecnicos = ler_('tecnicos');
    out.ordens = ler_('ordens');
    out.atividades = ultimasAtividades_(60);
    out.config = publicoConfig_(cfg, true);
  } else {
    out.tecnicos = ler_('tecnicos').filter((t) => t.id === s.tecnicoId);
    out.ordens = ler_('ordens').filter((o) => o.tecnicoId === s.tecnicoId);
    out.config = publicoConfig_(cfg, false);
  }
  return out;
}

function publicoConfig_(cfg, completo) {
  const c = {
    empresa: cfg.empresa || {}, validadeLinkDias: cfg.validadeLinkDias || 0,
    logoDataUrl: cfg.logoDataUrl || '', ultimoNumeroOS: cfg.ultimoNumeroOS || 1000,
  };
  if (completo) {
    c._planilhaUrl = banco_().getUrl();
    c._pastaUrl = pasta_().getUrl();
  }
  return c;
}

function registrarAtividade_(texto, osId, icon) {
  const a = { id: tok_(16).toLowerCase(), dataHora: agora_(), texto: texto, osId: osId || null, icon: icon || 'activity' };
  aba_('atividades').appendRow(linha_('atividades', a));
  delete MEMO_[ 'atividades' ];
  const sh = aba_('atividades');
  const excesso = sh.getLastRow() - 1 - CFG.MAX_ATIVIDADES;
  if (excesso > 50) sh.deleteRows(2, excesso); // linhas mais antigas ficam no topo
}

function ultimasAtividades_(n) {
  return ler_('atividades').sort((a, b) => String(b.dataHora).localeCompare(String(a.dataHora))).slice(0, n);
}

/* =========================================================================
   SESSÃO E SENHAS
   ========================================================================= */
function sessao_(req, papeis, leve) {
  const tok = String((req && req.token) || '');
  const cache = CacheService.getScriptCache();
  const raw = tok ? cache.get('s_' + tok) : null;
  if (!raw) throw new Error('SESSAO: Sua sessão expirou. Entre novamente.');
  const s = JSON.parse(raw);
  if (String(s.geracao) !== String(props_().getProperty('SESS_GEN') || '0')) {
    throw new Error('SESSAO: Sua sessão expirou. Entre novamente.');
  }
  if (!leve) {
    const u = ler_('users').find((x) => x.id === s.userId);
    if (!u || u.ativo === false) { cache.remove('s_' + tok); throw new Error('SESSAO: Seu acesso foi desativado.'); }
  }
  cache.put('s_' + tok, raw, CFG.SESSAO_SEG); // renova
  if (papeis && papeis.indexOf(s.papel) < 0) throw new Error('Você não tem permissão para esta ação.');
  return s;
}

/** Após importar/restaurar o banco, todas as sessões antigas deixam de valer */
function invalidarSessoes_() {
  props_().setProperty('SESS_GEN', String(Date.now()));
}

function hash_(senha, salt) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + '::' + String(senha), Utilities.Charset.UTF_8)
    .map((b) => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function semSenha_(u) {
  const c = Object.assign({}, u);
  delete c.senhaHash; delete c.salt;
  return c;
}

/** Ao salvar um usuário sem senha nova, mantém a senha atual */
function mesclarSenha_(u) {
  if (u.senhaHash && u.salt) return u;
  const atual = ler_('users').find((x) => x.id === u.id);
  if (atual) { u.senhaHash = atual.senhaHash; u.salt = atual.salt; return u; }
  u.salt = tok_(16);
  u.senhaHash = hash_(CFG.SENHA_INICIAL, u.salt);
  return u;
}

function criarSupervisora_() {
  const salt = tok_(16);
  upsert_('users', {
    id: tok_(16).toLowerCase(), usuario: 'supervisora', nome: 'Supervisora', papel: 'supervisora', ativo: true,
    salt: salt, senhaHash: hash_(CFG.SENHA_INICIAL, salt), criadoEm: agora_(),
  });
}

/* =========================================================================
   PLANILHA (banco de dados)
   ========================================================================= */
let SS_ = null;
let MEMO_ = {};

function props_() { return PropertiesService.getScriptProperties(); }

function banco_() {
  if (SS_) return SS_;
  const id = props_().getProperty('DB_ID');
  if (id) { try { SS_ = SpreadsheetApp.openById(id); return SS_; } catch (e) { /* recria abaixo */ } }
  garantirBanco_(true);
  return SS_;
}

function garantirBanco_(forcar) {
  const pr = props_();
  if (!forcar && pr.getProperty('DB_OK') === CFG.VERSAO_BANCO && pr.getProperty('DB_ID')) {
    return { planilha: 'https://docs.google.com/spreadsheets/d/' + pr.getProperty('DB_ID'), pasta: '' };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let id = pr.getProperty('DB_ID');
    if (id) { try { SS_ = SpreadsheetApp.openById(id); } catch (e) { SS_ = null; } }
    if (!SS_) {
      SS_ = SpreadsheetApp.create(CFG.PLANILHA);
      pr.setProperty('DB_ID', SS_.getId());
    }
    Object.keys(TABELAS).forEach((c) => aba_(c));
    // remove a aba padrão vazia
    SS_.getSheets().forEach((sh) => {
      const nomes = Object.keys(TABELAS).map((c) => TABELAS[c].aba);
      if (nomes.indexOf(sh.getName()) < 0 && sh.getLastRow() === 0 && SS_.getSheets().length > 1) SS_.deleteSheet(sh);
    });
    if (!ler_('users').length) criarSupervisora_();
    const pasta = pasta_();
    pr.setProperty('DB_OK', CFG.VERSAO_BANCO);
    return { planilha: SS_.getUrl(), pasta: pasta.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

function cabecalho_(col) { return ['id', 'atualizadoEm'].concat(TABELAS[col].campos, ['json']); }

function aba_(col) {
  const t = TABELAS[col];
  const ss = SS_ || banco_();
  let sh = ss.getSheetByName(t.aba);
  if (!sh) {
    sh = ss.insertSheet(t.aba);
    const h = cabecalho_(col);
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#111418').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function ler_(col) {
  if (MEMO_[col]) return MEMO_[col];
  const sh = aba_(col);
  const n = sh.getLastRow();
  const out = [];
  if (n > 1) {
    const w = cabecalho_(col).length;
    sh.getRange(2, 1, n - 1, w).getValues().forEach((r) => {
      if (!r[0]) return;
      try { out.push(JSON.parse(r[w - 1])); } catch (e) { /* linha corrompida é ignorada */ }
    });
  }
  MEMO_[col] = out;
  return out;
}

function valor_(obj, caminho) {
  let v = caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'object') return '';
  v = String(v);
  // evita que a planilha interprete textos como fórmula ou número (zeros à esquerda)
  if (/^[=+\-@]/.test(v) || /^\d{5,}$/.test(v)) v = "'" + v;
  return v.slice(0, 1000);
}

function linha_(col, obj) {
  const json = JSON.stringify(obj);
  if (json.length > 49000) throw new Error('Registro grande demais para a planilha. Reduza os textos desta OS.');
  return [obj.id, obj.atualizadoEm || agora_()].concat(TABELAS[col].campos.map((c) => valor_(obj, c)), [json]);
}

function upsert_(col, obj) {
  const sh = aba_(col);
  const n = sh.getLastRow();
  const row = linha_(col, obj);
  let idx = -1;
  if (n > 1) {
    const ids = sh.getRange(2, 1, n - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(obj.id)) { idx = i; break; }
  }
  if (idx >= 0) sh.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  delete MEMO_[col];
}

function remover_(col, id) {
  const sh = aba_(col);
  const n = sh.getLastRow();
  if (n < 2) return;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === id) sh.deleteRow(i + 2);
  delete MEMO_[col];
}

function substituirTudo_(col, lista) {
  const sh = aba_(col);
  const h = cabecalho_(col);
  const n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, Math.max(h.length, sh.getLastColumn())).clearContent();
  if (lista.length) sh.getRange(2, 1, lista.length, h.length).setValues(lista.map((o) => linha_(col, o)));
  if (n > lista.length + 1) sh.deleteRows(lista.length + 2, n - lista.length - 1);
  delete MEMO_[col];
}

function config_() {
  const c = ler_('config').find((x) => x.id === 'config');
  return c ? Object.assign({}, c.valor || {}) : {};
}

function salvarConfig_(cfg) {
  const limpo = {};
  Object.keys(cfg).forEach((k) => { if (k.charAt(0) !== '_') limpo[k] = cfg[k]; });
  upsert_('config', { id: 'config', atualizadoEm: agora_(), valor: limpo });
}

function colValida_(col) {
  if (!TABELAS[col]) throw new Error('Coleção inválida.');
  return col;
}

function rev_() { return Number(props_().getProperty('REV') || 0); }
function bump_() { props_().setProperty('REV', String(rev_() + 1)); }

function comLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { MEMO_ = {}; return fn(); }
  finally { lock.releaseLock(); }
}

/* =========================================================================
   DRIVE (fotos, assinaturas e logo)
   ========================================================================= */
function pasta_() {
  const pr = props_();
  const id = pr.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recria */ } }
  const f = DriveApp.createFolder(CFG.PASTA);
  pr.setProperty('FOLDER_ID', f.getId());
  return f;
}

function subpasta_(nome) {
  const raiz = pasta_();
  const it = raiz.getFoldersByName(nome);
  return it.hasNext() ? it.next() : raiz.createFolder(nome);
}

/** Troca imagens base64 (data:image/...) por referências "drive:ID" */
function extrairImagens_(obj, pastaNome) {
  let pasta = null;
  let seq = 0;
  const walk = (v) => {
    if (typeof v === 'string') {
      if (v.indexOf('data:image/') === 0 && v.length > 80) {
        const m = v.match(/^data:(image\/[\w.+-]+);base64,(.*)$/);
        if (!m) return v;
        pasta = pasta || subpasta_(pastaNome);
        const ext = m[1].indexOf('png') >= 0 ? 'png' : m[1].indexOf('svg') >= 0 ? 'svg' : 'jpg';
        const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], pastaNome + '_' + Date.now() + '_' + (seq++) + '.' + ext);
        return 'drive:' + pasta.createFile(blob).getId();
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { Object.keys(v).forEach((k) => (v[k] = walk(v[k]))); return v; }
    return v;
  };
  return walk(obj);
}

/* =========================================================================
   UTILITÁRIOS
   ========================================================================= */
function agora_() { return new Date().toISOString(); }

function norm_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function tok_(n) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let hex = '';
  while (hex.length < n * 2) hex += Utilities.getUuid().replace(/-/g, '');
  let out = '';
  for (let i = 0; i < n; i++) out += chars.charAt(parseInt(hex.substr(i * 2, 2), 16) % chars.length);
  return out;
}
