/* Página: SLA / Aderência — gráficos pizza por prioridade e por região */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;

  TRJ.pages.sla = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) { container.appendChild(U.h('div', { class: 'trj-card p-6', text: 'Sem dados.' })); return; }
    var d = Comp.slaPage(data.tasksEnriched, data.prazoMap) || {};
    var porPrioridade = d.porPrioridade || [];
    var porRegiao     = d.porRegiao     || [];
    var geral         = d.geral         || { pct: 0, dentro: 0, fora: 0 };

    container.appendChild(U.pageHeader('SLA / Aderência',
      'Aderência geral: ' + geral.pct + '%  (' + geral.dentro + ' dentro / ' + geral.fora + ' fora)'));

    // ── Gráficos pizza por prioridade (grade 3×2 ou automático) ────────
    var prioGrid = U.h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '16px', marginBottom: '24px' } });
    porPrioridade.forEach(function (p) {
      var corPct = p.pct >= 90 ? C.CORES_TRJ.green : p.pct >= 70 ? C.CORES_TRJ.orange : C.CORES_TRJ.red;
      var ch = U.chartCard(p.prioridade, { small: true });
      ch.card.style.cursor = 'pointer';
      prioGrid.appendChild(ch.card);

      // Prazo + aderência abaixo do canvas
      ch.card.appendChild(U.h('div', {
        style: { textAlign: 'center', fontSize: '11px', color: 'var(--trj-muted)', marginTop: '6px' }
      }, [
        U.h('span', { text: 'Prazo: ' + p.prazoHoras + 'h  · ' }),
        U.h('b', { style: { color: corPct }, text: p.pct + '% aderência' }),
        U.h('br'),
        U.h('span', { text: p.dentro + ' dentro / ' + p.fora + ' fora' })
      ]));

      U.donutChart(ch.canvas, [
        { label: 'Dentro SLA', value: p.dentro, cor: C.CORES_TRJ.green },
        { label: 'Fora SLA',   value: p.fora,   cor: C.CORES_TRJ.red   }
      ], {
        onSlice: function (i) {
          var lado = i === 0 ? 'dentro' : 'fora';
          app.openDrillTasks({ tipo: 'prioridadeSla', arg: p.prioridade + '|' + lado }, {},
            (lado === 'fora' ? 'Fora SLA: ' : 'Dentro SLA: ') + p.prioridade);
        }
      });
    });
    container.appendChild(U.h('div', { class: 'trj-card p-4 mb-5' }, [
      U.h('h3', { class: 'text-sm font-bold mb-4', text: 'Aderência por Prioridade' }),
      prioGrid
    ]));

    // ── Gráfico geral (pizza única Dentro vs Fora) ─────────────────────
    var chGeral = U.chartCard('Aderência Geral', { small: true });
    U.donutChart(chGeral.canvas, [
      { label: 'Dentro SLA', value: geral.dentro, cor: C.CORES_TRJ.green },
      { label: 'Fora SLA',   value: geral.fora,   cor: C.CORES_TRJ.red   }
    ]);

    // ── Tabela por região ──────────────────────────────────────────────
    var thead2 = U.h('thead', null, U.h('tr', null,
      ['Região','Total','Dentro','Fora','Aderência'].map(function (t) { return U.h('th', { text: t }); })));
    var tbody2 = U.h('tbody', null, porRegiao.map(function (r) {
      var corR = r.pct >= 90 ? C.CORES_TRJ.green : r.pct >= 70 ? C.CORES_TRJ.orange : C.CORES_TRJ.red;
      return U.h('tr', { class: 'cursor-pointer',
        onclick: function () { app.openDrillTasks({ tipo: 'regiaoSla', arg: r.regiao + '|fora' }, {}, 'Fora SLA: ' + r.label); }
      }, [
        U.h('td', { text: r.label }),
        U.h('td', { text: U.fmtNum(r.total) }),
        U.h('td', { text: U.fmtNum(r.dentro), style: { color: C.CORES_TRJ.green } }),
        U.h('td', { text: U.fmtNum(r.fora),   style: { color: C.CORES_TRJ.red   } }),
        U.h('td', { html: '<b style="color:' + corR + '">' + r.pct + '%</b>' })
      ]);
    }));

    container.appendChild(U.h('div', { class: 'grid grid-cols-1 lg:grid-cols-3 gap-4' }, [
      U.h('div', { class: 'lg:col-span-1' }, chGeral.card),
      U.h('div', { class: 'lg:col-span-2 trj-card p-4' }, [
        U.h('h3', { class: 'text-sm font-bold mb-3', text: 'Por Região (clique para detalhar fora do SLA)' }),
        U.h('div', { style: { overflowX: 'auto' } }, U.h('table', { class: 'trj-table' }, [thead2, tbody2]))
      ])
    ]));
  };
})(window.TRJ = window.TRJ || {});
