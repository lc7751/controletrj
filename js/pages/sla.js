// js/pages/sla.js (Atualizado com Barras Empilhadas)
(function(){
  if (!window.TRJ) window.TRJ = {};
  TRJ.pages = TRJ.pages || {};

  TRJ.pages.sla = {
    render: function(root) {
      try {
        var mount = root || document.getElementById('page') || document.body;
        mount.innerHTML = '';

        var h = document.createElement('h3'); h.textContent = 'Aderência por Prioridade (%)'; h.className='mb-3';
        var card = document.createElement('div'); card.className = 'trj-card p-4 clickable'; // .clickable aqui!

        var tasks = (TRJ.files && TRJ.files.getTasks) ? TRJ.files.getTasks() : [];
        
        // Agrupar por prioridade
        var prios = ["P1", "P2", "P3", "P4"];
        var dataSla = [0, 0, 0, 0];
        var dataFora = [0, 0, 0, 0];

        tasks.forEach(function(t) {
          var p = (t._raw && (t._raw.PRIORIDADE || t._raw.Prio)) || "P4";
          var idx = prios.indexOf(p);
          if (idx === -1) idx = 3;
          
          if (t.withinSLA === true) dataSla[idx]++;
          else dataFora[idx]++;
        });

        card.innerHTML = '<canvas id="chart-sla-priority" style="max-height:300px;"></canvas>';
        mount.appendChild(h); mount.appendChild(card);

        // Inicializar Chart.js (Barras Empilhadas)
        setTimeout(function() {
          var ctx = document.getElementById('chart-sla-priority');
          if (!ctx || !window.Chart) return;
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: prios,
              datasets: [
                { label: 'Dentro SLA', data: dataSla, backgroundColor: '#ff8c00' },
                { label: 'Fora SLA', data: dataFora, backgroundColor: '#33333a' }
              ]
            },
            options: {
              responsive: true,
              plugins: { legend: { labels: { color: '#8a8a93' } } },
              scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#8a8a93' } },
                y: { stacked: true, grid: { color: '#1a1a24' }, ticks: { color: '#8a8a93' } }
              }
            }
          });
        }, 100);

      } catch(e) { console.error(e); }
    }
  };
})();
