// js/pages/regional.js
(function(){
  if (!window.TRJ) window.TRJ = {};
  TRJ.pages = TRJ.pages || {};

  TRJ.pages.regional = {
    render: function(root) {
      try {
        var mount = root || document.getElementById('page') || document.body;
        mount.innerHTML = '';

        var header = document.createElement('h3'); header.textContent = 'Por Região'; header.className = 'mb-3';
        var card = document.createElement('div'); card.className = 'trj-card p-4';

        var tasks = (TRJ.files && typeof TRJ.files.getTasks === 'function') ? TRJ.files.getTasks() || [] : JSON.parse(localStorage.getItem('trj_tasks')||'[]');

        var summary = document.createElement('div');
        var regions = {};
        tasks.forEach(function(t){
          var r = (t._raw && (t._raw.region || t._raw.REGION)) || t.region || 'N/D';
          regions[r] = (regions[r] || 0) + 1;
        });

        var list = document.createElement('div'); list.style.marginTop='8px';
        Object.keys(regions).slice(0,50).forEach(function(r){
          var row = document.createElement('div'); row.className='trj-row';
          row.textContent = r + ': ' + regions[r];
          list.appendChild(row);
        });

        summary.innerHTML = '<strong>Regiões encontradas:</strong> ' + Object.keys(regions).length;
        card.appendChild(summary);
        card.appendChild(list);
        mount.appendChild(header);
        mount.appendChild(card);

        if (!TRJ.pages.regional._bound) {
          document.addEventListener('trj:tasksLoaded', function(){ setTimeout(function(){ TRJ.pages.regional.render(mount); }, 200); });
          TRJ.pages.regional._bound = true;
        }
      } catch(e){ console.error('regional render error', e); }
    }
  };
})();
