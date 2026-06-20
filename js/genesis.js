// genesis.js - wrapper que prepara dados para os gráficos
(function(){
  function prepareAderenciaData(tasks){
    // tasks: array de objetos contendo prioridade e indicador SLA (dentro/fora)
    const priorities = [];
    const inMap = {}; const outMap = {};
    (tasks||[]).forEach(t=>{
      const p = t.PRIORIDADE || t.prioridade || (t.priority||'N/A');
      const inSla = ((''+(t.DENTRO_SLA||t.dentro_sla||t.in_sla||t.aderencia)).toLowerCase().indexOf('true')>=0) || (t.status && t.status.toLowerCase && t.status.toLowerCase().includes('dentro'));
      if(!priorities.includes(p)) priorities.push(p);
      if(inSla) inMap[p] = (inMap[p]||0) + 1; else outMap[p] = (outMap[p]||0) + 1;
    });
    // build arrays
    const inArr = priorities.map(p=> Math.round((inMap[p]||0) / ((inMap[p]||0)+(outMap[p]||0)) * 100) || 0 );
    const outArr = priorities.map(p=> Math.round((outMap[p]||0) / ((inMap[p]||0)+(outMap[p]||0)) * 100) || 0 );
    return { priorities, inArr, outArr };
  }

  window.TRJ = window.TRJ || {}; window.TRJ.genesis = window.TRJ.genesis || {};
  window.TRJ.genesis.prepareAderenciaData = prepareAderenciaData;
})();
