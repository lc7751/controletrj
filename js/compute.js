// Função para renderizar Aderência por Prioridade (barras empilhadas)
function renderAderenciaPorPrioridade(containerEl, tasks) {
  // tasks: array de objetos (se não enviado, tenta carregar do localStorage)
  tasks = tasks || JSON.parse(localStorage.getItem('trj_tasks') || '[]');

  // Normaliza prioridade e sla (ex.: campo prioridade, statusSla / SLA)
  const grouped = {};
  tasks.forEach(t => {
    const prio = (t.prioridade || t.PRIORIDADE || 'SEM PRIORIDADE').toString().trim().toUpperCase();
    const slaStatus = (t.statusSla || t.STATUS_SLA || t.sla || '').toString().toUpperCase();
    const dentro = slaStatus.indexOf('DENTRO') >= 0 || slaStatus.indexOf('OK') >= 0 || slaStatus.indexOf('DENT') >= 0;
    grouped[prio] = grouped[prio] || { label: prio, dentro: 0, fora: 0 };
    if (dentro) grouped[prio].dentro++;
    else grouped[prio].fora++;
  });

  // Constrói arrays ordenadas (por exemplo: ALTA, MÉDIA, BAIXA, OUTROS)
  const order = ['ALTA','ALTA PRIORIDADE','MÉDIA','MEDIA','BAIXA','OUTROS','SEM PRIORIDADE'];
  const dataArr = Object.keys(grouped).map(k => grouped[k]);
  dataArr.sort((a,b)=>{
    const ia = order.indexOf(a.label);
    const ib = order.indexOf(b.label);
    if (ia === -1 && ib === -1) return a.label.localeCompare(b.label);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  // Se containerEl for id string, resolve
  if (typeof containerEl === 'string') containerEl = document.getElementById(containerEl);
  if (!containerEl) return;

  containerEl.innerHTML = '';
  const wrap = TRJ.ui.chartCard('Aderência por Prioridade (%)', { hint: 'Dentro vs Fora do SLA' });
  containerEl.appendChild(wrap.card);
  const canvas = wrap.canvas;

  const chartData = dataArr.map(d => ({ label: d.label, dentro: d.dentro, fora: d.fora }));

  // Usa o helper stackedChart do TRJ.ui
  TRJ.ui.stackedChart(canvas, chartData, { l1: 'Dentro do SLA', l2: 'Fora do SLA' });
}