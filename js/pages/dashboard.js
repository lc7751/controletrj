// js/pages/dashboard.js
(function(){
  if (!window.TRJ) window.TRJ = {};
  TRJ.pages = TRJ.pages || {};

  TRJ.pages.dashboard = {
    render: function(root) {
      try {
        var mount = root || document.getElementById('page') || document.getElementById('importar-root') || document.body;
        mount.innerHTML = '';

        var header = document.createElement('h3'); header.textContent = 'Dashboard'; header.className = 'mb-3';
        var card = document.createElement('div'); card.className = 'trj-card p-4';

        var tasks = (TRJ.files && typeof TRJ.files.getTasks === 'function') ? TRJ.files.getTasks() || [] : JSON.parse(localStorage.getItem('trj_tasks')||'[]');
        var incidents = (TRJ.files && typeof TRJ.files.getIncidents === 'function') ? TRJ.files.getIncidents() || [] : JSON.parse(localStorage.getItem('trj_incidentes')||'[]');

        var summary = document.createElement('div');
        summary.innerHTML = '<strong>Tarefas:</strong> ' + (tasks.length || 0) + ' &nbsp;&nbsp; <strong>Incidentes:</strong> ' + (incidents.length || 0);

        var p = document.createElement('p');
        p.style.margin = '8px 0';
        p.textContent = 'Visão geral rápida. Clique em "Detalhar" para abrir páginas específicas.';

        var btns = document.createElement('div');
        btns.style.marginTop = '10px';
        var b1 = document.createElement('button'); b1.className='trj-btn clickable'; b1.textContent='Recarregar'; b1.onclick = function(){ try{ if(TRJ.app && TRJ.app.refresh) TRJ.app.refresh(); } catch(_){ } TRJ.pages.dashboard.render(mount); };
        btns.appendChild(b1);

        // mini list of top 10 incidents
        var list = document.createElement('div'); list.style.marginTop='12px';
        list.innerHTML = '<strong>Últimos incidentes (top 10):</strong>';
        var ul = document.createElement('div'); ul.style.marginTop='8px';
        (incidents.slice(0,10) || []).forEach(function(inc){
          var div = document.createElement('div');
          div.className = 'trj-row';
          div.textContent = (inc.site || inc._raw && (inc._raw.SITE || inc._raw.Site) || '') + ' — ' + (inc.motivo || inc._raw && inc._raw.MOTIVO || '');
          ul.appendChild(div);
        });
        list.appendChild(ul);

        card.appendChild(summary);
        card.appendChild(p);
        card.appendChild(btns);
        card.appendChild(list);
        mount.appendChild(header);
        mount.appendChild(card);

        // subscribe updates
        if (!TRJ.pages.dashboard._bound) {
          document.addEventListener('trj:tasksLoaded', function(){ setTimeout(function(){ TRJ.pages.dashboard.render(mount); }, 200); });
          document.addEventListener('trj:incidentsLoaded', function(){ setTimeout(function(){ TRJ.pages.dashboard.render(mount); }, 200); });
          TRJ.pages.dashboard._bound = true;
        }
      } catch(e) { console.error('dashboard render error', e); }
    }
  };
})();
