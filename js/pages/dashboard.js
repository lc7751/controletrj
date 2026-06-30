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

    // Publica automaticamente uma "foto" SEM FILTROS (visão completa, não
    // o que o operador estiver filtrando agora) pro link público de
    // visualização — silencioso, não bloqueia a tela nem mostra erro.
    publicarSnapshotPublico(data);

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
    var btnExcel = U.h('button', {
      class: 'trj-btn clickable',
      style: { background: 'rgba(33,115,70,.18)', color: '#2e7d46', border: '1px solid rgba(33,115,70,.4)', fontWeight: '700', gap: '6px', transition: 'all .2s ease' },
      onclick: function () { exportarExcelDashboard(d, data); },
      onmouseenter: function (ev) { ev.currentTarget.style.background = 'rgba(33,115,70,.35)'; ev.currentTarget.style.borderColor = '#2e7d46'; ev.currentTarget.style.boxShadow = '0 4px 14px rgba(33,115,70,.3)'; },
      onmouseleave: function (ev) { ev.currentTarget.style.background = 'rgba(33,115,70,.18)'; ev.currentTarget.style.borderColor = 'rgba(33,115,70,.4)'; ev.currentTarget.style.boxShadow = ''; }
    }, [
      // Ícone SVG do Excel (X estilizado no verde Microsoft)
      U.h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor', style: { flexShrink: '0' } }, [
        U.h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        U.h('polyline', { fill: 'none', stroke: 'rgba(33,115,70,.18)', 'stroke-width': '1.5', points: '14 2 14 8 20 8' }),
        U.h('line', { fill: 'none', stroke: '#fff', 'stroke-width': '1.5', x1: '8', y1: '13', x2: '16', y2: '21' }),
        U.h('line', { fill: 'none', stroke: '#fff', 'stroke-width': '1.5', x1: '16', y1: '13', x2: '8', y2: '21' })
      ]),
      U.h('span', { text: 'Extrair Excel' })
    ]);
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
      { label: 'Produtividade (Concluídas)', value: U.fmtNum(K.produtividade), cor: C.CORES_TRJ.green, spec: { tipo: 'produtividade' }, t: 'TSKs concluídas' },
      { label: 'SLA Geral (Concluídas)', value: U.fmtPct(K.slaGeral), cor: C.CORES_TRJ.green, spec: { tipo: 'produtividade' }, t: 'TSKs concluídas — % dentro do prazo' }
    ];
    var kpiGrid = U.h('div', { class: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5' }, kpiDefs.map(function (k) {
      return U.kpiCard({ label: k.label, value: k.value, cor: k.cor, onClick: k.spec ? function () { app.openDrillTasks(k.spec, f, k.t); } : null });
    }));
    container.appendChild(kpiGrid);

    // ---- charts grid ----
    var aging = U.chartCard('Aging do Backlog');
    var venc = U.chartCard('Prazos a Vencer');

    // Sites Fora por Região — com toggle de agrupamento por END_ID
    var sfAgrupar = { value: false };
    var switchSf = U.switch(false, 'Por END_ID', function (v) { sfAgrupar.value = v; });
    switchSf.style.cssText += 'font-size:11px;';
    var sites = U.chartCard('Sites Fora por Região', { hint: switchSf });
    var slaReg = U.chartCard('SLA por Região');
    var manu = U.chartCard('Atividades Manuais', { hint: 'inclui cancelamentos' });
    var prod = U.chartCard('Produtividade — Encerradas Dentro/Fora do SLA');
    var grid = U.h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5' }, [aging.card, venc.card, sites.card, slaReg.card, manu.card, prod.card]);
    container.appendChild(grid);

    // ---- top cidades ----
    container.appendChild(buildTopCidades(topCidades, app));

    // ---- desenha charts (canvas já no DOM) ----
    var aData = d.aging || [], vData = d.prazosVencimento || [], sfData = d.sitesForaRegiao || [], srData = d.slaPorRegiao || [], amData = d.atividadesManuais || [], pData = d.produtividade || [];
    U.barChart(aging.canvas, aData, { onBar: function (i) { app.openDrillTasks({ tipo: 'aging', arg: i }, f, 'Aging: ' + aData[i].label); } });
    U.hbarChart(venc.canvas, vData, { onBar: function (i) { app.openDrillTasks({ tipo: 'vencimento', arg: i }, f, 'A vencer: ' + vData[i].label); } });
    U.barChart(sites.canvas, sfData.map(function (x) { return { label: x.label, total: x.total, cor: C.CORES_TRJ.red }; }), {
      onBar: function (i) {
        var tipo = sfAgrupar.value ? 'sitesForaAgrupado' : 'sitesFora';
        var titulo = 'Sites fora' + (sfAgrupar.value ? ' (agrupado)' : '') + ': ' + sfData[i].label;
        app.openDrillIncidents({ tipo: tipo, arg: sfData[i].regiao }, titulo);
      }
    });
    U.stackedChart(slaReg.canvas, srData, { onSeg: function (i, ds) { var r = srData[i]; app.openDrillTasks({ tipo: 'slaRegiao', arg: r.regiao + '|' + (ds === 1 ? 'fora' : 'dentro') }, f, 'SLA ' + r.label); } });
    U.donutChart(manu.canvas, amData, {
      cores: C.DONUT_CORES,
      onSlice: function (i) {
        var nm = amData[i].name;
        var ehCancel = nm.indexOf('Cancel.') === 0;
        var spec = ehCancel
          ? { tipo: 'cancelCorretiva', arg: nm.indexOf('Associa') >= 0 ? 'assoc' : 'auto' }
          : { tipo: 'atividades', arg: argAtiv(nm) };
        // canceladas: mostrar "Dentro SLA / Fora SLA", não "Vence em"
        app.openDrillTasks(spec, f, nm, ehCancel ? { modoResultado: true } : {});
      }
    });
    U.stackedChart(prod.canvas, pData.map(function (p) { return { label: p.categoria, dentro: p.dentro, fora: p.fora, preditiva: p.preditiva }; }), {
      onSeg: function (i, ds) {
        var cat = pData[i].categoria;
        var lado = ds === 2 ? 'preditiva' : (ds === 1 ? 'fora' : 'dentro');
        var titulo = 'Produtividade ' + cat + (ds === 2 ? ' — Preditiva' : (ds === 1 ? ' — Fora do SLA' : ' — Dentro do SLA'));
        // produtividade: mostrar "Dentro SLA / Fora SLA", não "Vence em"
        app.openDrillTasks({ tipo: 'produtividadeCat', arg: cat + '|' + lado }, f, titulo, { modoResultado: true });
      }
    });
  };

  function argAtiv(name) {
    if (/WO/i.test(name)) return 'wo';
    if (/Prevent/i.test(name)) return 'prev';
    if (/Conjunta/i.test(name)) return 'conj';
    return 'outras';
  }

  // Publica uma "foto" do Dashboard SEM FILTROS (visão completa da
  // equipe) pro link público de visualização. Best-effort: nunca trava a
  // tela nem mostra erro pro operador, e só manda de novo se algo mudou
  // desde a última publicação (evita gravação repetida sem necessidade).
  // Publica os dados BRUTOS (tarefas + incidentes) pro link público de
  // visualização — não os números já calculados, pra a página pública
  // poder filtrar por região e abrir os drills igual ao painel principal.
  // Best-effort: nunca trava a tela nem mostra erro pro operador, e só
  // manda de novo se algo mudou desde a última publicação.
  var _ultimoSnapshotJSON = null;

  // Reduz cada tarefa enriquecida a só os campos que o dashboard público
  // (compute.js + ui.js, rodando de novo do zero em cima do snapshot)
  // realmente lê. Sem isso, o JSON publicado vinha gigante: testei com
  // 270 tarefas reais e deu ~770KB só de tasksEnriched — boa parte disso
  // é a coluna "Diário de Trabalho" (motivoCancelamento), que pode ter
  // até ~10 mil caracteres em uma única tarefa cancelada. Como só
  // importa saber se contém "ASSOCIAÇÃO DE ATIVIDADES" ou não, mantemos
  // o MESMO nome de campo (pra não mudar nada em compute.js) só que com
  // o texto cortado pro essencial.
  function slimTaskForPublish(t) {
    var motivo = (t.motivoCancelamento || '').toString();
    var motivoSlim = /ASSOCIA/i.test(motivo) ? 'ASSOCIAÇÃO DE ATIVIDADES' : (motivo ? 'AUTOMACAO' : '');
    return {
      osNumero: t.osNumero, sequenciaId: t.sequenciaId, tipoAtividade: t.tipoAtividade,
      status: t.status, filaAtual: t.filaAtual, prioridade: t.prioridade,
      dataCriacao: t.dataCriacao, enderecoId: t.enderecoId, siteId: t.siteId,
      cidade: t.cidade, regiao: t.regiao, tipoFalha: t.tipoFalha,
      vencimentoCalc: t.vencimentoCalc, fimCalc: t.fimCalc,
      statusSla: t.statusSla, fonteSla: t.fonteSla, motivoCancelamento: motivoSlim
    };
  }

  function publicarSnapshotPublico(data) {
    try {
      var payload = {
        tasksEnriched: (data.tasksEnriched || []).map(slimTaskForPublish),
        incidentsEnriched: data.incidentsEnriched || []
      };
      var jsonStr = JSON.stringify(payload);
      if (jsonStr === _ultimoSnapshotJSON) return;
      _ultimoSnapshotJSON = jsonStr;
      TRJ.api.saveDashboardSnapshot(payload).catch(function () {});
    } catch (e) { /* nunca deixa a publicação quebrar o Dashboard */ }
  }

  function buildTopCidades(tc, app) {
    var porAnf = tc.porAnf || [], cidades = tc.cidades || [];

    var anfList = U.h('div', { class: 'flex flex-wrap gap-2 mb-4' }, porAnf.map(function (a) {
      var chip = U.h('button', {
        class: 'trj-btn trj-btn-ghost',
        style: { fontSize: '12px', transition: 'all .2s ease' },
        onclick: function () { app.openDrillIncidents({ tipo: 'anf', arg: a.anfRaw }, a.anf); }
      }, [
        U.h('span', { class: 'font-bold', text: a.anf }),
        U.h('span', { style: { color: 'var(--trj-primary)', marginLeft: '6px' }, text: String(a.total) }),
        U.h('span', { style: { color: 'var(--trj-muted)', marginLeft: '4px', fontSize: '11px' }, text: '(' + a.pct + '%)' })
      ]);
      chip.addEventListener('mouseenter', function () { chip.style.transform = 'translateY(-2px)'; chip.style.borderColor = 'rgba(255,140,0,.6)'; chip.style.boxShadow = '0 6px 16px rgba(255,140,0,.2)'; });
      chip.addEventListener('mouseleave', function () { chip.style.transform = ''; chip.style.borderColor = ''; chip.style.boxShadow = ''; });
      return chip;
    }));

    var bars = U.h('div', { class: 'flex flex-col gap-1' }, cidades.slice(0, 15).map(function (c) {
      var barra = U.h('div', { style: { width: c.pct + '%', height: '8px', borderRadius: '6px', background: 'var(--trj-primary)', transition: 'all .2s ease' } });
      var item = U.h('div', { style: { cursor: 'pointer', padding: '5px 8px', borderRadius: '8px', transition: 'background .18s ease' } }, [
        U.h('div', { class: 'flex justify-between text-xs mb-1' }, [
          U.h('span', { style: { fontWeight: '600' }, text: c.cidade }),
          U.h('span', { style: { color: 'var(--trj-primary)', fontWeight: '700' }, text: String(c.total) })
        ]),
        U.h('div', { style: { background: 'rgba(255,255,255,.07)', borderRadius: '6px', height: '8px', overflow: 'hidden' } }, barra)
      ]);
      item.addEventListener('mouseenter', function () {
        item.style.background = 'rgba(255,140,0,.1)';
        barra.style.background = 'var(--trj-primary2)';
        barra.style.boxShadow = '0 0 10px rgba(255,140,0,.5)';
      });
      item.addEventListener('mouseleave', function () { item.style.background = ''; barra.style.background = 'var(--trj-primary)'; barra.style.boxShadow = ''; });
      item.addEventListener('click', function () { app.openDrillIncidents({ tipo: 'cidade', arg: c.cidade }, c.cidade); });
      return item;
    }));

    var total = U.h('div', { class: 'trj-card p-5 flex flex-col items-center justify-center', style: { minWidth: '180px' } }, [
      U.h('div', { class: 'text-xs uppercase', style: { color: 'var(--trj-muted)' }, text: 'Total Sites Fora' }),
      U.h('div', { class: 'font-extrabold', style: { fontSize: '56px', color: C.CORES_TRJ.red, lineHeight: '1', textShadow: '0 0 20px rgba(231,76,60,.4)' }, text: U.fmtNum(tc.totalSitesFora) })
    ]);
    return U.h('div', { class: 'trj-card p-4' }, [
      U.h('div', { class: 'flex items-center gap-2 mb-3' }, [
        U.h('span', { class: 'trj-chart-dot' }),
        U.h('h3', { class: 'text-sm font-bold', text: 'Top Cidades — Sites Fora' }),
        U.h('span', { class: 'text-xs font-normal', style: { color: 'var(--trj-muted)' }, text: '(clique em qualquer cidade ou ANF para detalhar)' })
      ]),
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
      'Produtividade (Concluídas): ' + (K.produtividade || 0),
      'SLA Geral (Concluídas): ' + (K.slaGeral || 0) + '%',
      'Sites fora: ' + (tc.totalSitesFora || 0),
      'Atualizado: ' + new Date(d.atualizadoEm || Date.now()).toLocaleString('pt-BR')
    ];
    var txt = linhas.join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { U.toast('Resumo copiado!', 'ok'); }, function () { U.toast('Não foi possível copiar.', 'err'); });
    else U.toast('Cópia não suportada neste navegador.', 'err');
  }

  // Extrai todos os dados do Dashboard (KPIs + todos os gráficos) num único
  // arquivo Excel, uma aba por bloco — pra quem preferir analisar fora do site.
  function exportarExcelDashboard(d, pageData) {
    if (typeof XLSX === 'undefined') { U.toast('Biblioteca de Excel não carregou. Recarregue a página.', 'err'); return; }
    var wb = XLSX.utils.book_new();
    var dom = TRJ.domain;
    var now = new Date();
    var K = d.kpis || {};
    var tc = d.topCidades || {};

    // ---- helpers de formatação ----
    var LARANJA = { patternType: 'solid', fgColor: { rgb: 'FF8C00' } };
    var VERDE_ESCURO = { patternType: 'solid', fgColor: { rgb: '1A4731' } };
    var AZUL_ESCURO = { patternType: 'solid', fgColor: { rgb: '1A2B4A' } };
    var VERMELHO_ESCURO = { patternType: 'solid', fgColor: { rgb: '4A1A1A' } };
    var ROXO_ESCURO = { patternType: 'solid', fgColor: { rgb: '3A1A4A' } };
    var CINZA = { patternType: 'solid', fgColor: { rgb: '1A1A24' } };

    function estilo(fill, bold, fontSize, fontColor) {
      return {
        fill: fill || { patternType: 'none' },
        font: { bold: !!bold, sz: fontSize || 11, color: { rgb: fontColor || 'F0F0F0' } },
        alignment: { vertical: 'center', horizontal: 'left', wrapText: false },
        border: {
          top: { style: 'thin', color: { rgb: '333344' } },
          bottom: { style: 'thin', color: { rgb: '333344' } },
          left: { style: 'thin', color: { rgb: '333344' } },
          right: { style: 'thin', color: { rgb: '333344' } }
        }
      };
    }

    function hdrStyle(fill) { return estilo(fill, true, 11, 'FFFFFF'); }
    function rowStyle(alt) { return estilo({ patternType: 'solid', fgColor: { rgb: alt ? '16162A' : '0A0A1A' } }, false, 10, 'E0E0E0'); }
    function cellStyle(hex) { return estilo({ patternType: 'solid', fgColor: { rgb: hex || '0A0A1A' } }, false, 10, 'F0F0F0'); }

    // Cria uma aba formatada com cabeçalho colorido e alternância de linhas
    function abaFormatada(nome, hdrFill, colunas, linhas) {
      var aoa = [colunas.map(function (c) { return c.h; })].concat(linhas);
      var ws = XLSX.utils.aoa_to_sheet(aoa);

      // Larguras de coluna
      ws['!cols'] = colunas.map(function (c) { return { wch: c.w || 18 }; });

      // Estilos
      var range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (var R = range.s.r; R <= range.e.r; R++) {
        for (var C2 = range.s.c; C2 <= range.e.c; C2++) {
          var addr = XLSX.utils.encode_cell({ r: R, c: C2 });
          if (!ws[addr]) ws[addr] = { t: 's', v: '' };
          ws[addr].s = R === 0 ? hdrStyle(hdrFill) : rowStyle(R % 2 === 0);
        }
      }
      // Congelar cabeçalho
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
    }

    function formatarData(val) {
      if (!val) return '';
      var d2 = val instanceof Date ? val : new Date(val);
      if (isNaN(d2.getTime())) return String(val);
      return d2.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // ---- Aba 1: Dashboard (KPIs + resumos num só lugar) ----
    abaFormatada('Dashboard', LARANJA, [
      { h: 'INDICADOR', w: 35 }, { h: 'VALOR', w: 16 }, { h: 'DETALHE', w: 45 }
    ], [
      ['Extraído em', now.toLocaleString('pt-BR'), ''],
      ['', '', ''],
      ['═ BACKLOG', '', ''],
      ['Fora do SLA', K.foraSla || 0, 'TSKs corretiva com prazo expirado (backlog ativo)'],
      ['Backlog Total', K.backlogTotal || 0, 'Total de TSKs corretiva em aberto'],
      ['Backlog Indefinido', K.backlogIndef || 0, 'TSKs sem SLA calculado (sem data de criação ou prioridade)'],
      ['Preditiva', K.preditiva || 0, 'TSKs preventivas classificadas como corretiva'],
      ['SLA Geral', (K.slaGeral || 0) + '%', 'Das TSKs concluídas, % que foi concluída dentro do SLA'],
      ['', '', ''],
      ['═ PRODUTIVIDADE', '', ''],
      ['Concluídas (total)', K.produtividade || 0, 'TSKs encerradas no período'],
      ['', '', ''],
      ['═ SITES FORA', '', ''],
      ['Total Sites Fora', tc.totalSitesFora || 0, 'Incidentes ativos no painel G.E.N.E.S.I.S'],
      ['', '', ''],
      ['═ PRODUTIVIDADE POR CATEGORIA', '', ''],
    ].concat((d.produtividade || []).map(function (p) {
      return [p.categoria, 'Dentro: ' + p.dentro + ' / Fora: ' + p.fora + (p.preditiva ? ' / Preditiva: ' + p.preditiva : ''), ''];
    })).concat([
      ['', '', ''],
      ['═ SLA POR REGIÃO', '', ''],
    ]).concat((d.slaPorRegiao || []).filter(function (r) { return r.dentro + r.fora > 0; }).map(function (r) {
      var tot = r.dentro + r.fora;
      return [r.label, 'Dentro: ' + r.dentro + ' / Fora: ' + r.fora, tot > 0 ? Math.round(r.dentro / tot * 1000) / 10 + '% dentro do SLA' : '—'];
    })).concat([
      ['', '', ''],
      ['═ TOP CIDADES (Sites Fora)', '', ''],
    ]).concat((tc.cidades || []).slice(0, 20).map(function (c) { return [c.cidade, c.total, c.pct + '%']; })));

    // ---- Aba 2: Backlog ----
    var tasksE = (pageData && pageData.tasksEnriched) || [];
    var incE = (pageData && pageData.incidentsEnriched) || [];
    var sep = dom.separarTicketsManuais(tasksE);
    var ticketsCorretiva = sep.tickets, manuaisFull = sep.manuais;
    var backlogRows = tasksE.filter(function (t) { return dom.isBacklogStatus(t.status); });

    var backlogCols = [
      { h: 'TSK', w: 22 }, { h: 'Status', w: 16 }, { h: 'Prioridade', w: 12 },
      { h: 'Status SLA', w: 16 }, { h: 'Região', w: 18 }, { h: 'Cidade', w: 20 },
      { h: 'END_ID', w: 18 }, { h: 'Site', w: 22 }, { h: 'Falha', w: 24 },
      { h: 'Fila', w: 30 }, { h: 'Criação', w: 18 }, { h: 'Vencimento SLA', w: 18 }
    ];
    abaFormatada('Backlog', VERMELHO_ESCURO, backlogCols, backlogRows.sort(function (a, b2) {
      var pa = (a.prioridade || '').match(/\d+/); var pb = (b2.prioridade || '').match(/\d+/);
      return (pa ? parseInt(pa[0]) : 999) - (pb ? parseInt(pb[0]) : 999);
    }).map(function (t) {
      return [t.osNumero || '', t.status || '', t.prioridade || '', t.statusSla || '',
              t.regiao || '', t.cidade || '', t.enderecoId || '', t.siteId || '',
              t.tipoFalha || '', t.filaAtual || '', formatarData(t.dataCriacao), formatarData(t.vencimentoCalc)];
    }));

    // ---- Aba 3: Concluídas ----
    var concluidasRows = ticketsCorretiva.filter(function (t) {
      var s = (t.status || '').toUpperCase().trim(); return s === 'CONCLUÍDA' || s === 'CONCLUIDA';
    });
    abaFormatada('Concluidas', VERDE_ESCURO, [
      { h: 'TSK', w: 22 }, { h: 'Status', w: 16 }, { h: 'Prioridade', w: 12 }, { h: 'Status SLA', w: 16 },
      { h: 'Região', w: 18 }, { h: 'Cidade', w: 20 }, { h: 'END_ID', w: 18 }, { h: 'Site', w: 22 },
      { h: 'Falha', w: 24 }, { h: 'Fila', w: 30 }, { h: 'Criação', w: 18 }, { h: 'Encerramento', w: 18 }, { h: 'Venc. SLA', w: 18 }
    ], concluidasRows.map(function (t) {
      return [t.osNumero || '', t.status || '', t.prioridade || '', t.statusSla || '',
              t.regiao || '', t.cidade || '', t.enderecoId || '', t.siteId || '',
              t.tipoFalha || '', t.filaAtual || '', formatarData(t.dataCriacao), formatarData(t.fimCalc), formatarData(t.vencimentoCalc)];
    }));

    // ---- Aba 4: Canceladas ----
    var canceladasRows = ticketsCorretiva.filter(function (t) {
      var s = (t.status || '').toUpperCase().trim(); return s === 'CANCELADA' || s === 'CANCELADO';
    }).map(function (t) {
      var m = (t.motivoCancelamento || '').toString().toUpperCase();
      return Object.assign({}, t, { tipoCancelamento: m.indexOf('ASSOCIA') >= 0 ? 'Associação' : 'Automação' });
    });
    abaFormatada('Canceladas', ROXO_ESCURO, [
      { h: 'TSK', w: 22 }, { h: 'Tipo Cancelamento', w: 20 }, { h: 'Prioridade', w: 12 },
      { h: 'Região', w: 18 }, { h: 'Cidade', w: 20 }, { h: 'END_ID', w: 18 }, { h: 'Site', w: 22 },
      { h: 'Falha', w: 24 }, { h: 'Fila', w: 30 }, { h: 'Criação', w: 18 }
    ], canceladasRows.map(function (t) {
      return [t.osNumero || '', t.tipoCancelamento || '', t.prioridade || '',
              t.regiao || '', t.cidade || '', t.enderecoId || '', t.siteId || '',
              t.tipoFalha || '', t.filaAtual || '', formatarData(t.dataCriacao)];
    }));

    // ---- Aba 5: Atividades Manuais ----
    abaFormatada('Atividades Manuais', CINZA, [
      { h: 'TSK', w: 22 }, { h: 'Tipo Atividade', w: 28 }, { h: 'Status', w: 16 },
      { h: 'Região', w: 18 }, { h: 'Cidade', w: 20 }, { h: 'END_ID', w: 18 }, { h: 'Site', w: 22 },
      { h: 'Fila', w: 30 }, { h: 'Criação', w: 18 }
    ], manuaisFull.map(function (t) {
      return [t.osNumero || '', t.tipoAtividade || '', t.status || '',
              t.regiao || '', t.cidade || '', t.enderecoId || '', t.siteId || '',
              t.filaAtual || '', formatarData(t.dataCriacao)];
    }));

    // ---- Aba 6: Sites Fora (incidentes) ----
    var incAtivos = incE.filter(function (i) { return (i.statusTrat || 'ATIVO').toUpperCase() !== 'RESOLVIDO'; });
    abaFormatada('Sites Fora', VERMELHO_ESCURO, [
      { h: 'Horário', w: 16 }, { h: 'Duração', w: 10 }, { h: 'Site', w: 28 }, { h: 'END_ID', w: 18 },
      { h: 'ANF', w: 8 }, { h: 'Cidade/UF', w: 22 }, { h: 'Região', w: 18 }, { h: 'Causa', w: 30 },
      { h: 'Causa (grupo)', w: 18 }, { h: 'Previsão', w: 16 }, { h: 'Detalhe', w: 50 }, { h: 'Status', w: 16 }
    ], incAtivos.map(function (i) {
      return [i.horario || '', i.downtime || '', i.site || '', i.enderecoId || '',
              i.anf || '', i.cidadeUf || '', i.regiao || '', i.causa || '',
              i.causaGrupo || '', i.previsao || '', i.detalhe || '', i.statusTrat || ''];
    }));

    var ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    XLSX.writeFile(wb, 'Dashboard_TRJ_' + ts + '.xlsx');
    U.toast('Excel exportado! ' + (tasksE.length + incE.length) + ' registros em ' + wb.SheetNames.length + ' abas.', 'ok');
  }

    function aba(nome, aoa) {
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
    }
    function abaLista(nome, rows, cols) {
      var aoa = [cols.map(function (c) { return c.h; })];
      (rows || []).forEach(function (r) { aoa.push(cols.map(function (c) { return r[c.k] != null ? r[c.k] : ''; })); });
      aba(nome, aoa);
    }

    // ---- KPIs ----
    var K = d.kpis || {};
    var tc = d.topCidades || {};
    aba('KPIs', [
      ['Indicador', 'Valor'],
      ['Fora do SLA', K.foraSla || 0],
      ['Backlog Total', K.backlogTotal || 0],
      ['Backlog Indefinido', K.backlogIndef || 0],
      ['Preditiva', K.preditiva || 0],
      ['Produtividade (concluídas)', K.produtividade || 0],
      ['SLA Geral (%)', K.slaGeral || 0],
      ['Sites Fora (total)', tc.totalSitesFora || 0],
      ['Extraído em', now.toLocaleString('pt-BR')]
    ]);

    // ---- Backlog completo (tarefas em aberto) ----
    var tasksE = (pageData && pageData.tasksEnriched) || [];
    var incE = (pageData && pageData.incidentsEnriched) || [];
    var sep = dom.separarTicketsManuais(tasksE);
    var ticketsCorretiva = sep.tickets, manuaisFull = sep.manuais;

    abaLista('Backlog', tasksE.filter(function (t) { return dom.isBacklogStatus(t.status); }), [
      { k: 'osNumero', h: 'TSK' }, { k: 'status', h: 'Status' }, { k: 'prioridade', h: 'Prioridade' },
      { k: 'regiao', h: 'Região' }, { k: 'cidade', h: 'Cidade' }, { k: 'enderecoId', h: 'END_ID' },
      { k: 'siteId', h: 'Site' }, { k: 'tipoFalha', h: 'Falha' }, { k: 'filaAtual', h: 'Fila' },
      { k: 'dataCriacao', h: 'Criação' }, { k: 'vencimentoCalc', h: 'Vencimento SLA' },
      { k: 'statusSla', h: 'Status SLA' }, { k: 'agingMinutos', h: 'Aging (min)' }
    ]);

    // ---- Concluídas ----
    abaLista('Concluidas', ticketsCorretiva.filter(function (t) {
      var s = (t.status || '').toUpperCase().trim();
      return s === 'CONCLUÍDA' || s === 'CONCLUIDA';
    }), [
      { k: 'osNumero', h: 'TSK' }, { k: 'status', h: 'Status' }, { k: 'prioridade', h: 'Prioridade' },
      { k: 'regiao', h: 'Região' }, { k: 'cidade', h: 'Cidade' }, { k: 'enderecoId', h: 'END_ID' },
      { k: 'siteId', h: 'Site' }, { k: 'tipoFalha', h: 'Falha' }, { k: 'filaAtual', h: 'Fila' },
      { k: 'dataCriacao', h: 'Criação' }, { k: 'fimCalc', h: 'Encerramento' },
      { k: 'vencimentoCalc', h: 'Vencimento SLA' }, { k: 'statusSla', h: 'Status SLA' }
    ]);

    // ---- Canceladas (corretiva) — com motivo, separadas por automação/associação ----
    abaLista('Canceladas', ticketsCorretiva.filter(function (t) {
      var s = (t.status || '').toUpperCase().trim();
      return s === 'CANCELADA' || s === 'CANCELADO';
    }).map(function (t) {
      var motivo = (t.motivoCancelamento || '').toString().toUpperCase();
      return Object.assign({}, t, { tipoCancelamento: motivo.indexOf('ASSOCIA') >= 0 ? 'Associação' : 'Automação' });
    }), [
      { k: 'osNumero', h: 'TSK' }, { k: 'tipoCancelamento', h: 'Tipo Cancelamento' }, { k: 'prioridade', h: 'Prioridade' },
      { k: 'regiao', h: 'Região' }, { k: 'cidade', h: 'Cidade' }, { k: 'enderecoId', h: 'END_ID' },
      { k: 'siteId', h: 'Site' }, { k: 'tipoFalha', h: 'Falha' }, { k: 'filaAtual', h: 'Fila' },
      { k: 'dataCriacao', h: 'Criação' }
    ]);

    // ---- Atividades manuais (WO/Preventiva/Conjunta/Outras) ----
    abaLista('Atividades Manuais (detalhe)', manuaisFull, [
      { k: 'osNumero', h: 'TSK' }, { k: 'tipoAtividade', h: 'Tipo Atividade' }, { k: 'status', h: 'Status' },
      { k: 'regiao', h: 'Região' }, { k: 'cidade', h: 'Cidade' }, { k: 'enderecoId', h: 'END_ID' },
      { k: 'siteId', h: 'Site' }, { k: 'filaAtual', h: 'Fila' }, { k: 'dataCriacao', h: 'Criação' }
    ]);

    // ---- Sites Fora (incidentes) ----
    abaLista('Sites Fora', incE.filter(function (i) { return (i.statusTrat || 'ATIVO').toUpperCase() !== 'RESOLVIDO'; }), [
      { k: 'horario', h: 'Horário' }, { k: 'downtime', h: 'Duração' }, { k: 'site', h: 'Site' },
      { k: 'enderecoId', h: 'END_ID' }, { k: 'anf', h: 'ANF' }, { k: 'cidadeUf', h: 'Cidade/UF' },
      { k: 'regiao', h: 'Região' }, { k: 'causa', h: 'Causa' }, { k: 'causaGrupo', h: 'Causa (grupo)' },
      { k: 'previsao', h: 'Previsão' }, { k: 'detalhe', h: 'Detalhe' }, { k: 'statusTrat', h: 'Status Trat.' }
    ]);
})(window.TRJ = window.TRJ || {});
