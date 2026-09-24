/* =========================================================
   VEGAS OS — UTILITÁRIOS
   Funções de apoio usadas por todos os módulos (namespace VG).
   ========================================================= */
(function () {
  'use strict';
  const VG = (window.VG = window.VG || {});

  /* ---------- DOM ---------- */
  VG.$ = (s, r = document) => r.querySelector(s);
  VG.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  VG.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  VG.debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------- DATAS ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  VG.nowISO = () => new Date().toISOString();
  VG.fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return '—'; return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  VG.fmtTime = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  VG.fmtDateTime = (iso) => (iso ? `${VG.fmtDate(iso)} ${VG.fmtTime(iso)}` : '—');
  /** Data de input (YYYY-MM-DD) → DD/MM/AAAA sem problemas de fuso */
  VG.fmtInputDate = (v) => { if (!v) return '—'; const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; };
  VG.toInputDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  VG.timeAgo = (iso) => {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} d`;
    return VG.fmtDate(iso);
  };

  /* ---------- TEXTO / DOCUMENTOS ---------- */
  VG.norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  VG.digits = (s) => String(s || '').replace(/\D/g, '');
  VG.initials = (name) => String(name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  VG.slug = (s) => VG.norm(s).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40);

  VG.fmtDoc = (s) => {
    const d = VG.digits(s);
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return s || '';
  };
  VG.fmtPhone = (s) => {
    const d = VG.digits(s);
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return s || '';
  };
  VG.fmtCEP = (s) => { const d = VG.digits(s); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : s || ''; };

  function cpfValid(d) {
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (let t = 9; t < 11; t++) {
      let s = 0;
      for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
    }
    return true;
  }
  function cnpjDigit(d, len) {
    let w = len - 7, s = 0;
    for (let i = 0; i < len; i++) { s += Number(d[i]) * w--; if (w < 2) w = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  }
  function cnpjValid(d) {
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    return cnpjDigit(d, 12) === Number(d[12]) && cnpjDigit(d, 13) === Number(d[13]);
  }
  VG.validDoc = (s) => { const d = VG.digits(s); return d.length === 11 ? cpfValid(d) : d.length === 14 ? cnpjValid(d) : false; };
  /** Gera documentos válidos (apenas para os dados de demonstração) */
  VG.makeCPF = (base9) => {
    let d = String(base9);
    for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i); d += ((s * 10) % 11) % 10; }
    return d;
  };
  VG.makeCNPJ = (base12) => { let d = String(base12); d += cnpjDigit(d, 12); d += cnpjDigit(d, 13); return d; };

  /** Máscaras de digitação */
  VG.bindMasks = (root) => {
    VG.$$('[data-mask]', root).forEach((el) => {
      el.addEventListener('input', () => {
        const type = el.dataset.mask, d = VG.digits(el.value);
        if (type === 'doc') {
          const v = d.slice(0, 14);
          el.value = v.length <= 11
            ? v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
            : v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
        } else if (type === 'phone') {
          const v = d.slice(0, 11);
          el.value = v.length > 10 ? v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
            : v.length > 6 ? v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
            : v.length > 2 ? v.replace(/(\d{2})(\d{0,5})/, '($1) $2') : v;
        } else if (type === 'cep') {
          const v = d.slice(0, 8);
          el.value = v.length > 5 ? v.replace(/(\d{5})(\d{0,3})/, '$1-$2') : v;
        }
      });
    });
  };

  /* ---------- IDs / TOKENS ---------- */
  VG.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  VG.token = (n = 10) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const arr = new Uint32Array(n);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return Array.from(arr, (x) => chars[x % chars.length]).join('');
  };

  /* ---------- DOMÍNIO ---------- */
  VG.STATUS = {
    aberta:              { label: 'Aberta',              emoji: '🔵', color: 'blue',   cssVar: '--st-blue' },
    aguardando_tecnico:  { label: 'Aguardando técnico',  emoji: '🟡', color: 'yellow', cssVar: '--st-yellow' },
    em_atendimento:      { label: 'Em atendimento',      emoji: '🟠', color: 'orange', cssVar: '--st-orange' },
    aguardando_cliente:  { label: 'Aguardando cliente',  emoji: '🟣', color: 'purple', cssVar: '--st-purple' },
    concluida:           { label: 'Concluída',           emoji: '🟢', color: 'green',  cssVar: '--st-green' },
    cancelada:           { label: 'Cancelada',           emoji: '🔴', color: 'red',    cssVar: '--st-red' },
  };
  VG.PRIORIDADES = {
    baixa:   { label: 'Baixa',   color: 'gray' },
    normal:  { label: 'Normal',  color: 'silver' },
    alta:    { label: 'Alta',    color: 'orange' },
    urgente: { label: 'Urgente', color: 'red' },
  };
  VG.TIPOS_ATENDIMENTO = ['Manutenção', 'Instalação', 'Suporte', 'Preventiva', 'Corretiva', 'Vistoria', 'Outro'];
  VG.EQUIPAMENTOS = ['Câmera', 'DVR/NVR', 'Alarme', 'Central de alarme', 'Controle de acesso', 'Cerca elétrica', 'Interfone', 'Portão eletrônico', 'PABX', 'Rede', 'Outro'];
  VG.UNIDADES = ['unidade(s)', 'metro(s)', 'rolo(s)', 'caixa(s)', 'par(es)', 'kit(s)', 'peça(s)'];

  VG.badge = (status, lg) => {
    const s = VG.STATUS[status] || { label: status, color: 'gray' };
    return `<span class="badge badge--${s.color}${lg ? ' badge--lg' : ''}"><i></i>${VG.esc(s.label)}</span>`;
  };
  VG.prioBadge = (p) => {
    const s = VG.PRIORIDADES[p] || VG.PRIORIDADES.normal;
    return `<span class="badge badge--${s.color}${p === 'urgente' ? ' badge--pulse' : ''}"><i></i>${s.label}</span>`;
  };
  VG.statusOptions = (sel, withAll = true) =>
    (withAll ? '<option value="">Todos os status</option>' : '') +
    Object.entries(VG.STATUS).map(([k, s]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${s.emoji} ${s.label}</option>`).join('');
  VG.options = (list, sel, placeholder) =>
    (placeholder !== undefined ? `<option value="">${VG.esc(placeholder)}</option>` : '') +
    list.map((o) => { const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o; return `<option value="${VG.esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${VG.esc(l)}</option>`; }).join('');

  VG.enderecoCompleto = (c) => {
    if (!c) return '';
    const l1 = [c.endereco, c.numero].filter(Boolean).join(', ');
    const l2 = [c.complemento, c.bairro].filter(Boolean).join(' · ');
    const l3 = [c.cidade, c.estado].filter(Boolean).join(' - ');
    return [l1, l2, l3, c.cep ? 'CEP ' + VG.fmtCEP(c.cep) : ''].filter(Boolean).join(' — ');
  };
  VG.mapsLink = (c) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([c.endereco, c.numero, c.bairro, c.cidade, c.estado].filter(Boolean).join(', '));

  /** Link exclusivo da OS: #/os/NUMERO/TOKEN */
  VG.linkFor = (os, papel) => {
    const base = location.href.split('#')[0];
    return `${base}#/os/${os.numero}/${papel === 'cliente' ? os.tokenCliente : os.tokenTecnico}`;
  };

  /* ---------- ÍCONES (SVG inline) ---------- */
  const I = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    os: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>',
    pen: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.59 7.59"/><circle cx="11" cy="11" r="2"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    video: '<path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M10 9H8"/>',
    refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  };
  VG.icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name] || I.info}</svg>`;

  /* ---------- TOAST ---------- */
  VG.toast = (msg, type = 'info', ms = 3400) => {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const icon = { success: 'check', error: 'alert', warn: 'alert', info: 'info' }[type] || 'info';
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `${VG.icon(icon)}<div>${VG.esc(msg)}</div>`;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, ms);
  };

  /* ---------- MODAL ---------- */
  VG.modal = ({ title = '', body = '', actions = [], size = '', onOpen, onClose } = {}) => {
    const root = document.getElementById('modal-root');
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal ${size ? 'modal--' + size : ''}" role="dialog" aria-modal="true" aria-label="${VG.esc(title)}">
        <div class="modal__head"><h3>${VG.esc(title)}</h3>
          <button class="btn btn-ghost btn-icon" data-close aria-label="Fechar">${VG.icon('x')}</button></div>
        <div class="modal__body">${body}</div>
        ${actions.length ? '<div class="modal__foot"></div>' : ''}
      </div>`;
    const prevFocus = document.activeElement;
    let closed = false;
    const api = {
      el: back.querySelector('.modal'),
      close() {
        if (closed) return; closed = true;
        back.classList.remove('show');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => back.remove(), 220);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        onClose && onClose();
      },
    };
    const foot = back.querySelector('.modal__foot');
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn ${a.cls || 'btn-ghost'}`;
      b.innerHTML = (a.icon ? VG.icon(a.icon) : '') + `<span>${VG.esc(a.label)}</span>`;
      b.addEventListener('click', async () => {
        if (!a.onClick) return api.close();
        b.disabled = true;
        try { const r = await a.onClick(api); if (r !== false) api.close(); }
        finally { b.disabled = false; }
      });
      foot.appendChild(b);
    });
    const onKey = (e) => { if (e.key === 'Escape') api.close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', (e) => { if (e.target === back) api.close(); });
    back.querySelector('[data-close]').addEventListener('click', api.close);
    root.appendChild(back);
    requestAnimationFrame(() => back.classList.add('show'));
    onOpen && onOpen(api.el, api);
    const first = api.el.querySelector('.modal__body input:not([type=hidden]):not([readonly]), .modal__body select, .modal__body textarea');
    if (first && window.matchMedia('(min-width: 721px)').matches) setTimeout(() => first.focus(), 60);
    return api;
  };

  VG.confirm = (msg, { title = 'Confirmar', ok = 'Confirmar', danger = false } = {}) =>
    new Promise((resolve) => {
      let answered = false;
      VG.modal({
        title, size: 'sm',
        body: `<p style="margin:0">${VG.esc(msg)}</p>`,
        onClose: () => { if (!answered) resolve(false); },
        actions: [
          { label: 'Voltar', cls: 'btn-ghost' },
          { label: ok, cls: danger ? 'btn-danger' : 'btn-primary', onClick: () => { answered = true; resolve(true); } },
        ],
      });
    });

  VG.promptText = ({ title, label, placeholder = '', ok = 'Confirmar', required = true, danger = false }) =>
    new Promise((resolve) => {
      let answered = false;
      VG.modal({
        title, size: 'sm',
        body: `<div class="field"><label for="vg-prompt">${VG.esc(label)}</label><textarea id="vg-prompt" class="textarea" placeholder="${VG.esc(placeholder)}"></textarea></div>`,
        onClose: () => { if (!answered) resolve(null); },
        actions: [
          { label: 'Voltar', cls: 'btn-ghost' },
          { label: ok, cls: danger ? 'btn-danger' : 'btn-primary', onClick: (m) => {
            const v = m.el.querySelector('#vg-prompt').value.trim();
            if (required && !v) { VG.toast('Preencha o campo para continuar.', 'warn'); return false; }
            answered = true; resolve(v);
          } },
        ],
      });
    });

  VG.lightbox = (src, caption = '') => VG.modal({ title: caption || 'Foto', size: 'lg', body: `<div class="lightbox"><img src="${src}" alt="${VG.esc(caption)}"></div>` });

  /* ---------- ÁREA DE TRANSFERÊNCIA / COMPARTILHAR ---------- */
  VG.copyText = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* segue para o método alternativo */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  };
  VG.share = async ({ title, text, url }) => {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    const ok = await VG.copyText(url);
    VG.toast(ok ? 'Seu dispositivo não oferece compartilhamento direto. Link copiado.' : 'Não foi possível copiar o link.', ok ? 'info' : 'error');
    return ok;
  };
  VG.whatsappUrl = (text, phone) => {
    const d = VG.digits(phone);
    const num = d ? (d.length <= 11 ? '55' + d : d) : '';
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  };

  /* ---------- IMAGENS ---------- */
  /** Reduz a foto antes de armazenar (economiza espaço no navegador) */
  VG.compressImage = (file, max = 1280, quality = 0.72) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato de imagem não suportado.'));
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

  /* ---------- UI ---------- */
  VG.empty = (icon, title, text, action = '') =>
    `<div class="empty"><div class="empty__icon">${VG.icon(icon)}</div><h3>${VG.esc(title)}</h3><p>${VG.esc(text)}</p>${action}</div>`;
  VG.loading = (text = 'Carregando…') => `<div class="loading-block"><span class="spinner"></span><span class="sr-only">${VG.esc(text)}</span></div>`;
  VG.setBusy = (btn, busy, label) => {
    if (!btn) return;
    if (busy) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span><span>${VG.esc(label || 'Aguarde…')}</span>`; }
    else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
  };
  VG.kv = (k, v, raw = false) => `<div class="kv__item"><div class="kv__k">${VG.esc(k)}</div><div class="kv__v">${raw ? (v || '—') : VG.esc(v || '—')}</div></div>`;

  VG.download = (filename, content, mime = 'text/plain;charset=utf-8') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  };
})();
