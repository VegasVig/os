/* =========================================================
   VEGAS OS — IMPORTAÇÃO CSV
   Aceita separador vírgula ou ponto e vírgula, aspas,
   acentos (UTF-8 ou Windows-1252) e cabeçalhos variados.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;

  const COLUNAS = ['codigo', 'nome', 'cpf_cnpj', 'telefone', 'email', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep'];
  const ALIASES = {
    codigo: ['codigo', 'cod', 'id', 'codigo_cliente'],
    nome: ['nome', 'razao_social', 'nome_razao_social', 'cliente', 'nome_fantasia'],
    cpf_cnpj: ['cpf_cnpj', 'cpf', 'cnpj', 'documento', 'cpf/cnpj', 'doc'],
    telefone: ['telefone', 'fone', 'celular', 'whatsapp', 'tel'],
    email: ['email', 'e_mail', 'e-mail'],
    endereco: ['endereco', 'logradouro', 'rua'],
    numero: ['numero', 'num', 'nro', 'n'],
    complemento: ['complemento', 'compl'],
    bairro: ['bairro'],
    cidade: ['cidade', 'municipio'],
    estado: ['estado', 'uf'],
    cep: ['cep'],
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

  /**
   * Chave de duplicidade: o mesmo CPF/CNPJ pode ter várias unidades (endereços).
   * Só é duplicado quando o documento E o endereço são iguais.
   * Sem documento: compara nome + endereço.
   */
  function chave(c) {
    const end = VG.norm([c.endereco, c.numero].join(' ')).replace(/[^a-z0-9]/g, '');
    const doc = VG.digits(c.cpf_cnpj);
    return doc && !/^(\d)\1+$/.test(doc) ? doc + '|' + end : 'sem|' + VG.norm(c.nome).replace(/[^a-z0-9]/g, '') + '|' + end;
  }

  /** Converte o texto em registros validados */
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

    const chaves = new Set(clientesExistentes.map(chave));
    const registros = rows.slice(1).map((r, i) => {
      const d = {};
      COLUNAS.forEach((col) => { d[col] = map[col] != null ? String(r[map[col]] ?? '').trim() : ''; });
      const erros = [];
      const avisos = [];
      let doc = VG.digits(d.cpf_cnpj);
      if (doc && /^(\d)\1+$/.test(doc)) doc = ''; // 000.000.000-00 e similares = sem documento
      let situacao = 'ok';
      if (!d.nome) erros.push('Nome em branco');
      if (!doc) avisos.push('Sem CPF/CNPJ — completar depois');
      else if (!VG.validDoc(doc)) erros.push('CPF/CNPJ inválido');
      if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) erros.push('E-mail inválido');
      if (d.estado && d.estado.length > 2) d.estado = d.estado.slice(0, 2);
      d.cpf_cnpj = doc;
      d.telefone = VG.digits(d.telefone);
      d.cep = VG.digits(d.cep);
      d.estado = (d.estado || '').toUpperCase();
      const k = chave(d);
      if (erros.length) situacao = 'erro';
      else if (chaves.has(k)) { situacao = 'duplicado'; erros.push(doc ? 'Já cadastrado neste endereço' : 'Mesmo nome e endereço já cadastrado'); }
      if (situacao !== 'erro') chaves.add(k);
      return { linha: i + 2, dados: d, erros: erros.concat(situacao === 'ok' ? avisos : []), situacao };
    });
    return {
      registros,
      total: registros.length,
      validos: registros.filter((r) => r.situacao === 'ok').length,
      problemas: registros.filter((r) => r.situacao !== 'ok').length,
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
      'C0100,Condomínio Exemplo,11222333000181,2130001000,contato@exemplo.com.br,Rua Exemplo,100,Bloco A,Centro,Rio de Janeiro,RJ,20000000',
      'C0101,Maria da Silva,11144477735,21999990000,maria@email.com,"Av. Principal, trecho 2",45,Apto 301,Botafogo,Rio de Janeiro,RJ,22250040',
    ];
    VG.download('modelo_clientes_vegas.csv', '\uFEFF' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
  }

  /** Converte uma lista de objetos em CSV (usado nos relatórios) */
  function gerar(colunas, linhas) {
    const esc = (v) => { const s = String(v ?? ''); return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '\uFEFF' + [colunas.map((c) => esc(c.label)).join(';'), ...linhas.map((l) => colunas.map((c) => esc(c.get(l))).join(';'))].join('\r\n');
  }

  VG.CSV = { COLUNAS, parse, analisar, lerArquivo, baixarModelo, gerar, chave };
})();
