// js/patch/app-events.js
// Patch persistente: escuta eventos de import e atualiza UI automaticamente
(function () {
  if (!window.TRJ) window.TRJ = {};
  if (TRJ._eventsPatchedForDataUpdates) return;
  TRJ._eventsPatchedForDataUpdates = true;

  var pendingTimer = null;
  var DEBOUNCE_MS = 250;

  function log() { try { console.info('[app-events]','>', ...arguments); } catch(_){} }
  function safeCall(fn) { try { if (typeof fn === 'function') return fn(); } catch(e){ console.warn('[app-events] safeCall error', e); } }

  function tryRenderCurrentRoute() {
    try {
      if (TRJ.app) {
        if (typeof TRJ.app.reloadIncidents === 'function') {
          safeCall(TRJ.app.reloadIncidents);
          log('TRJ.app.reloadIncidents() chamado');
        }
        if (typeof TRJ.app.refresh === 'function') {
          safeCall(TRJ.app.refresh);
          log('TRJ.app.refresh() chamado');
          return;
        }
        if (typeof TRJ.app.render === 'function') {
          safeCall(function(){ TRJ.app.render(); });
          log('TRJ.app.render() chamado');
          return;
        }
      }

      var route = (location.hash || '').replace(/^#\/?/, '').split(/[?#]/)[0] || 'importar';
      if (TRJ.pages && TRJ.pages[route] && typeof TRJ.pages[route].render === 'function') {
        var root = document.getElementById('page') || document.querySelector('main') || document.body;
        TRJ.pages[route].render(root);
        log('TRJ.pages.' + route + '.render() chamado');
        return;
      }

      if (TRJ.pages && TRJ.pages.importar && typeof TRJ.pages.importar.render === 'function') {
        var root2 = document.getElementById('page') || document.querySelector('main') || document.body;
        TRJ.pages.importar.render(root2);
        log('Fallback: TRJ.pages.importar.render() chamado');
      }
    } catch (e) {
      console.warn('[app-events] tryRenderCurrentRoute erro', e);
    }
  }

  function scheduleUpdate(reason) {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(function () {
      pendingTimer = null;
      log('scheduleUpdate disparado ->', reason || 'evento');
      tryRenderCurrentRoute();
      try {
        if (TRJ.app && typeof TRJ.app.loadAll === 'function') {
          safeCall(TRJ.app.loadAll);
          log('TRJ.app.loadAll() chamado (opcional)');
        }
      } catch (e) { }
    }, DEBOUNCE_MS);
  }

  var events = [
    'trj:incidentsImported',
    'trj:incidentsLoaded',
    'trj:tasksLoaded',
    'trj:tasksLoaded.sitesFora',
    'trj:folderChanged.importar'
  ];

  events.forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      try {
        log('evento recebido:', ev, e && e.detail ? (Array.isArray(e.detail) ? ('len=' + e.detail.length) : e.detail) : '');
      } catch(_) {}
      scheduleUpdate(ev);
    });
  });

  TRJ._triggerUIUpdate = function (why) { scheduleUpdate(why || 'manual'); };

  log('app-events patch instalado. Eventos escutados:', events.join(', '));
})();