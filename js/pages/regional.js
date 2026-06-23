/* Página: Visão Regional */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;

  TRJ.pages.regional = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) { container.appendChild(U.h('div', { class: 'trj-card p-6', text: 'Sem dados.' })); return; }
    var d = Comp.regionalPage(data.tasksEnriched);

    container.appendChild(U.pageHeader('Visão Regional', 'Backlog e aderência por região'));

    var grid = U.h('div', { class: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' }, d.resumo.map(function (r) {
      var cor = r.aderencia >= 90 ? C.CORES_TRJ.green : r.aderencia >= 70 ? C.CORES_TRJ.orange : C.CORES_TRJ.red;
      return U.h('div', { class: 'trj-card p-5' }, [
        U.h('div', { class: 'flex items-center justify-between mb-3' }, [
          U.h('h3', { class: 'font-bold', style: { color: 'var(--trj-primary)' }, text: r.label }),
          U.h('span', { class: 'trj-badge', style: { color: cor, background: 'rgba(255,255,255,.06)' }, text: r.aderencia + '%' })
        ]),
        U.h('div', { class: 'grid grid-cols-2 gap-3 text-sm' }, [
          metric('Total', U.fmtNum(r.total)),
          metric('Backlog', U.fmtNum(r.backlog), C.CORES_TRJ.orange, function () { app.openDrillTasks({ tipo: 'regiaoBacklog', arg: r.regiao }, {}, 'Backlog: ' + r.label); }),
          metric('Dentro SLA', U.fmtNum(r.dentroSla), C.CORES_TRJ.green),
          metric('Fora SLA', U.fmtNum(r.foraSla), C.CORES_TRJ.red, function () { app.openDrillTasks({ tipo: 'regiaoSla', arg: r.regiao + '|fora' }, {}, 'Fora SLA: ' + r.label); })
        ])
      ]);
    }));
    container.appendChild(grid);
  };

  function metric(label, value, cor, onClick) {
    var box = TRJ.ui.h('div', { class: onClick ? 'cursor-pointer' : '' }, [
      TRJ.ui.h('div', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: label }),
      TRJ.ui.h('div', { class: 'font-bold text-lg', style: { color: cor || 'var(--trj-fg)' }, text: value })
    ]);
    if (onClick) box.addEventListener('click', onClick);
    return box;
  }
})(window.TRJ = window.TRJ || {});
