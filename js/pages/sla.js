// js/pages/sla.js
(function(){
  if (!window.TRJ) window.TRJ = {};
  TRJ.pages = TRJ.pages || {};

  TRJ.pages.sla = {
    render: function(root) {
      try {
        var mount = root || document.getElementById('page') || document.body;
        mount.innerHTML = '';

        var header = document.createElement('h3'); header.textContent = 'SLA / Aderência'; header.className = 'mb-3';
        var card = document.createElement('div'); card.className = 'trj-card p-4';

        var tasks = (TRJ.files && typeof TRJ.files.getTasks === 'function') ? TRJ.files.getTasks() || [] : JSON.parse(localStorage.getItem('trj_tasks')||'[]');

        // compute simple SLA summary: fraction with withinSLA flag if present, else default unknown
        var within = tasks.filter(function(t){ return t.withinSLA === true || t.within_sla === true || t.aderencia === 'within'; }).length;
        var total = tasks.length || 0;
        var outside = total - within;
        var pct = total ? Math.round((within/total)*100) : 0;

        var summary = document.createElement('div');
        summary.innerHTML = '<strong>Total tarefas:</strong> ' + total + ' &nbsp;&nbsp; <strong>Dentro SLA:</strong> ' + within + ' &nbsp;&nbsp; <strong>Fora SLA:</strong> ' + outside + ' &nbsp;&nbsp; <strong>Pct:</strong> ' + pct + '%';

        // placeholder chart area (consumir Chart.js later)
        var chartWrap = document.createElement('div'); chartWrap.style.marginTop='12px';
        chartWrap.innerHTML = '<div style="height:180px;display:flex;align-items:center;justify-content:center;color:var(--trj-muted);">Gráfico Aderência por Prioridade (placeholder)</div>';

        card.appendChild(summary);
        card.appendChild(chartWrap);
        mount.appendChild(header);
        mount.appendChild(card);

        if (!TRJ.pages.sla._bound) {
          document.addEventListener('trj:tasksLoaded', function(){ setTimeout(function(){ TRJ.pages.sla.render(mount); }, 200); });
          TRJ.pages.sla._bound = true;
        }
      } catch(e){ console.error('sla render error', e); }
    }
  };
})();
