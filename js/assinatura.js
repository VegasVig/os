/* =========================================================
   VEGAS OS — ASSINATURA DIGITAL
   Canvas com Pointer Events: funciona com mouse, caneta e dedo.
   ========================================================= */
(function () {
  'use strict';
  const VG = window.VG;

  class SignaturePad {
    constructor(canvas, { color = '#0d0f12', width = 2.4, onChange } = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.color = color;
      this.baseWidth = width;
      this.onChange = onChange;
      this.strokes = [];      // guarda os traços para redesenhar ao redimensionar
      this.current = null;
      this._bind();
      this.resize();
      this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
      if (this._ro) this._ro.observe(canvas);
    }

    _bind() {
      const c = this.canvas;
      const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure || 0.5 }; };
      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
        this.current = [pos(e)];
        this.strokes.push(this.current);
        this._dot(this.current[0]);
      });
      c.addEventListener('pointermove', (e) => {
        if (!this.current) return;
        e.preventDefault();
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        events.forEach((ev) => {
          const p = pos(ev), prev = this.current[this.current.length - 1];
          this.current.push(p);
          this._seg(prev, p);
        });
      });
      const end = () => { if (this.current) { this.current = null; this.onChange && this.onChange(this); } };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('pointerleave', end);
    }

    resize() {
      const c = this.canvas, r = c.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._redraw();
    }

    _style(p) {
      const ctx = this.ctx;
      ctx.strokeStyle = this.color; ctx.fillStyle = this.color;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = this.baseWidth * (0.75 + (p ? p.p : 0.5) * 0.6);
    }
    _dot(p) { this._style(p); this.ctx.beginPath(); this.ctx.arc(p.x, p.y, this.ctx.lineWidth / 2, 0, Math.PI * 2); this.ctx.fill(); }
    _seg(a, b) { this._style(b); const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    _redraw() {
      const r = this.canvas.getBoundingClientRect();
      this.ctx.clearRect(0, 0, r.width, r.height);
      this.strokes.forEach((s) => { if (s.length === 1) this._dot(s[0]); for (let i = 1; i < s.length; i++) this._seg(s[i - 1], s[i]); });
    }

    isEmpty() { return this.strokes.length === 0 || this.strokes.reduce((n, s) => n + s.length, 0) < 6; }
    clear() { this.strokes = []; this._redraw(); this.onChange && this.onChange(this); }

    /** PNG recortado nas bordas da assinatura (fundo transparente) */
    toDataURL() {
      if (this.isEmpty()) return null;
      const pts = this.strokes.flat();
      const pad = 12;
      const minX = Math.max(0, Math.min(...pts.map((p) => p.x)) - pad), minY = Math.max(0, Math.min(...pts.map((p) => p.y)) - pad);
      const maxX = Math.max(...pts.map((p) => p.x)) + pad, maxY = Math.max(...pts.map((p) => p.y)) + pad;
      const w = maxX - minX, h = maxY - minY;
      const scale = 2;
      const out = document.createElement('canvas');
      out.width = Math.round(w * scale); out.height = Math.round(h * scale);
      const ctx = out.getContext('2d');
      ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
      const saved = this.ctx;
      this.ctx = ctx;
      this.strokes.forEach((s) => { if (s.length === 1) this._dot(s[0]); for (let i = 1; i < s.length; i++) this._seg(s[i - 1], s[i]); });
      this.ctx = saved;
      return out.toDataURL('image/png');
    }

    destroy() { if (this._ro) this._ro.disconnect(); }
  }

  /** HTML padrão do bloco de assinatura */
  SignaturePad.markup = (id, placeholder = 'Assine aqui com o dedo ou o mouse') => `
    <div class="sigpad" id="${id}">
      <div class="sigpad__box">
        <canvas aria-label="Área de assinatura"></canvas>
        <div class="sigpad__line"></div>
        <div class="sigpad__ph">${VG.esc(placeholder)}</div>
      </div>
    </div>`;

  /** Monta o componente dentro de um container já renderizado */
  SignaturePad.mount = (root) => {
    const canvas = root.querySelector('canvas');
    const ph = root.querySelector('.sigpad__ph');
    const pad = new SignaturePad(canvas, { onChange: (p) => { if (ph) ph.style.opacity = p.isEmpty() ? 1 : 0; } });
    return pad;
  };

  VG.SignaturePad = SignaturePad;
})();
