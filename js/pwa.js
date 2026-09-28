/* PWA — registra o app e mostra o aviso "Instalar Vegas OS" */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  var q = new URLSearchParams(location.search);
  if (q.get('os')) return; // link de OS enviado ao cliente: não oferece instalação
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  var KEY = 'vegas_os_pwa_dispensado', DIAS = 3;
  try { if (Date.now() - (+localStorage.getItem(KEY) || 0) < DIAS * 864e5) return; } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    '#pwa-banner{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:99999;' +
    'background:#0d1320;border:1px solid #2563eb;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.55);' +
    'padding:14px;display:none;align-items:center;gap:12px;max-width:520px;margin:0 auto;font-family:"IBM Plex Sans",system-ui,sans-serif}' +
    '#pwa-banner img{width:48px;height:48px;border-radius:12px;flex:none}' +
    '#pwa-banner .t{flex:1;min-width:0}' +
    '#pwa-banner b{display:block;color:#fff;font-size:15px;font-family:"Chakra Petch",sans-serif}' +
    '#pwa-banner span{font-size:13px;color:#a8b3c7}' +
    '#pwa-banner em{font-style:normal;color:#60a5fa;font-weight:600}' +
    '#pwa-banner .bt{display:flex;flex-direction:column;gap:6px}' +
    '#pwa-banner button{border:0;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px;cursor:pointer}' +
    '#pwa-instalar{background:#2563eb;color:#fff}#pwa-fechar{background:transparent;color:#8a94a8}';
  document.head.appendChild(css);

  var bn = document.createElement('div');
  bn.id = 'pwa-banner';
  bn.innerHTML = '<img src="assets/icons/icon-192.png" alt="">' +
    '<div class="t"><b>Instalar Vegas OS</b><span id="pwa-msg">Use como aplicativo, direto da tela inicial.</span></div>' +
    '<div class="bt"><button id="pwa-instalar">Instalar</button><button id="pwa-fechar">Agora não</button></div>';
  document.body.appendChild(bn);

  var btI = bn.querySelector('#pwa-instalar'), btF = bn.querySelector('#pwa-fechar'), evento = null;
  btF.onclick = function () { bn.style.display = 'none'; try { localStorage.setItem(KEY, Date.now()); } catch (e) {} };
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); evento = e; bn.style.display = 'flex'; });
  btI.onclick = function () {
    if (!evento) { btF.click(); return; }
    evento.prompt();
    evento.userChoice.then(function (r) {
      evento = null; bn.style.display = 'none';
      if (r.outcome !== 'accepted') { try { localStorage.setItem(KEY, Date.now()); } catch (e) {} }
    });
  };
  window.addEventListener('appinstalled', function () { bn.style.display = 'none'; });

  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    bn.querySelector('#pwa-msg').innerHTML = 'Toque em <em>Compartilhar ⬆️</em> e depois em <em>Adicionar à Tela de Início</em>.';
    btI.textContent = 'Entendi';
    setTimeout(function () { bn.style.display = 'flex'; }, 1500);
  }
})();
