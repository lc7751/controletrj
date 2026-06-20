/* Página: SLA / Aderência */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;

  TRJ.pages.sla = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) { container.appendChild(U.h('div', { class: 'trj-card p-6', text: 'Sem dados.' })); return; }
    var d = Comp.slaPage(data.tasksEnriched, data.prazoMap);

    container.appendChild(U.pageHeader('SLA / Aderência', 'Aderência geral: ' + d.geral.pct + '%  (' + d.geral.dentro + ' dentro / ' + d.geral.fora + ' fora)'));

    // chart por prioridade
    var ch = U.chartCard('Aderência por Prioridade (%)');
    container.appendChild(ch.card);

    // tabela por prioridade
    var thead = U.h('thead', null, U.h('tr', null, ['Prioridade', 'Prazo (h)', 'Total', 'Dentro', 'Fora', 'Aderência'].map(function (t) { return U.h('th', { text: t }); })));
    var tbody = U.h('tbody', null, d.porPrioridade.map(function (p) {
      return U.h('tr', null, [
        U.h('td', { html: '<b>' + p.prioridade + '</b>' }),
        U.h('td', { text: p.prazoHoras }),
        U.h('td', { text: U.fmtNum(p.total) }),
        U.h('td', { text: U.fmtNum(p.dentro), style: { color: C.CORES_TRJ.green } }),
        U.h('td', { text: U.fmtNum(p.fora), style: { color: C.CORES_TRJ.red } }),
        U.h('td', { html: '<b style="color:' + (p.pct >= 90 ? C.CORES_TRJ.green : p.pct >= 70 ? C.CORES_TRJ.orange : C.CORES_TRJ.red) + '">' + p.pct + '%</b>' })
      ]);
    }));
    container.appendChild(U.h('div', { class: 'trj-card p-4 mb-5' }, [U.h('h3', { class: 'text-sm font-bold mb-3', text: 'Por Prioridade' }), U.h('table', { class: 'trj-table' }, [thead, tbody])]));

    // tabela por regiao
    var thead2 = U.h('thead', null, U.h('tr', null, ['Região', 'Total', 'Dentro', 'Fora', 'Aderência'].map(function (t) { return U.h('th', { text: t }); })));
    var tbody2 = U.h('tbody', null, d.porRegiao.map(function (r) {
      return U.h('tr', { class: 'cursor-pointer', onclick: function () { app.openDrillTasks({ tipo: 'regiaoSla', arg: r.regiao + '|fora' }, {}, 'Fora SLA: ' + r.label); } }, [
        U.h('td', { text: r.label }),
        U.h('td', { text: U.fmtNum(r.total) }),
        U.h('td', { text: U.fmtNum(r.dentro), style: { color: C.CORES_TRJ.green } }),
        U.h('td', { text: U.fmtNum(r.fora), style: { color: C.CORES_TRJ.red } }),
        U.h('td', { html: '<b style="color:' + (r.pct >= 90 ? C.CORES_TRJ.green : r.pct >= 70 ? C.CORES_TRJ.orange : C.CORES_TRJ.red) + '">' + r.pct + '%</b>' })
      ]);
    }));
    container.appendChild(U.h('div', { class: 'trj-card p-4' }, [U.h('h3', { class: 'text-sm font-bold mb-3', text: 'Por Região (clique para detalhar fora do SLA)' }), U.h('table', { class: 'trj-table' }, [thead2, tbody2])]));

    U.barChart(ch.canvas, d.porPrioridade.map(function (p) {
      return { label: p.prioridade, total: p.pct, cor: p.pct >= 90 ? C.CORES_TRJ.green : p.pct >= 70 ? C.CORES_TRJ.orange : C.CORES_TRJ.red };
    }), { onBar: function (i) { var p = d.porPrioridade[i]; app.openDrillTasks({ tipo: 'prioridadeSla', arg: p.prioridade + '|fora' }, {}, 'Fora SLA: ' + p.prioridade); } });
  };
})(window.TRJ = window.TRJ || {});
