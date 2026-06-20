// compute.js - funções de cálculo e renderização dos gráficos
(function(){
  function renderAderenciaPorPrioridade(ctxElement, priorities, inSLAData, outSLAData){
    const ctx = ctxElement.getContext('2d');
    if(ctx.__myChart) ctx.__myChart.destroy();
    ctx.__myChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: priorities,
        datasets: [
          { label: 'Dentro do SLA', data: inSLAData, backgroundColor: 'rgba(46,204,113,0.85)', stack: 'Stack 0' },
          { label: 'Fora do SLA', data: outSLAData, backgroundColor: 'rgba(231,76,60,0.85)', stack: 'Stack 0' }
        ]
      },
      options: {
        plugins: { tooltip: { mode: 'index', intersect: false } },
        responsive: true,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { callback: function(v){ return v + '%'; } } } }
      }
    });
    return ctx.__myChart;
  }

  window.TRJ = window.TRJ || {}; window.TRJ.compute = window.TRJ.compute || {};
  window.TRJ.compute.renderAderenciaPorPrioridade = renderAderenciaPorPrioridade;
})();
