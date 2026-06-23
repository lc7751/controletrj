// js/patch/app-events.js
(function () {
  if (!window.TRJ) window.TRJ = {};
  if (TRJ._eventsPatchedForDataUpdates) return;
  TRJ._eventsPatchedForDataUpdates = true;

  var pendingTimer = null;
  var DEBOUNCE_MS = 250;
  function safeCall(fn){ try{ if(typeof fn==='function') fn(); }catch(e){ console.warn('safeCall', e); } }
  function tryRenderCurrentRoute() {
    try {
      if (TRJ.app) {
        safeCall(function(){ if (typeof TRJ.app.reloadIncidents === 'function') TRJ.app.reloadIncidents(); });
        safeCall(function(){ if (typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); });
      }
      var route = (location.hash || '').replace(/^#\/?/, '').split(/[?#]/)[0] || 'importar';
      if (TRJ.pages && TRJ.pages[route] && typeof TRJ.pages[route].render === 'function') {
        var root = document.getElementById('page') || document.getElementById('importar-root') || document.querySelector('main') || document.body;
        TRJ.pages[route].render(root);
        return;
      }
      if (TRJ.pages && TRJ.pages.importar && typeof TRJ.pages.importar.render === 'function') {
        var root2 = document.getElementById('importar-root') || document.getElementById('page') || document.body;
        TRJ.pages.importar.render(root2);
      }
    } catch (e) { console.warn('app-events tryRenderCurrentRoute erro', e); }
  }
  function scheduleUpdate(){ if (pendingTimer) clearTimeout(pendingTimer); pendingTimer = setTimeout(function(){ pendingTimer=null; tryRenderCurrentRoute(); try{ safeCall(TRJ.app && TRJ.app.loadAll); }catch(_){} }, DEBOUNCE_MS); }

  var events = ['trj:incidentsImported','trj:incidentsLoaded','trj:tasksLoaded','trj:tasksLoaded.sitesFora','trj:folderChanged.importar'];
  events.forEach(function(ev){ document.addEventListener(ev, function(){ scheduleUpdate(); }); });

  TRJ._triggerUIUpdate = function(){ scheduleUpdate(); };
})();
