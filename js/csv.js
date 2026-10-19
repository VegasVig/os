/* =========================================================
   VEGAS OS — IMPORTAÇÃO CSV
   Aceita separador vírgula ou ponto e vírgula, aspas,
   acentos (UTF-8 ou Windows-1252) e cabeçalhos variados.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;

  const COLUNAS = ['codigo', 'nome', 'fantasia', 'cpf_cnpj', 'telefone', 'email', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep', 'status'];
  const ALIASES = {
    codigo: ['codigo', 'cod', 'id', 'codigo_cliente', 'codcliente', 'cod_cliente'],
    nome: ['nome', 'razao_social', 'nome_razao_social', 'cliente'],
    fantasia: ['fantasia', 'nome_fantasia', 'unidade', 'contrato'],
    cpf_cnpj: ['cpf_cnpj', 'cpf', 'cnpj', 'documento', 'cpf/cnpj', 'doc', 'cgccpf', 'cgc_cpf'],
    telefone: ['telefone', 'celularos', 'celular', 'fone', 'fone1', 'whatsapp', 'tel'],
    email: ['email', 'e_mail', 'e-mail'],
    endereco: ['endereco', 'logradouro', 'rua'],
    numero: ['numero', 'num', 'nro', 'n', 'numcasa'],
    complemento: ['complemento', 'compl'],
    bairro: ['bairro'],
    cidade: ['cidade', 'municipio'],
    estado: ['estado', 'uf'],
    cep: ['cep'],
    status: ['status', 'situacao'],
  };

  function detectDelimiter(firstLine) {
    const count = (ch) => (firstLine.match(new RegExp('\\' + ch, 'g')) || []).length;
    return count(';') > count(',') ? ';' : count('\t') > count(',') ? '\t' : ',';
  }

  /** Parser RFC 4180 simplificado */
  function parse(text) {
    text = text.replace(/^\uFEFF/, '');
    const firstLine = text.split(/\r?\n/)[0] || '';
    const delim = detectDelimiter(firstLine);
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
        else field += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  }

  const normHeader = (h) => VG.norm(h).replace(/\s+/g, '_');

  const limpa = (v) => VG.norm(v).replace(/[^a-z0-9]/g, '');
  const docOk = (c) => { const d = VG.digits(c.cpf_cnpj); return d && !/^(\d)\1+$/.test(d) ? d : ''; };

  /**
   * Chave da unidade: documento + endereço + nome + nome fantasia.
   * O mesmo CNPJ no mesmo endereço é aceito quando o nome ou o nome fantasia (contrato) muda.
   */
  function chave(c) {
    return [docOk(c) || 'sem', limpa([c.endereco, c.numero].join(' ')), limpa(c.nome), limpa(c.fantasia)].join('|');
  }
  const chaveBase = (c) => chave(Object.assign({}, c, { fantasia: '' }));

  /** Aceita vários e-mails (separados por ; , ou espaço); devolve os válidos e quantos foram descartados */
  function emails(txt) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const partes = String(txt || '').split(/[;,\s]+/).filter(Boolean);
    const ok = [...new Set(partes.filter((e) => re.test(e)).map((e) => e.toLowerCase()))];
    return { valor: ok.join('; '), invalidos: partes.filter((e) => !re.test(e)).length };
  }

  /**
   * Converte o texto em registros validados.
   * Duplicado = código já cadastrado; sem código, mesma chave da unidade.
   * Cadastro antigo sem nome fantasia que bate com a linha (código ou documento+endereço+nome)
   * é considerado o mesmo cliente e recebe o nome fantasia e o código do arquivo em codigoErp ("complementar").
   */
  function analisar(text, clientesExistentes) {
    const rows = parse(text);
    if (!rows.length) return { erroGeral: 'O arquivo está vazio.' };
    const headers = rows[0].map(normHeader);
    const map = {};
    COLUNAS.forEach((col) => {
      const idx = headers.findIndex((h) => ALIASES[col].includes(h));
      if (idx >= 0) map[col] = idx;
    });
    if (map.nome == null) return { erroGeral: 'Não encontramos a coluna "nome" no cabeçalho. Baixe o modelo CSV e use os mesmos nomes de coluna.' };
    if (map.cpf_cnpj == null) return { erroGeral: 'Não encontramos a coluna "cpf_cnpj" no cabeçalho. Baixe o modelo CSV e use os mesmos nomes de coluna.' };

    const linhas = rows.slice(1).map((r) => {
      const d = {};
      COLUNAS.forEach((col) => { d[col] = map[col] != null ? String(r[map[col]] ?? '').trim() : ''; });
      return d;
    });
    const codArquivo = new Set(linhas.map((d) => limpa(d.codigo)).filter(Boolean));
    const porCodigo = {};
    const chaves = new Set();
    const noArquivo = new Set();
    const antigos = {};
    clientesExistentes.forEach((c) => {
      const cod = limpa(c.codigo);
      if (cod) porCodigo[cod] = c;
      if (limpa(c.codigoErp)) porCodigo[limpa(c.codigoErp)] = c;
      chaves.add(chave(c));
      // cadastro antigo sem fantasia: só casa pelo documento+endereço+nome se o código dele não estiver no arquivo
      if (!limpa(c.fantasia) && !(cod && codArquivo.has(cod))) (antigos[chaveBase(c)] = antigos[chaveBase(c)] || []).push(c);
    });

    const registros = linhas.map((d, i) => {
      const erros = [];
      const avisos = [];
      let doc = VG.digits(d.cpf_cnpj);
      if (doc && /^(\d)\1+$/.test(doc)) doc = '';
      let situacao = 'ok';
      let existente = null;
      if (!d.nome) erros.push('Nome em branco');
      if (!doc) avisos.push('Sem CPF/CNPJ — completar depois');
      else if (!VG.validDoc(doc)) erros.push('CPF/CNPJ inválido');
      const em = emails(d.email);
      d.email = em.valor;
      if (em.invalidos) avisos.push(em.invalidos === 1 ? 'E-mail inválido ignorado' : `${em.invalidos} e-mails inválidos ignorados`);
      if (d.estado && d.estado.length > 2) d.estado = d.estado.slice(0, 2);
      if (limpa(d.fantasia) === limpa(d.nome)) d.fantasia = '';
      d.cpf_cnpj = doc;
      d.telefone = VG.digits(d.telefone);
      d.cep = VG.digits(d.cep);
      d.estado = (d.estado || '').toUpperCase();
      d.status = /inativ/.test(VG.norm(d.status)) ? 'inativo' : 'ativo';
      const cod = limpa(d.codigo);
      const k = chave(d);
      const base = (antigos[chaveBase(d)] || []);
      if (erros.length) situacao = 'erro';
      else if (cod && porCodigo[cod]) {
        existente = porCodigo[cod];
        if (d.fantasia && existente.id && !limpa(existente.fantasia)) situacao = 'complementar';
        else { situacao = 'duplicado'; erros.push(`Código ${d.codigo} já cadastrado`); }
      } else if (base.length) {
        existente = base.shift();
        if (d.fantasia) situacao = 'complementar';
        else { situacao = 'duplicado'; erros.push(`Já cadastrado (${existente.codigo || 'sem código'})`); }
      } else if (!cod && (chaves.has(k) || noArquivo.has(k))) { situacao = 'duplicado'; erros.push(chaves.has(k) ? 'Mesmo documento, nome, fantasia e endereço já cadastrado' : 'Repetido no arquivo'); }
      if (situacao === 'complementar') avisos.unshift(`Já cadastrado (${existente.codigo || 'sem código'}): recebe o nome fantasia`);
      if (situacao === 'ok') { noArquivo.add(k); if (cod) porCodigo[cod] = d; }
      return { linha: i + 2, dados: d, existente, erros: erros.concat(situacao === 'ok' || situacao === 'complementar' ? avisos : []), situacao };
    });
    return {
      registros,
      total: registros.length,
      validos: registros.filter((r) => r.situacao === 'ok').length,
      complementar: registros.filter((r) => r.situacao === 'complementar').length,
      problemas: registros.filter((r) => r.situacao === 'erro').length,
      duplicados: registros.filter((r) => r.situacao === 'duplicado').length,
    };
  }

  /** Lê o arquivo tentando UTF-8; se houver caracteres corrompidos, relê como Windows-1252 (Excel) */
  function lerArquivo(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      r.onload = () => {
        const txt = r.result;
        if (txt.includes('\uFFFD')) {
          const r2 = new FileReader();
          r2.onload = () => resolve(r2.result);
          r2.onerror = () => resolve(txt);
          r2.readAsText(file, 'windows-1252');
        } else resolve(txt);
      };
      r.readAsText(file, 'utf-8');
    });
  }

  function baixarModelo() {
    const linhas = [
      COLUNAS.join(','),
      'C0100,Condomínio Exemplo,Portaria Bloco A (CFTV),11222333000181,2130001000,contato@exemplo.com.br,Rua Exemplo,100,Bloco A,Centro,Rio de Janeiro,RJ,20000000,ativo',
      'C0101,Maria da Silva,,11144477735,21999990000,maria@email.com,"Av. Principal, trecho 2",45,Apto 301,Botafogo,Rio de Janeiro,RJ,22250040,ativo',
    ];
    VG.download('modelo_clientes_vegas.csv', '\uFEFF' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
  }

  /** Converte uma lista de objetos em CSV (usado nos relatórios) */
  function gerar(colunas, linhas) {
    const esc = (v) => { const s = String(v ?? ''); return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '\uFEFF' + [colunas.map((c) => esc(c.label)).join(';'), ...linhas.map((l) => colunas.map((c) => esc(c.get(l))).join(';'))].join('\r\n');
  }

  VG.CSV = { COLUNAS, parse, analisar, lerArquivo, baixarModelo, gerar, chave, emails };
})();
