/* Página: SLA / Aderência */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;

  TRJ.pages.sla = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) { container.appendChild(U.h('div', { class: 'trj-card p-6', text: 'Sem dados.' })); return; }
    var d = Comp.slaPage(data.tasksEnriched, data.prazoMap) || {};
    var porPrioridade = d.porPrioridade || [];
    var porRegiao = d.porRegiao || [];
    var geral = d.geral || { pct: 0, dentro: 0, fora: 0 };

    container.appendChild(U.pageHeader('SLA / Aderência', 'Aderência geral: ' + geral.pct + '%  (' + geral.dentro + ' dentro / ' + geral.fora + ' fora)'));

    // ---- gráfico de barras EMPILHADAS por prioridade (Dentro vs Fora do SLA) ----
    var ch = U.chartCard('Aderência por Prioridade — Dentro vs Fora do SLA');
    container.appendChild(ch.card);

    // tabela por prioridade
    var thead = U.h('thead', null, U.h('tr', null, ['Prioridade', 'Prazo (h)', 'Total', 'Dentro', 'Fora', 'Aderência'].map(function (t) { return U.h('th', { text: t }); })));
    var tbody = U.h('tbody', null, porPrioridade.map(function (p) {
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
    var tbody2 = U.h('tbody', null, porRegiao.map(function (r) {
      return U.h('tr', { class: 'cursor-pointer', onclick: function () { app.openDrillTasks({ tipo: 'regiaoSla', arg: r.regiao + '|fora' }, {}, 'Fora SLA: ' + r.label); } }, [
        U.h('td', { text: r.label }),
        U.h('td', { text: U.fmtNum(r.total) }),
        U.h('td', { text: U.fmtNum(r.dentro), style: { color: C.CORES_TRJ.green } }),
        U.h('td', { text: U.fmtNum(r.fora), style: { color: C.CORES_TRJ.red } }),
        U.h('td', { html: '<b style="color:' + (r.pct >= 90 ? C.CORES_TRJ.green : r.pct >= 70 ? C.CORES_TRJ.orange : C.CORES_TRJ.red) + '">' + r.pct + '%</b>' })
      ]);
    }));
    container.appendChild(U.h('div', { class: 'trj-card p-4' }, [U.h('h3', { class: 'text-sm font-bold mb-3', text: 'Por Região (clique para detalhar fora do SLA)' }), U.h('table', { class: 'trj-table' }, [thead2, tbody2])]));

    // barras empilhadas: verde = Dentro do SLA, vermelho = Fora do SLA, por prioridade
    U.stackedChart(ch.canvas, porPrioridade.map(function (p) {
      return { label: p.prioridade, dentro: p.dentro, fora: p.fora };
    }), {
      l1: 'Dentro do SLA', l2: 'Fora do SLA',
      onSeg: function (i, ds) {
        var p = porPrioridade[i];
        app.openDrillTasks({ tipo: 'prioridadeSla', arg: p.prioridade + '|' + (ds === 1 ? 'fora' : 'dentro') }, {}, (ds === 1 ? 'Fora SLA: ' : 'Dentro SLA: ') + p.prioridade);
      }
    });
  };
})(window.TRJ = window.TRJ || {});
