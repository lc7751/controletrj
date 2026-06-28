/* Página: Dashboard */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;
  var state = { regiao: 'TODAS', prioridade: 'TODAS' };

  TRJ.pages.dashboard = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) { container.appendChild(U.h('div', { class: 'trj-card p-6', text: 'Sem dados carregados.' })); return; }

    // Calcula o dashboard. Se algo vier vazio/indefinido, usamos defaults
    // defensivos para nunca quebrar a renderização (ex.: kpis.foraSla).
    var d = Comp.dashboard(data.tasksEnriched, data.incidentsEnriched, state) || {};
    var f = state;
    var K = d.kpis || {};
    var topCidades = d.topCidades || { totalSitesFora: 0, porAnf: [], cidades: [] };

    // ---- filtros + ações ----
    var selReg = U.h('select', { class: 'trj-select', style: { width: 'auto' }, onchange: function () { state.regiao = this.value; app.render(); } },
      [U.h('option', { value: 'TODAS', text: 'Todas as regiões' })].concat(C.REGIOES.map(function (r) {
        return U.h('option', { value: r, text: C.REGIAO_LABELS[r] || r, selected: f.regiao === r ? 'selected' : null });
      })));
    var selPri = U.h('select', { class: 'trj-select', style: { width: 'auto' }, onchange: function () { state.prioridade = this.value; app.render(); } },
      [U.h('option', { value: 'TODAS', text: 'Todas as prioridades' })].concat(C.PRIORIDADES.map(function (p) {
        return U.h('option', { value: p, text: p, selected: f.prioridade === p ? 'selected' : null });
      })));
    var btnWa = U.h('button', { class: 'trj-btn trj-btn-ghost', text: '📱 Copiar resumo', onclick: function () { copiarResumo(d); } });
    var btnExcel = U.h('button', { class: 'trj-btn trj-btn-ghost', text: '📊 Extrair Excel', onclick: function () { exportarExcelDashboard(d); } });
    var btnRef = U.h('button', { class: 'trj-btn trj-btn-primary', html: app.icon('refresh') + ' Atualizar', onclick: function () { app.refresh(); } });
    var right = U.h('div', { class: 'flex items-center gap-2 flex-wrap' }, [selReg, selPri, btnWa, btnExcel, btnRef]);
    var atualizadoEm = d.atualizadoEm ? new Date(d.atualizadoEm).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    container.appendChild(U.pageHeader('Dashboard Operacional', 'Atualizado em ' + atualizadoEm, right));

    // ---- KPIs ----
    var kpiDefs = [
      { label: 'Fora do SLA', value: U.fmtNum(K.foraSla), cor: C.CORES_TRJ.red, spec: { tipo: 'foraSla' }, t: 'Backlog fora do SLA' },
      { label: 'Backlog Total', value: U.fmtNum(K.backlogTotal), cor: C.CORES_TRJ.orange, spec: { tipo: 'backlogTotal' }, t: 'Backlog total' },
      { label: 'Backlog Indefinido', value: U.fmtNum(K.backlogIndef), cor: C.CORES_TRJ.red, spec: { tipo: 'backlogIndef' }, t: 'Backlog sem SLA definido' },
      { label: 'Preditiva', value: U.fmtNum(K.preditiva), cor: C.CORES_TRJ.orange, spec: { tipo: 'preditiva' }, t: 'Atividades preditivas' },
      { label: 'Produtividade', value: U.fmtNum(K.produtividade), cor: C.CORES_TRJ.green, spec: { tipo: 'produtividade' }, t: 'Concluídas' },
      { label: 'SLA Geral', value: U.fmtPct(K.slaGeral), cor: C.CORES_TRJ.green, spec: null, t: '' }
    ];
    var kpiGrid = U.h('div', { class: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5' }, kpiDefs.map(function (k) {
      return U.kpiCard({ label: k.label, value: k.value, cor: k.cor, onClick: k.spec ? function () { app.openDrillTasks(k.spec, f, k.t); } : null });
    }));
    container.appendChild(kpiGrid);

    // ---- charts grid ----
    var aging = U.chartCard('Aging do Backlog');
    var venc = U.chartCard('Prazos a Vencer');
    var sites = U.chartCard('Sites Fora por Região');
    var slaReg = U.chartCard('SLA por Região');
    var manu = U.chartCard('Atividades Manuais');
    var prod = U.chartCard('Produtividade Encerramento');
    var grid = U.h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5' }, [aging.card, venc.card, sites.card, slaReg.card, manu.card, prod.card]);
    container.appendChild(grid);

    // ---- top cidades ----
    container.appendChild(buildTopCidades(topCidades, app));

    // ---- desenha charts (canvas já no DOM) ----
    var aData = d.aging || [], vData = d.prazosVencimento || [], sfData = d.sitesForaRegiao || [], srData = d.slaPorRegiao || [], amData = d.atividadesManuais || [], pData = d.produtividade || [];
    U.barChart(aging.canvas, aData, { onBar: function (i) { app.openDrillTasks({ tipo: 'aging', arg: i }, f, 'Aging: ' + aData[i].label); } });
    U.hbarChart(venc.canvas, vData, { onBar: function (i) { app.openDrillTasks({ tipo: 'vencimento', arg: i }, f, 'A vencer: ' + vData[i].label); } });
    U.barChart(sites.canvas, sfData.map(function (x) { return { label: x.label, total: x.total, cor: C.CORES_TRJ.red }; }), { onBar: function (i) { app.openDrillIncidents({ tipo: 'sitesFora', arg: sfData[i].regiao }, 'Sites fora: ' + sfData[i].label); } });
    U.stackedChart(slaReg.canvas, srData, { onSeg: function (i, ds) { var r = srData[i]; app.openDrillTasks({ tipo: 'slaRegiao', arg: r.regiao + '|' + (ds === 1 ? 'fora' : 'dentro') }, f, 'SLA ' + r.label); } });
    U.donutChart(manu.canvas, amData, { cores: C.DONUT_CORES, onSlice: function (i) { var nm = amData[i].name; app.openDrillTasks({ tipo: 'atividades', arg: argAtiv(nm) }, f, nm); } });
    U.stackedChart(prod.canvas, pData.map(function (p) { return { label: p.categoria, dentro: p.dentro, fora: p.fora, preditiva: p.preditiva }; }), {
      onSeg: function (i, ds) {
        var cat = pData[i].categoria;
        var lado = ds === 2 ? 'preditiva' : (ds === 1 ? 'fora' : 'dentro');
        app.openDrillTasks({ tipo: 'produtividadeCat', arg: cat + '|' + lado }, f, 'Produtividade ' + cat + (ds === 2 ? ' — Preditiva' : (ds === 1 ? ' — Fora do SLA' : ' — Dentro do SLA')));
      }
    });
  };

  function argAtiv(name) {
    if (/WO/i.test(name)) return 'wo';
    if (/Prevent/i.test(name)) return 'prev';
    if (/Conjunta/i.test(name)) return 'conj';
    return 'outras';
  }

  function buildTopCidades(tc, app) {
    var porAnf = tc.porAnf || [], cidades = tc.cidades || [];
    var anfList = U.h('div', { class: 'flex flex-wrap gap-2 mb-4' }, porAnf.map(function (a) {
      return U.h('button', { class: 'trj-btn trj-btn-ghost', style: { fontSize: '12px' }, onclick: function () { app.openDrillIncidents({ tipo: 'anf', arg: a.anfRaw }, a.anf); },
        html: '<b>' + U.esc(a.anf) + '</b> &nbsp;<span style="color:var(--trj-primary)">' + a.total + '</span> <span style="color:var(--trj-muted)">(' + a.pct + '%)</span>' });
    }));
    var maxBars = cidades.slice(0, 15);
    var bars = U.h('div', { class: 'flex flex-col gap-2' }, maxBars.map(function (c) {
      return U.h('div', { class: 'cursor-pointer', onclick: function () { app.openDrillIncidents({ tipo: 'cidade', arg: c.cidade }, c.cidade); } }, [
        U.h('div', { class: 'flex justify-between text-xs mb-1' }, [U.h('span', { text: c.cidade }), U.h('span', { style: { color: 'var(--trj-primary)' }, text: c.total })]),
        U.h('div', { style: { background: 'rgba(255,255,255,.06)', borderRadius: '6px', height: '8px' } }, U.h('div', { style: { background: 'var(--trj-primary)', width: c.pct + '%', height: '8px', borderRadius: '6px' } }))
      ]);
    }));
    var total = U.h('div', { class: 'trj-card p-5 flex flex-col items-center justify-center', style: { minWidth: '180px' } }, [
      U.h('div', { class: 'text-xs uppercase', style: { color: 'var(--trj-muted)' }, text: 'Total Sites Fora' }),
      U.h('div', { class: 'font-extrabold', style: { fontSize: '56px', color: C.CORES_TRJ.red, lineHeight: '1' }, text: U.fmtNum(tc.totalSitesFora) })
    ]);
    return U.h('div', { class: 'trj-card p-4' }, [
      U.h('h3', { class: 'text-sm font-bold mb-3', text: 'Top Cidades — Sites Fora' }),
      U.h('div', { class: 'grid grid-cols-1 lg:grid-cols-3 gap-4' }, [
        total,
        U.h('div', { class: 'lg:col-span-2' }, [anfList, bars])
      ])
    ]);
  }

  function copiarResumo(d) {
    var K = d.kpis || {};
    var tc = d.topCidades || {};
    var linhas = [
      '*Controle TRJ — Resumo*',
      'Fora do SLA: ' + (K.foraSla || 0),
      'Backlog Total: ' + (K.backlogTotal || 0),
      'Backlog Indef.: ' + (K.backlogIndef || 0),
      'Preditiva: ' + (K.preditiva || 0),
      'Concluídas: ' + (K.produtividade || 0),
      'SLA Geral: ' + (K.slaGeral || 0) + '%',
      'Sites fora: ' + (tc.totalSitesFora || 0),
      'Atualizado: ' + new Date(d.atualizadoEm || Date.now()).toLocaleString('pt-BR')
    ];
    var txt = linhas.join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { U.toast('Resumo copiado!', 'ok'); }, function () { U.toast('Não foi possível copiar.', 'err'); });
    else U.toast('Cópia não suportada neste navegador.', 'err');
  }

  // Extrai todos os dados do Dashboard (KPIs + todos os gráficos) num único
  // arquivo Excel, uma aba por bloco — pra quem preferir analisar fora do site.
  function exportarExcelDashboard(d) {
    if (typeof XLSX === 'undefined') { U.toast('Biblioteca de Excel não carregou. Recarregue a página.', 'err'); return; }
    var K = d.kpis || {};
    var tc = d.topCidades || {};
    var wb = XLSX.utils.book_new();

    function aba(nome, aoa) {
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31)); // limite de 31 chars do Excel
    }
    function abaLista(nome, rows, cols) {
      var aoa = [cols.map(function (c) { return c.h; })];
      (rows || []).forEach(function (r) { aoa.push(cols.map(function (c) { return r[c.k] != null ? r[c.k] : ''; })); });
      aba(nome, aoa);
    }

    aba('KPIs', [
      ['Indicador', 'Valor'],
      ['Fora do SLA', K.foraSla || 0],
      ['Backlog Total', K.backlogTotal || 0],
      ['Backlog Indefinido', K.backlogIndef || 0],
      ['Preditiva', K.preditiva || 0],
      ['Produtividade (total encerradas)', K.produtividade || 0],
      ['SLA Geral (%)', K.slaGeral || 0],
      ['Sites Fora (total)', tc.totalSitesFora || 0],
      ['Atualizado em', new Date(d.atualizadoEm || Date.now()).toLocaleString('pt-BR')]
    ]);
    abaLista('Aging do Backlog', d.aging, [{ k: 'label', h: 'Faixa' }, { k: 'total', h: 'Total' }]);
    abaLista('Prazos a Vencer', d.prazosVencimento, [{ k: 'label', h: 'Faixa' }, { k: 'total', h: 'Total' }]);
    abaLista('Sites Fora por Regiao', d.sitesForaRegiao, [{ k: 'label', h: 'Região' }, { k: 'total', h: 'Total' }]);
    abaLista('SLA por Regiao', d.slaPorRegiao, [{ k: 'label', h: 'Região' }, { k: 'dentro', h: 'Dentro SLA' }, { k: 'fora', h: 'Fora SLA' }]);
    abaLista('Atividades Manuais', d.atividadesManuais, [{ k: 'name', h: 'Tipo' }, { k: 'value', h: 'Total' }]);
    abaLista('Produtividade', d.produtividade, [{ k: 'categoria', h: 'Categoria' }, { k: 'dentro', h: 'Dentro SLA' }, { k: 'fora', h: 'Fora SLA' }, { k: 'preditiva', h: 'Preditiva' }]);
    abaLista('Top Cidades', tc.cidades, [{ k: 'cidade', h: 'Cidade' }, { k: 'total', h: 'Total' }]);
    abaLista('Sites Fora por ANF', tc.porAnf, [{ k: 'anf', h: 'ANF' }, { k: 'total', h: 'Total' }, { k: 'pct', h: '%' }]);

    var ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    XLSX.writeFile(wb, 'Dashboard_TRJ_' + ts + '.xlsx');
    U.toast('Excel exportado!', 'ok');
  }
})(window.TRJ = window.TRJ || {});
