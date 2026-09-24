/* =========================================================
   VEGAS OS — ARMAZENAMENTO
   ---------------------------------------------------------
   Camada única de acesso a dados. Hoje usa localStorage.
   Para migrar para uma API/banco real, substitua apenas as
   funções deste arquivo (list/get/save/remove/...) por
   chamadas HTTP — as telas não acessam localStorage direto.

   Exemplo futuro:
     list('ordens')      → GET    /api/ordens
     save('ordens', os)  → PUT    /api/ordens/:id
     remove('clientes',id)→ DELETE /api/clientes/:id

   ATENÇÃO: localStorage NÃO é seguro para produção.
   Os dados ficam apenas neste navegador e podem ser lidos
   por qualquer pessoa com acesso ao dispositivo.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;
  const PREFIX = 'vegas_os_';
  const SCHEMA_VERSION = 1;

  const DEFAULT_CONFIG = {
    empresa: {
      nome: 'Vegas Vigilância e Segurança',
      cnpj: '',
      telefone: '',
      email: '',
      endereco: '',
      site: '',
    },
    ultimoNumeroOS: 1000,
    validadeLinkDias: 0, // 0 = links sem expiração
    logoDataUrl: null,   // logo personalizada (sobrepõe /assets/logo.png)
  };

  const Store = {
    read(key, def) {
      try { const v = localStorage.getItem(PREFIX + key); return v == null ? def : JSON.parse(v); }
      catch (e) { return def; }
    },
    write(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) {
        VG.toast('O espaço de armazenamento do navegador está cheio. Remova fotos antigas ou faça um backup e limpe os dados.', 'error', 6000);
        throw e;
      }
    },

    /* ----- Coleções ----- */
    list(col) { return this.read(col, []); },
    get(col, id) { return this.list(col).find((x) => x.id === id) || null; },
    save(col, obj) {
      const arr = this.list(col);
      if (!obj.id) obj.id = VG.uid();
      obj.atualizadoEm = VG.nowISO();
      const i = arr.findIndex((x) => x.id === obj.id);
      if (i >= 0) arr[i] = obj; else arr.push(obj);
      this.write(col, arr);
      return obj;
    },
    saveMany(col, items) {
      const arr = this.list(col);
      items.forEach((obj) => { if (!obj.id) obj.id = VG.uid(); obj.atualizadoEm = VG.nowISO(); arr.push(obj); });
      this.write(col, arr);
    },
    remove(col, id) { this.write(col, this.list(col).filter((x) => x.id !== id)); },

    /* ----- Ordens de serviço ----- */
    getOSByNumero(numero) { return this.list('ordens').find((o) => String(o.numero) === String(numero)) || null; },
    nextOSNumber() {
      const cfg = this.getConfig();
      const max = Math.max(cfg.ultimoNumeroOS || 1000, ...this.list('ordens').map((o) => Number(o.numero) || 0));
      this.setConfig({ ultimoNumeroOS: max + 1 });
      return max + 1;
    },
    /** Acrescenta um evento ao histórico da OS (não salva sozinho) */
    hist(os, texto, autor) {
      os.historico = os.historico || [];
      os.historico.push({ dataHora: VG.nowISO(), texto, autor: autor || '' });
    },

    /* ----- Atividade recente ----- */
    log(texto, osId, icon = 'activity') {
      const a = this.list('atividades');
      a.unshift({ id: VG.uid(), dataHora: VG.nowISO(), texto, osId: osId || null, icon });
      this.write('atividades', a.slice(0, 150));
    },

    /* ----- Configurações ----- */
    getConfig() {
      const c = this.read('config', {});
      return Object.assign({}, DEFAULT_CONFIG, c, { empresa: Object.assign({}, DEFAULT_CONFIG.empresa, c.empresa || {}) });
    },
    setConfig(patch) { this.write('config', Object.assign(this.getConfig(), patch)); },

    /* ----- Preferências (tema) ----- */
    getTheme() { try { return localStorage.getItem(PREFIX + 'theme') || 'dark'; } catch (e) { return 'dark'; } },
    setTheme(t) { try { localStorage.setItem(PREFIX + 'theme', t); } catch (e) {} },

    /* ----- Utilidades ----- */
    usageKB() {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) total += (localStorage.getItem(k) || '').length * 2;
      }
      return Math.round(total / 1024);
    },
    exportAll() {
      const data = { app: 'vegas-os', versao: SCHEMA_VERSION, exportadoEm: VG.nowISO() };
      ['users', 'clientes', 'tecnicos', 'ordens', 'atividades', 'config'].forEach((k) => (data[k] = this.read(k, null)));
      return data;
    },
    importAll(data) {
      if (!data || data.app !== 'vegas-os') throw new Error('Arquivo de backup inválido.');
      ['users', 'clientes', 'tecnicos', 'ordens', 'atividades', 'config'].forEach((k) => { if (data[k] != null) this.write(k, data[k]); });
      this.write('seeded', true);
    },
    resetAll() {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && k !== PREFIX + 'theme') keys.push(k); }
      keys.forEach((k) => localStorage.removeItem(k));
    },

    /* ----- Dados de demonstração ----- */
    ensureSeed() {
      if (this.read('seeded', false)) return;
      seedDemo(this);
      this.write('seeded', true);
      this.write('schema', SCHEMA_VERSION);
    },
  };

  /** Logo em uso: personalizada (Configurações) ou /assets/logo.png */
  VG.logoSrc = () => Store.getConfig().logoDataUrl || 'assets/logo.png';
  VG.logoImg = (cls = '', alt = 'Vegas Vigilância e Segurança') => `<img src="${VG.logoSrc()}" alt="${VG.esc(alt)}" class="logo ${cls}" onerror="this.style.display='none'">`;

  /* =========================================================
     SEED — dados fictícios para testar o sistema
     ========================================================= */
  function fakeSignature(name) {
    try {
      const c = document.createElement('canvas');
      c.width = 520; c.height = 170;
      const ctx = c.getContext && c.getContext('2d');
      if (!ctx) return null;
      ctx.strokeStyle = '#101216'; ctx.fillStyle = '#101216';
      ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.font = 'italic 50px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive';
      ctx.fillText(name.split(' ').slice(0, 2).join(' '), 34, 100);
      ctx.beginPath(); ctx.moveTo(30, 122);
      for (let x = 30; x <= 470; x += 20) ctx.quadraticCurveTo(x + 10, 118 + Math.sin(x / 25) * 8, x + 20, 124);
      ctx.stroke();
      return c.toDataURL('image/png');
    } catch (e) { return null; }
  }
  function fakePhoto(label, tone) {
    try {
      const c = document.createElement('canvas');
      c.width = 640; c.height = 480;
      const ctx = c.getContext && c.getContext('2d');
      if (!ctx) return null;
      const g = ctx.createLinearGradient(0, 0, 640, 480);
      g.addColorStop(0, tone ? '#3b4148' : '#1d2024'); g.addColorStop(1, tone ? '#9aa1aa' : '#4a5058');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 480);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 6;
      ctx.strokeRect(250, 170, 140, 100); ctx.beginPath(); ctx.arc(320, 220, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '600 30px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, 320, 340);
      ctx.font = '18px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.fillText('Foto de demonstração', 320, 372);
      return c.toDataURL('image/jpeg', 0.7);
    } catch (e) { return null; }
  }

  function seedDemo(S) {
    const Auth = VG.Auth;
    const now = new Date();
    const at = (daysAgo, h, m) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.toISOString(); };
    const addMin = (iso, min) => new Date(new Date(iso).getTime() + min * 60000).toISOString();
    const inputDate = (daysAgo) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); return VG.toInputDate(d); };

    /* ----- Técnicos ----- */
    const tecnicos = [
      { nome: 'João Pereira',     usuario: 'joao',   telefone: '21987654321', email: 'joao@vegas.local',   especialidade: 'CFTV e redes' },
      { nome: 'Marcos Silva',     usuario: 'marcos', telefone: '21976543210', email: 'marcos@vegas.local', especialidade: 'Alarmes e cercas elétricas' },
      { nome: 'Rafael Costa',     usuario: 'rafael', telefone: '21965432109', email: 'rafael@vegas.local', especialidade: 'Controle de acesso' },
      { nome: 'Bruno Nascimento', usuario: 'bruno',  telefone: '21954321098', email: 'bruno@vegas.local',  especialidade: 'Portões e interfonia' },
    ].map((t) => ({ id: VG.uid(), ativo: true, criadoEm: at(90, 9, 0), ...t }));
    S.write('tecnicos', tecnicos);

    /* ----- Usuários (senha inicial do protótipo) ----- */
    const senhaInicial = 'Vegas4747@!';
    const users = [
      { id: VG.uid(), usuario: 'supervisora', nome: 'Supervisora', papel: 'supervisora', ativo: true },
      ...tecnicos.map((t) => ({ id: VG.uid(), usuario: t.usuario, nome: t.nome, papel: 'tecnico', tecnicoId: t.id, ativo: true })),
    ].map((u) => { const salt = VG.token(16); return { ...u, salt, senhaHash: Auth.hash(senhaInicial, salt), criadoEm: at(90, 9, 0) }; });
    S.write('users', users);

    /* ----- Clientes ----- */
    const clientes = [
      { nome: 'Condomínio Residencial Monte Verde', doc: VG.makeCNPJ('123456780001'), telefone: '2133221100', email: 'sindico@monteverde.com.br', endereco: 'Rua das Acácias', numero: '120', complemento: 'Portaria', bairro: 'Jardim América', cidade: 'Rio de Janeiro', estado: 'RJ', cep: '21240000' },
      { nome: 'Supermercado Bom Preço Ltda', doc: VG.makeCNPJ('234567890001'), telefone: '2135554400', email: 'gerencia@bompreco.com.br', endereco: 'Av. Brasil', numero: '4500', complemento: 'Loja 2', bairro: 'Penha', cidade: 'Rio de Janeiro', estado: 'RJ', cep: '21012000' },
      { nome: 'Clínica Odontológica Sorriso Pleno', doc: VG.makeCNPJ('345678900001'), telefone: '2126203030', email: 'recepcao@sorrisopleno.com.br', endereco: 'Rua Moreira César', numero: '229', complemento: 'Sala 804', bairro: 'Icaraí', cidade: 'Niterói', estado: 'RJ', cep: '24230052' },
      { nome: 'Ricardo Almeida Tavares', doc: VG.makeCPF('529982247'), telefone: '21998877665', email: 'ricardo.tavares@email.com', endereco: 'Rua Visconde de Pirajá', numero: '310', complemento: 'Apto 502', bairro: 'Ipanema', cidade: 'Rio de Janeiro', estado: 'RJ', cep: '22410002' },
      { nome: 'Escola Nova Geração', doc: VG.makeCNPJ('456789010001'), telefone: '2124441212', email: 'secretaria@novageracao.edu.br', endereco: 'Rua Coronel Moreira', numero: '85', complemento: '', bairro: 'Centro', cidade: 'Petrópolis', estado: 'RJ', cep: '25620003' },
      { nome: 'Transportadora Rota Sul Ltda', doc: VG.makeCNPJ('567890120001'), telefone: '2437778899', email: 'operacoes@rotasul.com.br', endereco: 'Rodovia Presidente Dutra', numero: 'km 280', complemento: 'Galpão 3', bairro: 'Distrito Industrial', cidade: 'Resende', estado: 'RJ', cep: '27537000' },
      { nome: 'Fernanda Lima Duarte', doc: VG.makeCPF('168995350'), telefone: '21991234567', email: 'fernanda.duarte@email.com', endereco: 'Rua Mariz e Barros', numero: '72', complemento: 'Casa', bairro: 'Tijuca', cidade: 'Rio de Janeiro', estado: 'RJ', cep: '20270004' },
      { nome: 'Farmácia Vida & Saúde', doc: VG.makeCNPJ('678901230001'), telefone: '2122334455', email: 'contato@vidaesaude.com.br', endereco: 'Estrada do Galeão', numero: '1500', complemento: '', bairro: 'Ilha do Governador', cidade: 'Rio de Janeiro', estado: 'RJ', cep: '21931003' },
    ].map((c, i) => ({
      id: VG.uid(), codigo: 'C' + String(i + 1).padStart(4, '0'), status: 'ativo', criadoEm: at(80 - i, 10, 0),
      nome: c.nome, cpf_cnpj: c.doc, telefone: c.telefone, email: c.email, endereco: c.endereco, numero: c.numero,
      complemento: c.complemento, bairro: c.bairro, cidade: c.cidade, estado: c.estado, cep: c.cep,
    }));
    S.write('clientes', clientes);

    /* ----- Ordens de serviço ----- */
    const snap = (c) => ({ nome: c.nome, cpf_cnpj: c.cpf_cnpj, telefone: c.telefone, email: c.email, endereco: c.endereco, numero: c.numero, complemento: c.complemento, bairro: c.bairro, cidade: c.cidade, estado: c.estado, cep: c.cep });
    const T = (i) => tecnicos[i];
    const C = (i) => clientes[i];

    const plans = [
      { c: 0, t: 0, st: 'concluida', d: 52, tipo: 'Manutenção', pr: 'alta', eq: ['Câmera', 'Intelbras', 'VHD 3230 B', 'INT230019874', 'PAT-0041', 'Garagem, bloco B'], prob: 'Cliente informa que a câmera 04 está sem imagem desde ontem.', diag: 'Conector BNC oxidado e fonte com tensão abaixo do nominal (10,8V).', serv: 'Substituição dos conectores BNC e da fonte 12V. Ajuste de foco e teste de gravação no DVR.', mats: [['Conector BNC', 2, 'unidade(s)'], ['Fonte 12V 2A', 1, 'unidade(s)']], photos: true },
      { c: 1, t: 1, st: 'concluida', d: 45, tipo: 'Corretiva', pr: 'urgente', eq: ['Alarme', 'JFL', 'Active 20', 'JFL20-55821', '', 'Depósito'], prob: 'Alarme disparando sozinho durante a madrugada, zona 3.', diag: 'Sensor IVP da zona 3 com lente suja e posicionado de frente para a saída de ar.', serv: 'Limpeza e reposicionamento do sensor. Ajuste de sensibilidade e teste de todas as zonas.', mats: [['Suporte articulado para sensor', 1, 'unidade(s)']] },
      { c: 2, t: 2, st: 'concluida', d: 38, tipo: 'Instalação', pr: 'normal', eq: ['Controle de acesso', 'ControlID', 'iDFace', 'IDF-778120', 'PAT-1120', 'Recepção'], prob: 'Instalar leitor facial na porta de acesso ao consultório.', diag: 'Infraestrutura existente adequada; necessário ponto de rede.', serv: 'Instalação do leitor facial, fechadura eletroímã e botoeira. Cadastro de 12 usuários.', mats: [['Cabo UTP Cat6', 15, 'metro(s)'], ['Conector RJ45', 2, 'unidade(s)'], ['Fechadura eletroímã 150kg', 1, 'unidade(s)']] },
      { c: 3, t: 3, st: 'concluida', d: 30, tipo: 'Manutenção', pr: 'normal', eq: ['Portão eletrônico', 'PPA', 'Jet Flex', '', '', 'Garagem'], prob: 'Portão abre pela metade e para.', diag: 'Fim de curso desregulado e cremalheira desalinhada.', serv: 'Regulagem do fim de curso, alinhamento da cremalheira e lubrificação.', mats: [['Graxa lubrificante', 1, 'unidade(s)']] },
      { c: 4, t: 0, st: 'concluida', d: 22, tipo: 'Preventiva', pr: 'baixa', eq: ['DVR/NVR', 'Hikvision', 'DS-7616NI', 'HK7616-4410', 'PAT-0302', 'Sala da direção'], prob: 'Manutenção preventiva trimestral do sistema de CFTV.', diag: 'HD com 94% de uso e 2 câmeras com IR fraco.', serv: 'Limpeza das câmeras, ajuste de retenção de gravação e atualização de firmware do NVR.', mats: [] },
      { c: 5, t: 1, st: 'concluida', d: 15, tipo: 'Corretiva', pr: 'alta', eq: ['Cerca elétrica', 'Genno', 'CE-12000', '', '', 'Perímetro do galpão'], prob: 'Cerca elétrica sem choque em parte do perímetro.', diag: 'Fio de aço rompido próximo ao portão lateral.', serv: 'Emenda do fio, substituição de isoladores quebrados e teste de tensão em todo o perímetro.', mats: [['Fio de aço inox', 20, 'metro(s)'], ['Isolador tipo castanha', 8, 'unidade(s)']] },
      { c: 6, t: 3, st: 'cancelada', d: 12, tipo: 'Suporte', pr: 'normal', eq: ['Interfone', 'HDL', 'F8-SN', '', '', 'Entrada'], prob: 'Interfone sem áudio no monofone da cozinha.', motivo: 'Cliente resolveu o problema por conta própria e pediu o cancelamento.' },
      { c: 7, t: 0, st: 'aguardando_cliente', d: 6, tipo: 'Manutenção', pr: 'normal', eq: ['Câmera', 'Intelbras', 'VIP 1230 B', 'INT-VIP-99231', '', 'Caixa'], prob: 'Câmera do caixa com imagem embaçada.', diag: 'Umidade interna na lente.', serv: 'Substituição da câmera por unidade nova e vedação da caixa de passagem.', mats: [['Câmera IP 2MP', 1, 'unidade(s)'], ['Caixa de passagem vedada', 1, 'unidade(s)']] },
      { c: 0, t: 2, st: 'aguardando_cliente', d: 4, tipo: 'Suporte', pr: 'alta', eq: ['Controle de acesso', 'Intelbras', 'SS 3530', '', '', 'Portaria social'], prob: 'Leitor de tag não reconhece os moradores do bloco A.', diag: 'Base de usuários corrompida após queda de energia.', serv: 'Reimportação da base de usuários e instalação de nobreak para o controlador.', mats: [['Nobreak 600VA', 1, 'unidade(s)']] },
      { c: 1, t: 0, st: 'em_atendimento', d: 1, tipo: 'Instalação', pr: 'alta', eq: ['Câmera', 'Intelbras', 'VHD 1220 D', '', '', 'Estacionamento'], prob: 'Instalar 4 câmeras novas no estacionamento.' },
      { c: 4, t: 1, st: 'em_atendimento', d: 0, tipo: 'Corretiva', pr: 'urgente', eq: ['Central de alarme', 'Paradox', 'SP6000', 'PX-66012', '', 'Secretaria'], prob: 'Central de alarme sem comunicação com a monitoramento.' },
      { c: 2, t: 2, st: 'aguardando_tecnico', d: 1, tipo: 'Vistoria', pr: 'normal', eq: ['Rede', '', '', '', '', 'Rack do 8º andar'], prob: 'Vistoria da rede para ampliação do sistema de câmeras.' },
      { c: 5, t: 3, st: 'aguardando_tecnico', d: 0, tipo: 'Manutenção', pr: 'urgente', eq: ['Portão eletrônico', 'Garen', 'KDZ', '', '', 'Portão de carga'], prob: 'Portão de carga não fecha. Caminhões aguardando.' },
      { c: 3, t: null, st: 'aberta', d: 0, tipo: 'Instalação', pr: 'baixa', eq: ['Alarme', '', '', '', '', 'Residência'], prob: 'Orçamento e instalação de alarme com 6 sensores.' },
    ];

    const ordens = [];
    const atividades = [];
    let numero = 1031;

    plans.forEach((p) => {
      const c = C(p.c);
      const tec = p.t != null ? T(p.t) : null;
      const created = at(p.d, 8 + (numero % 3), 10 + (numero % 5) * 7);
      const os = {
        id: VG.uid(), numero: numero++, criadaEm: created, prioridade: p.pr, tipo: p.tipo, status: p.st,
        clienteId: c.id, cliente: snap(c),
        equipamento: { tipo: p.eq[0], marca: p.eq[1], modelo: p.eq[2], serie: p.eq[3], patrimonio: p.eq[4], local: p.eq[5] },
        problema: p.prob,
        tecnicoId: tec ? tec.id : null, tecnicoNome: tec ? tec.nome : '',
        prazoData: inputDate(Math.max(p.d - 1, -2)), prazoHora: '14:00',
        tokenTecnico: VG.token(10), tokenCliente: VG.token(10),
        atendimento: { inicio: null, fim: null, diagnostico: '', servico: '', materiais: [], observacoes: '', fotos: { antes: [], depois: [] } },
        assinaturaTecnico: null, assinaturaCliente: null,
        historico: [],
      };
      const H = (iso, texto) => { os.historico.push({ dataHora: iso, texto }); atividades.push({ id: VG.uid(), dataHora: iso, texto: texto.replace(/\.$/, '') + ` — OS #${os.numero}`, osId: os.id, icon: 'activity' }); };
      H(created, 'OS criada pela supervisora.');
      if (tec) H(addMin(created, 8), `OS enviada para ${tec.nome}.`);

      if (['em_atendimento', 'aguardando_cliente', 'concluida'].includes(p.st)) {
        const ini = addMin(created, 230);
        os.atendimento.inicio = ini;
        H(ini, 'Técnico iniciou atendimento.');
        if (p.diag) os.atendimento.diagnostico = p.diag;
      }
      if (['aguardando_cliente', 'concluida'].includes(p.st)) {
        const fim = addMin(os.atendimento.inicio, 55);
        os.atendimento.fim = fim;
        os.atendimento.servico = p.serv;
        os.atendimento.materiais = (p.mats || []).map(([descricao, quantidade, unidade]) => ({ id: VG.uid(), descricao, quantidade, unidade }));
        os.atendimento.observacoes = 'Sistema testado junto ao responsável no local.';
        if (p.photos) {
          const a = fakePhoto('Antes — câmera 04', false), b = fakePhoto('Depois — câmera 04', true);
          if (a) os.atendimento.fotos.antes.push(a);
          if (b) os.atendimento.fotos.depois.push(b);
        }
        os.assinaturaTecnico = { nome: tec.nome, imagem: fakeSignature(tec.nome), dataHora: fim };
        H(fim, 'Técnico finalizou atendimento.');
      }
      if (p.st === 'concluida') {
        const sig = addMin(os.atendimento.fim, 6);
        os.assinaturaCliente = { nome: c.nome.length > 28 ? 'Responsável ' + c.nome.split(' ')[0] : c.nome, documento: VG.fmtDoc(c.cpf_cnpj), imagem: fakeSignature(c.nome), dataHora: sig, observacoes: '' };
        H(sig, 'Cliente assinou.');
        H(addMin(sig, 1), 'OS concluída.');
      }
      if (p.st === 'cancelada') {
        os.canceladaMotivo = p.motivo;
        H(addMin(created, 90), `OS cancelada. Motivo: ${p.motivo}`);
      }
      ordens.push(os);
    });

    S.write('ordens', ordens);
    atividades.sort((a, b) => (a.dataHora < b.dataHora ? 1 : -1));
    S.write('atividades', atividades.slice(0, 60));
    S.setConfig({ ultimoNumeroOS: numero - 1 });
  }

  VG.Store = Store;
})();
