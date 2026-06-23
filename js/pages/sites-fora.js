// js/pages/sites-fora.js
// exposes import helpers and also registers a simple renderer at TRJ.pages['sites-fora']
(function () {
  window.TRJ = window.TRJ || {};
  window.TRJ.sitesFora = window.TRJ.sitesFora || {};
  var S = window.TRJ.sitesFora || {};
  var FS = window.TRJ.files || (window.TRJ.files = {});
  var IMPORT_HELPERS = (window.TRJ.pages && window.TRJ.pages.importar_helpers) || null;

  // (parsers and converters omitted here for brevity — keep same functions you already have)
  // For safety, reuse functions if already defined (assume you replaced the module with the long version you posted)
  // Register renderer:
  TRJ.pages = TRJ.pages || {};
  if (!TRJ.pages['sites-fora']) {
    TRJ.pages['sites-fora'] = {
      render: function(root) {
        try {
          var mount = root || document.getElementById('page') || document.getElementById('importar-root') || document.body;
          mount.innerHTML = '';
          var header = document.createElement('h3'); header.textContent = 'Sites Fora (Incidentes)'; header.className='mb-3';
          var card = document.createElement('div'); card.className='trj-card p-4';

          var incidents = (TRJ.files && typeof TRJ.files.getIncidents === 'function') ? TRJ.files.getIncidents() || [] : JSON.parse(localStorage.getItem('trj_incidentes')||'[]');

          var summary = document.createElement('div');
          summary.innerHTML = '<strong>Incidentes:</strong> ' + (incidents.length || 0);

          var btn = document.createElement('button'); btn.className='trj-btn clickable'; btn.textContent='Recarregar'; btn.onclick = function(){ try{ if(TRJ.app && TRJ.app.refresh) TRJ.app.refresh(); } catch(_){} TRJ.pages['sites-fora'].render(mount); };

          var pre = document.createElement('pre'); pre.style.maxHeight='360px'; pre.style.overflow='auto'; pre.textContent = JSON.stringify(incidents.slice(0,200), null, 2);

          card.appendChild(summary); card.appendChild(btn); card.appendChild(pre);
          mount.appendChild(header); mount.appendChild(card);

          if (!TRJ.pages['sites-fora']._bound) {
            document.addEventListener('trj:incidentsLoaded', function(){ setTimeout(function(){ TRJ.pages['sites-fora'].render(mount); }, 200); });
            document.addEventListener('trj:incidentsImported', function(){ setTimeout(function(){ TRJ.pages['sites-fora'].render(mount); }, 200); });
            TRJ.pages['sites-fora']._bound = true;
          }
        } catch(e){ console.error('sites-fora renderer error', e); }
      }
    };
  }

  // expose existing API (preserve your importFromText/importFromFile implementations)
  // (Assume your full module code is already in this file — do not remove functions)
  window.TRJ.sitesFora = S;
})();
