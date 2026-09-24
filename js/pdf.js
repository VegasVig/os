/* =========================================================
   VEGAS OS — PDF DA ORDEM DE SERVIÇO
   Usa jsPDF (desenho vetorial, texto selecionável).
   Sem internet/jsPDF, cai para a impressão do navegador
   ("Salvar como PDF") com o mesmo conteúdo.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;

  const COR = {
    preto: [12, 13, 15], grafite: [38, 42, 48], cinza: [110, 116, 124], cinzaClaro: [228, 231, 235],
    prata: [176, 182, 191], linha: [214, 218, 223], texto: [24, 26, 30], branco: [255, 255, 255],
  };
  const STATUS_RGB = {
    aberta: [77, 141, 255], aguardando_tecnico: [210, 160, 20], em_atendimento: [240, 125, 50],
    aguardando_cliente: [140, 95, 230], concluida: [34, 160, 95], cancelada: [220, 70, 70],
  };

  /* ----- imagens ----- */
  function imgInfo(src) {
    if (src && String(src).indexOf('drive:') === 0) {
      return VG.Images.get(String(src).slice(6)).then((d) => (d ? imgInfo(d) : null));
    }
    return new Promise((res) => {
      if (!src) return res(null);
      let done = false;
      const resolve = (v) => { if (!done) { done = true; res(v); } };
      setTimeout(() => resolve(null), 6000); // nunca travar a geração do PDF
      const img = new Image();
      img.onload = () => {
        if (src.startsWith('data:')) return resolve({ data: src, w: img.naturalWidth, h: img.naturalHeight });
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve({ data: c.toDataURL('image/png'), w: c.width, h: c.height });
        } catch (e) { resolve(null); } // arquivo aberto via file:// bloqueia a leitura da logo
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  const fmt = (data) => (data && data.startsWith('data:image/png') ? 'PNG' : 'JPEG');

  const nomeArquivo = (os) => {
    const parts = VG.slug(os.cliente && os.cliente.nome).split('_').filter(Boolean);
    const nome = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('') || 'Cliente';
    return `OS_${os.numero}_${nome}.pdf`;
  };
  /* texto seguro para as fontes padrão do PDF (Latin-1) */
  const safe = (s) => String(s ?? '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[^\x00-\xFF]/g, '');

  async function gerar(os) {
    if (!window.jspdf || !window.jspdf.jsPDF) return imprimir(os);
    VG.toast('Gerando PDF…');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const W = 210, H = 297, M = 14, CW = W - M * 2;
    const cfg = VG.Store.getConfig();
    const emp = cfg.empresa;
    const logo = (await imgInfo(VG.logoSrc())) || (!VG.Store.getConfig().logoDataUrl && VG.LOGO_EMBED ? await imgInfo(VG.LOGO_EMBED) : null);
    let y = 0;

    const setText = (size, style = 'normal', color = COR.texto) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); };

    function header() {
      doc.setFillColor(...COR.preto); doc.rect(0, 0, W, 31, 'F');
      doc.setFillColor(...COR.grafite); doc.rect(0, 31, W, 1.4, 'F');
      doc.setFillColor(...COR.prata); doc.rect(0, 32.4, W, 0.5, 'F');
      if (logo) {
        let h = 17, w = (h * logo.w) / logo.h;
        if (w > 66) { w = 66; h = (w * logo.h) / logo.w; }
        doc.addImage(logo.data, 'PNG', M, (31 - h) / 2, w, h);
      } else {
        setText(20, 'bold', COR.branco); doc.text('VEGAS', M, 16);
        setText(7, 'normal', COR.prata); doc.text('VIGILANCIA E SEGURANCA', M, 21);
      }
      setText(8, 'bold', COR.prata); doc.text('ORDEM DE SERVIÇO', W - M, 11, { align: 'right' });
      setText(20, 'bold', COR.branco); doc.text(`Nº ${os.numero}`, W - M, 20, { align: 'right' });
      setText(7.5, 'normal', COR.prata); doc.text(`Aberta em ${VG.fmtDateTime(os.criadaEm)}`, W - M, 25.5, { align: 'right' });
      y = 41;
    }
    function ensure(space) { if (y + space > H - 20) { doc.addPage(); header(); } }
    function section(t) {
      ensure(16);
      doc.setFillColor(...COR.cinzaClaro); doc.rect(M, y, CW, 7.2, 'F');
      doc.setFillColor(...COR.grafite); doc.rect(M, y, 1.6, 7.2, 'F');
      setText(8.5, 'bold', COR.texto); doc.text(safe(t).toUpperCase(), M + 4.5, y + 4.9);
      y += 10.5;
    }
    function grid(pairs, cols = 2) {
      const gap = 6, colW = (CW - gap * (cols - 1)) / cols;
      for (let i = 0; i < pairs.length; i += cols) {
        const row = pairs.slice(i, i + cols);
        const lines = row.map(([k, v, span]) => doc.splitTextToSize(safe(v || '-'), span ? CW : colW));
        const rowH = 4 + Math.max(...lines.map((l) => l.length)) * 4.3 + 2.5;
        ensure(rowH);
        let x = M;
        row.forEach(([k], j) => {
          setText(7, 'normal', COR.cinza); doc.text(safe(k), x, y);
          setText(9.2, 'normal', COR.texto); doc.text(lines[j], x, y + 4.4);
          x += colW + gap;
        });
        y += rowH;
      }
    }
    function paragraph(text) {
      setText(9.4, 'normal', COR.texto);
      const lines = doc.splitTextToSize(safe(text || '-'), CW);
      lines.forEach((ln) => { ensure(5); doc.text(ln, M, y); y += 4.7; });
      y += 3;
    }

    header();

    /* status + resumo */
    const st = VG.STATUS[os.status] || { label: os.status };
    const stRGB = STATUS_RGB[os.status] || COR.cinza;
    setText(8.5, 'bold', COR.branco);
    const stW = doc.getTextWidth(st.label.toUpperCase()) + 9;
    doc.setFillColor(...stRGB); doc.roundedRect(M, y - 4.6, stW, 7, 1.5, 1.5, 'F');
    doc.text(st.label.toUpperCase(), M + 4.5, y);
    setText(8.5, 'normal', COR.cinza);
    doc.text(safe(`Tipo: ${os.tipo}   |   Prioridade: ${(VG.PRIORIDADES[os.prioridade] || {}).label || '-'}   |   Técnico: ${os.tecnicoNome || '-'}`), M + stW + 4, y);
    y += 9;

    const c = os.cliente || {};
    section('Dados do cliente');
    grid([
      ['Nome / Razão social', c.nome], ['CPF / CNPJ', VG.fmtDoc(c.cpf_cnpj)],
      ['Telefone', VG.fmtPhone(c.telefone)], ['E-mail', c.email],
    ]);
    grid([['Endereço', VG.enderecoCompleto(c), true]], 1);

    section('Atendimento');
    grid([
      ['Técnico responsável', os.tecnicoNome], ['Tipo de atendimento', os.tipo],
      ['Prioridade', (VG.PRIORIDADES[os.prioridade] || {}).label], ['Prazo previsto', os.prazoData ? `${VG.fmtInputDate(os.prazoData)} ${os.prazoHora || ''}` : '-'],
      ['Início do atendimento', VG.fmtDateTime(os.atendimento && os.atendimento.inicio)], ['Fim do atendimento', VG.fmtDateTime(os.atendimento && os.atendimento.fim)],
    ]);

    const e = os.equipamento || {};
    section('Equipamento / sistema');
    grid([['Tipo', e.tipo], ['Marca', e.marca], ['Modelo', e.modelo], ['Número de série', e.serie], ['Patrimônio', e.patrimonio], ['Local do equipamento', e.local]], 3);

    const a = os.atendimento || {};
    section('Problema relatado'); paragraph(os.problema);
    section('Diagnóstico'); paragraph(a.diagnostico);
    section('Serviço executado'); paragraph(a.servico);

    section('Materiais utilizados');
    const mats = a.materiais || [];
    if (!mats.length) paragraph('Nenhum material registrado.');
    else {
      ensure(8);
      doc.setFillColor(...COR.grafite); doc.rect(M, y - 4.5, CW, 6.5, 'F');
      setText(8, 'bold', COR.branco); doc.text('Item', M + 3, y); doc.text('Material', M + 16, y); doc.text('Quantidade', W - M - 3, y, { align: 'right' });
      y += 5;
      mats.forEach((m, i) => {
        const ln = doc.splitTextToSize(safe(m.descricao), CW - 60);
        const h = ln.length * 4.4 + 2.4;
        ensure(h + 1);
        if (i % 2 === 0) { doc.setFillColor(245, 246, 248); doc.rect(M, y - 3.8, CW, h, 'F'); }
        setText(8.8, 'normal', COR.texto);
        doc.text(String(i + 1).padStart(2, '0'), M + 3, y); doc.text(ln, M + 16, y);
        doc.text(safe(`${m.quantidade} ${m.unidade || ''}`), W - M - 3, y, { align: 'right' });
        y += h;
      });
      y += 3;
    }

    section('Observações');
    paragraph([a.observacoes && `Técnico: ${a.observacoes}`, os.assinaturaCliente && os.assinaturaCliente.observacoes && `Cliente: ${os.assinaturaCliente.observacoes}`, os.canceladaMotivo && `Cancelamento: ${os.canceladaMotivo}`].filter(Boolean).join('\n') || 'Sem observações.');

    /* Fotos */
    const fotosRef = [...((a.fotos && a.fotos.antes) || []).map((f) => ['Antes', f]), ...((a.fotos && a.fotos.depois) || []).map((f) => ['Depois', f])];
    const fotos = (await Promise.all(fotosRef.map(async ([l, f]) => [l, String(f).indexOf('drive:') === 0 ? await VG.Images.get(String(f).slice(6)) : f]))).filter((x) => x[1]);
    if (fotos.length) {
      section('Registro fotográfico');
      const cols = 3, gap = 5, fw = (CW - gap * (cols - 1)) / cols, fh = fw * 0.75;
      for (let i = 0; i < fotos.length; i += cols) {
        ensure(fh + 9);
        fotos.slice(i, i + cols).forEach(([label, src], j) => {
          const x = M + j * (fw + gap);
          doc.setDrawColor(...COR.linha); doc.setFillColor(240, 241, 243); doc.rect(x, y, fw, fh, 'FD');
          try { doc.addImage(src, fmt(src), x + 0.4, y + 0.4, fw - 0.8, fh - 0.8, undefined, 'FAST'); } catch (err) { /* imagem inválida */ }
          setText(7.5, 'bold', COR.cinza); doc.text(label.toUpperCase(), x, y + fh + 4);
        });
        y += fh + 8;
      }
    }

    /* Assinaturas */
    section('Assinaturas');
    ensure(52);
    const boxW = (CW - 6) / 2, boxH = 46;
    const sigs = [
      ['Técnico responsável', os.assinaturaTecnico],
      ['Cliente / responsável', os.assinaturaCliente],
    ];
    for (let i = 0; i < sigs.length; i++) {
      const [title, s] = sigs[i];
      const x = M + i * (boxW + 6);
      doc.setDrawColor(...COR.linha); doc.setLineWidth(0.3); doc.rect(x, y, boxW, boxH);
      setText(7, 'bold', COR.cinza); doc.text(title.toUpperCase(), x + 4, y + 5);
      if (s && s.imagem) {
        const info = await imgInfo(s.imagem);
        if (info) {
          let ih = 20, iw = (ih * info.w) / info.h;
          if (iw > boxW - 10) { iw = boxW - 10; ih = (iw * info.h) / info.w; }
          try { doc.addImage(info.data, 'PNG', x + (boxW - iw) / 2, y + 7 + (20 - ih) / 2, iw, ih); } catch (err) { /* ignora */ }
        }
      } else { setText(8, 'italic', COR.prata); doc.text('Aguardando assinatura', x + boxW / 2, y + 18, { align: 'center' }); }
      doc.setDrawColor(...COR.prata); doc.line(x + 6, y + 29, x + boxW - 6, y + 29);
      setText(9, 'bold', COR.texto); doc.text(safe(s ? s.nome : '-'), x + boxW / 2, y + 34, { align: 'center', maxWidth: boxW - 8 });
      setText(7.5, 'normal', COR.cinza);
      if (s && s.documento) doc.text(safe(`Documento: ${s.documento}`), x + boxW / 2, y + 38.5, { align: 'center' });
      doc.text(s ? `Assinado em ${VG.fmtDateTime(s.dataHora)}` : '', x + boxW / 2, y + 42.5, { align: 'center' });
    }
    y += boxH + 6;

    ensure(12);
    setText(7.5, 'italic', COR.cinza);
    paragraph('Declaração do cliente: "Declaro que o serviço descrito nesta Ordem de Serviço foi realizado e estou ciente das informações registradas."');

    /* Histórico */
    if (os.historico && os.historico.length) {
      section('Histórico');
      os.historico.forEach((h) => {
        const ln = doc.splitTextToSize(safe(h.texto), CW - 34);
        ensure(ln.length * 4.2 + 1.5);
        setText(8, 'bold', COR.cinza); doc.text(VG.fmtDateTime(h.dataHora), M, y);
        setText(8.5, 'normal', COR.texto); doc.text(ln, M + 32, y);
        y += ln.length * 4.2 + 1.5;
      });
    }

    /* Rodapé em todas as páginas */
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...COR.prata); doc.setLineWidth(0.4); doc.line(M, H - 14, W - M, H - 14);
      setText(7.2, 'bold', COR.grafite); doc.text(safe(emp.nome || 'Vegas Vigilância e Segurança'), M, H - 9.5);
      setText(6.8, 'normal', COR.cinza);
      const contato = [emp.cnpj && `CNPJ ${emp.cnpj}`, emp.telefone, emp.email, emp.site].filter(Boolean).join('  |  ');
      if (contato) doc.text(safe(contato), M, H - 6);
      doc.text(`OS ${os.numero}  |  Página ${p} de ${pages}`, W - M, H - 9.5, { align: 'right' });
      doc.text(`Gerado em ${VG.fmtDateTime(VG.nowISO())}`, W - M, H - 6, { align: 'right' });
    }

    doc.setProperties({ title: `Ordem de Serviço ${os.numero}`, subject: safe(c.nome), author: safe(emp.nome), creator: 'Vegas OS' });
    try {
      doc.save(nomeArquivo(os));
      VG.toast('PDF gerado: ' + nomeArquivo(os), 'success');
    } catch (err) {
      console.error('PDF:', err);
      VG.toast('Não foi possível baixar o PDF. Abrindo a impressão do navegador.', 'warn');
      imprimir(os);
    }
  }

  /* ----- Alternativa: impressão do navegador ----- */
  function imprimir(os) {
    const root = document.getElementById('print-root');
    const c = os.cliente || {}, e = os.equipamento || {}, a = os.atendimento || {};
    const esc = VG.esc;
    const row = (k, v) => `<td style="padding:4px 8px;vertical-align:top;width:50%"><div style="font-size:9px;color:#666">${esc(k)}</div><div style="font-size:12px">${esc(v || '—')}</div></td>`;
    const sec = (t) => `<div style="background:#e6e8eb;border-left:4px solid #2a2e33;padding:5px 10px;font:700 11px sans-serif;margin:14px 0 6px;text-transform:uppercase">${esc(t)}</div>`;
    const sig = (t, s) => `<td style="border:1px solid #ccc;padding:8px;text-align:center;width:50%"><div style="font-size:9px;color:#666;text-align:left">${t}</div>${s && s.imagem ? `<img src="${s.imagem}" style="height:60px">` : '<div style="height:60px;color:#aaa;font-size:11px;padding-top:20px">Aguardando assinatura</div>'}<div style="border-top:1px solid #aaa;margin-top:4px;padding-top:4px;font-weight:700;font-size:12px">${esc(s ? s.nome : '—')}</div><div style="font-size:10px;color:#666">${s ? 'Assinado em ' + VG.fmtDateTime(s.dataHora) : ''}</div></td>`;
    const fotos = [...((a.fotos && a.fotos.antes) || []).map((f) => ['Antes', f]), ...((a.fotos && a.fotos.depois) || []).map((f) => ['Depois', f])];
    root.innerHTML = `
      <div style="font-family:Arial,sans-serif;color:#111">
        <div style="background:#0c0d0f;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact">
          <img src="${VG.logoSrc()}" style="height:44px">
          <div style="text-align:right"><div style="font-size:10px;color:#b0b6bf">ORDEM DE SERVIÇO</div><div style="font-size:24px;font-weight:700">Nº ${os.numero}</div><div style="font-size:10px;color:#b0b6bf">${VG.fmtDateTime(os.criadaEm)} · ${esc((VG.STATUS[os.status] || {}).label)}</div></div>
        </div>
        ${sec('Dados do cliente')}<table style="width:100%;border-collapse:collapse"><tr>${row('Nome / Razão social', c.nome)}${row('CPF / CNPJ', VG.fmtDoc(c.cpf_cnpj))}</tr><tr>${row('Telefone', VG.fmtPhone(c.telefone))}${row('E-mail', c.email)}</tr><tr>${row('Endereço', VG.enderecoCompleto(c))}${row('Técnico', os.tecnicoNome)}</tr><tr>${row('Tipo', os.tipo)}${row('Prioridade', (VG.PRIORIDADES[os.prioridade] || {}).label)}</tr></table>
        ${sec('Equipamento')}<table style="width:100%"><tr>${row('Tipo', e.tipo)}${row('Marca / Modelo', [e.marca, e.modelo].filter(Boolean).join(' '))}</tr><tr>${row('Nº de série', e.serie)}${row('Local', e.local)}</tr></table>
        ${sec('Problema relatado')}<p style="font-size:12px;white-space:pre-wrap">${esc(os.problema)}</p>
        ${sec('Diagnóstico')}<p style="font-size:12px;white-space:pre-wrap">${esc(a.diagnostico || '—')}</p>
        ${sec('Serviço executado')}<p style="font-size:12px;white-space:pre-wrap">${esc(a.servico || '—')}</p>
        ${sec('Materiais utilizados')}${(a.materiais || []).length ? `<table style="width:100%;font-size:12px;border-collapse:collapse">${a.materiais.map((m) => `<tr><td style="border-bottom:1px solid #ddd;padding:4px">${esc(m.descricao)}</td><td style="border-bottom:1px solid #ddd;padding:4px;text-align:right">${esc(m.quantidade + ' ' + (m.unidade || ''))}</td></tr>`).join('')}</table>` : '<p style="font-size:12px">Nenhum material registrado.</p>'}
        ${sec('Observações')}<p style="font-size:12px;white-space:pre-wrap">${esc(a.observacoes || '—')}</p>
        ${fotos.length ? sec('Fotos') + `<div style="display:flex;flex-wrap:wrap;gap:8px">${fotos.map(([l, f]) => `<div><img src="${f}" style="width:170px;height:128px;object-fit:cover;border:1px solid #ccc"><div style="font-size:9px;color:#666">${l}</div></div>`).join('')}</div>` : ''}
        ${sec('Assinaturas')}<table style="width:100%;border-collapse:collapse"><tr>${sig('Técnico responsável', os.assinaturaTecnico)}${sig('Cliente', os.assinaturaCliente)}</tr></table>
        <div style="margin-top:18px;border-top:1px solid #aaa;padding-top:6px;font-size:9px;color:#666;display:flex;justify-content:space-between"><span>${esc(VG.Store.getConfig().empresa.nome)}</span><span>Gerado em ${VG.fmtDateTime(VG.nowISO())}</span></div>
      </div>`;
    const prevTitle = document.title;
    document.title = nomeArquivo(os).replace('.pdf', '');
    setTimeout(() => { window.print(); document.title = prevTitle; }, 1500);
  }

  VG.PDF = { gerar, imprimir, nomeArquivo };
})();
