/* =====================================================================
 * produtividade.js — Aba de Produtividade Operacional
 * Encerramentos por dia (dentro/fora SLA, CCI vs Campo) + Reincidentes
 * Histórico persistido em localStorage + pasta "Produtividade" da conexão
 * ===================================================================== */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U    = TRJ.ui;
  var D    = TRJ.domain;
  var C    = TRJ.constants;
  var Comp = TRJ.compute;
  var FS   = TRJ.files;
  var h    = U.h;

  var LS_KEY = 'trj_prod_hist_v1'; // localStorage key para histórico diário
  var _charts = [];
  var _state  = { periodo: 30, regiao: 'TODAS' };

  function destroyLocalCharts() {
    _charts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    _charts = [];
  }

  // ── Tema ───────────────────────────────────────────────────────────
  var TOOLTIP_STYLE = {
    backgroundColor: '#1a1a24', titleColor: '#ff8c00', bodyColor: '#f0f0f0',
    borderColor: 'rgba(255,140,0,0.4)', borderWidth: 1, padding: 10, cornerRadius: 8
  };
  function gridClr() {
    return document.documentElement.getAttribute('data-theme') === 'light'
      ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
  }
  function tickClr() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? '#5a5d6b' : '#9a9aa3';
  }

  // ── Converter fimCalc (Date | string | number) → 'YYYY-MM-DD' local ─
  function toIsoDay(v) {
    if (!v) return null;
    var dt = (v instanceof Date) ? v : new Date(v);
    if (isNaN(dt.getTime())) return null;
    var y  = dt.getFullYear();
    var m  = ('0' + (dt.getMonth() + 1)).slice(-2);
    var d  = ('0' + dt.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }

  function fmtDia(isoDate) {
    var p = (isoDate || '').split('-');
    return p.length >= 3 ? p[2] + '/' + p[1] : isoDate;
  }

  function isConcluida(t) {
    var s = (t.status || '').toUpperCase();
    return s === 'CONCLUÍDA' || s === 'CONCLUIDA';
  }

  function isBacklog(t) {
    var s = (t.status || '').toUpperCase().replace('Ã', 'A');
    return s === 'NAO INICIADO' || s === 'INICIADO' || s === 'NÃO INICIADO';
  }

  function dentroSla(t) {
    if (!t.fimCalc || !t.vencimentoCalc) return false;
    return new Date(t.fimCalc).getTime() <= new Date(t.vencimentoCalc).getTime();
  }

  function pct(num, den) { return den > 0 ? Math.round(num / den * 100) : 0; }

  // ── localStorage: histórico diário ────────────────────────────────
  function loadHist() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveHist(hist) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(hist)); } catch (e) {}
  }
  function clearHist() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  // ── Computar métricas de um array de tasksEnriched ─────────────────
  // Retorna objeto { diasMap: { 'YYYY-MM-DD': {total,dentro,fora,cci,campo} }, reinciByDay }
  function computarMetricas(tasks) {
    var concluidas = (tasks || []).filter(function (t) {
      return isConcluida(t) && toIsoDay(t.fimCalc);
    });

    var byDay = {};
    concluidas.forEach(function (t) {
      var d = toIsoDay(t.fimCalc);
      if (!byDay[d]) byDay[d] = { tasks: [], dentro: 0, fora: 0, cci: 0, campo: 0 };
      byDay[d].tasks.push(t);
      if (dentroSla(t)) byDay[d].dentro++; else byDay[d].fora++;
      if (D.classificarCciCampo(t.filaAtual) === 'CCI') byDay[d].cci++; else byDay[d].campo++;
    });

    // Reincidentes: mesmo END_ID encerrado em dois dias com gap ≤7 dias
    var endClosures = {};
    concluidas.forEach(function (t) {
      if (!t.enderecoId) return;
      var eid = String(t.enderecoId).trim();
      if (!eid) return;
      if (!endClosures[eid]) endClosures[eid] = [];
      endClosures[eid].push({ dia: toIsoDay(t.fimCalc), task: t });
    });

    var reinciByDay = {};
    Object.keys(endClosures).forEach(function (eid) {
      var list = endClosures[eid].slice().sort(function (a, b) {
        return a.dia < b.dia ? -1 : 1;
      });
      for (var i = 1; i < list.length; i++) {
        var gapMs  = new Date(list[i].dia).getTime() - new Date(list[i - 1].dia).getTime();
        var gapDia = Math.round(gapMs / 864e5);
        if (gapDia >= 1 && gapDia <= 7) {
          var d = list[i].dia;
          if (!reinciByDay[d]) reinciByDay[d] = [];
          reinciByDay[d].push({ eid: eid, task: list[i].task, prevTask: list[i - 1].task, gap: gapDia });
        }
      }
    });

    return { byDay: byDay, reinciByDay: reinciByDay };
  }

  // ── Processar tasksEnriched → objeto de hist por dia ──────────────
  function metricsToHistRows(byDay, reinciByDay) {
    var rows = {};
    Object.keys(byDay).forEach(function (d) {
      var b = byDay[d];
      rows[d] = {
        total: b.tasks.length,
        dentro: b.dentro, fora: b.fora,
        cci: b.cci, campo: b.campo,
        reinci: (reinciByDay[d] || []).length,
        tasks: b.tasks,
        reinciItems: reinciByDay[d] || [],
        tipo: 'HISTORICO',
        em: new Date().toISOString()
      };
    });
    return rows;
  }

  // ── Hoje: backlog + encerramentos parciais ─────────────────────────
  function computarHoje(tasks) {
    var hoje = toIsoDay(new Date());
    var backlogTotal = 0, backlogVencendo = 0;
    var encHoje = 0, dentroHoje = 0, foraHoje = 0, cciHoje = 0, campoHoje = 0;
    var now = Date.now();

    (tasks || []).forEach(function (t) {
      if (isBacklog(t)) {
        backlogTotal++;
        if (t.vencimentoCalc) {
          var ms = new Date(t.vencimentoCalc).getTime() - now;
          if (ms > 0 && ms <= 390 * 60000) backlogVencendo++;
        }
      }
      if (isConcluida(t) && toIsoDay(t.fimCalc) === hoje) {
        encHoje++;
        if (dentroSla(t)) dentroHoje++; else foraHoje++;
        if (D.classificarCciCampo(t.filaAtual) === 'CCI') cciHoje++; else campoHoje++;
      }
    });

    return {
      dia: hoje, label: fmtDia(hoje),
      total: encHoje, dentro: dentroHoje, fora: foraHoje,
      cci: cciHoje, campo: campoHoje, reinci: 0,
      backlog: backlogTotal, backlogVencendo: backlogVencendo,
      tipo: 'HOJE'
    };
  }

  // ── Montar diasData para gráficos (hist + hoje) ────────────────────
  function montarDiasData(hist, hoje, periodo, regiao) {
    var limite = periodo ? Date.now() - periodo * 864e5 : 0;

    var dias = [];
    // Dias históricos
    Object.keys(hist).sort().forEach(function (d) {
      if (periodo && new Date(d).getTime() < limite) return;
      var row = hist[d];
      if (regiao && regiao !== 'TODAS' && row.regiao && row.regiao !== regiao) return; // filtro região se disponível
      dias.push({
        dia: d, label: fmtDia(d),
        total: row.total || 0, dentro: row.dentro || 0, fora: row.fora || 0,
        cci: row.cci || 0, campo: row.campo || 0, reinci: row.reinci || 0,
        tasks: row.tasks || [], reinciItems: row.reinciItems || [],
        tipo: row.tipo || 'HISTORICO'
      });
    });

    // Adicionar hoje (se ainda não está no hist ou substituir o do hist pelo live)
    var hojeNoHist = dias.findIndex(function (d) { return d.dia === hoje.dia; });
    if (hojeNoHist >= 0) {
      dias[hojeNoHist] = Object.assign({}, dias[hojeNoHist], hoje, { tipo: 'HOJE' });
    } else {
      if (!periodo || new Date(hoje.dia).getTime() >= limite) dias.push(hoje);
    }

    return dias.sort(function (a, b) { return a.dia < b.dia ? -1 : 1; });
  }

  // ── Gráfico stacked: encerramentos por dia ─────────────────────────
  function chartEnc(canvas, diasData, onClickDia) {
    var c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: diasData.map(function (d) { return d.label + (d.tipo === 'HOJE' ? ' ★' : ''); }),
        datasets: [
          { label: 'Dentro SLA', data: diasData.map(function (d) { return d.dentro; }),
            backgroundColor: '#2ecc71', borderRadius: 4, maxBarThickness: 46 },
          { label: 'Fora SLA',   data: diasData.map(function (d) { return d.fora; }),
            backgroundColor: '#e74c3c', borderRadius: 4, maxBarThickness: 46 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { stacked: true, ticks: { color: tickClr(), font: { size: 10 } }, grid: { color: gridClr() } },
          y: { stacked: true, ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() }, beginAtZero: true }
        },
        plugins: {
          legend: { display: true, labels: { color: tickClr(), font: { size: 11 }, boxWidth: 12, padding: 10 } },
          tooltip: Object.assign({}, TOOLTIP_STYLE, {
            callbacks: {
              afterBody: function (ctx) {
                var d = diasData[ctx[0].dataIndex];
                var lines = ['───────────────', '🏢 CCI: ' + d.cci + '    🔧 Campo: ' + d.campo];
                if (d.tipo === 'HOJE') lines.push('📋 Backlog: ' + (d.backlog || 0));
                return lines;
              }
            }
          })
        },
        onClick: function (ev, els) { if (els && els.length && onClickDia) onClickDia(diasData[els[0].dataIndex]); }
      }
    });
    _charts.push(c); return c;
  }

  // ── Gráfico stacked: CCI vs Campo ─────────────────────────────────
  function chartCciCampo(canvas, diasData) {
    var c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: diasData.map(function (d) { return d.label; }),
        datasets: [
          { label: 'CCI',   data: diasData.map(function (d) { return d.cci; }),
            backgroundColor: '#3498db', borderRadius: 4, maxBarThickness: 46 },
          { label: 'Campo', data: diasData.map(function (d) { return d.campo; }),
            backgroundColor: '#ff8c00', borderRadius: 4, maxBarThickness: 46 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { stacked: true, ticks: { color: tickClr(), font: { size: 10 } }, grid: { color: gridClr() } },
          y: { stacked: true, ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() }, beginAtZero: true }
        },
        plugins: {
          legend: { display: true, labels: { color: tickClr(), font: { size: 11 }, boxWidth: 12, padding: 10 } },
          tooltip: Object.assign({}, TOOLTIP_STYLE, {
            callbacks: {
              afterBody: function (ctx) {
                var d = diasData[ctx[0].dataIndex];
                return ['───────────────', 'Dentro: ' + d.dentro + '   Fora: ' + d.fora, 'Total: ' + d.total];
              }
            }
          })
        }
      }
    });
    _charts.push(c); return c;
  }

  // ── Gráfico bar: reincidentes por dia ─────────────────────────────
  function chartReinci(canvas, diasData, onClickDia) {
    var c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: diasData.map(function (d) { return d.label; }),
        datasets: [{
          label: 'Reincidentes',
          data: diasData.map(function (d) { return d.reinci; }),
          backgroundColor: '#ff8c00', borderRadius: 4, maxBarThickness: 46
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: tickClr(), font: { size: 10 } }, grid: { color: gridClr() } },
          y: { ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() }, beginAtZero: true }
        },
        plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE },
        onClick: function (ev, els) {
          if (els && els.length && onClickDia && diasData[els[0].dataIndex].reinciItems) {
            onClickDia(diasData[els[0].dataIndex]);
          }
        }
      }
    });
    _charts.push(c); return c;
  }

  // ── Gráfico linha: taxa % de reincidência por dia ──────────────────
  function chartTaxaReinci(canvas, diasData) {
    var taxas = diasData.map(function (d) {
      return d.total > 0 ? parseFloat((d.reinci / d.total * 100).toFixed(1)) : 0;
    });
    var c = new Chart(canvas, {
      type: 'line',
      data: {
        labels: diasData.map(function (d) { return d.label; }),
        datasets: [{
          label: 'Taxa %',
          data: taxas,
          borderColor: '#ff8c00',
          backgroundColor: 'rgba(255,140,0,0.1)',
          borderWidth: 2,
          pointBackgroundColor: taxas.map(function (v) { return v > 15 ? '#e74c3c' : '#ff8c00'; }),
          pointRadius: 4, tension: 0.3, fill: true
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: tickClr(), font: { size: 10 } }, grid: { color: gridClr() } },
          y: { ticks: { color: tickClr(), font: { size: 11 }, callback: function (v) { return v + '%'; } },
               grid: { color: gridClr() }, beginAtZero: true }
        },
        plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE }
      }
    });
    _charts.push(c); return c;
  }

  // ── Gráfico horizontal: Top END_IDs reincidentes ───────────────────
  function chartTopEids(canvas, topEids) {
    var c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: topEids.map(function (e) { return e.eid; }),
        datasets: [{
          label: 'Reincidências',
          data: topEids.map(function (e) { return e.count; }),
          backgroundColor: topEids.map(function (e) {
            return e.count >= 3 ? '#e74c3c' : e.count === 2 ? '#ff8c00' : '#ffb347';
          }),
          borderRadius: 4, maxBarThickness: 28
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() }, beginAtZero: true },
          y: { ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() } }
        },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign({}, TOOLTIP_STYLE, {
            callbacks: { label: function (ctx) { return ' ' + ctx.parsed.x + ' ocorrência(s)'; } }
          })
        }
      }
    });
    _charts.push(c); return c;
  }

  // ── Gráfico linha: evolução do backlog ────────────────────────────
  function chartBacklog(canvas, diasDataComHist, histMap) {
    var backlogSeries = diasDataComHist.map(function (d) {
      var row = histMap[d.dia];
      return (row && row.backlog != null) ? row.backlog : (d.tipo === 'HOJE' ? d.backlog : null);
    });
    var c = new Chart(canvas, {
      type: 'line',
      data: {
        labels: diasDataComHist.map(function (d) { return d.label; }),
        datasets: [{
          label: 'Backlog aberto',
          data: backlogSeries,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52,152,219,0.1)',
          borderWidth: 2, pointRadius: 4, tension: 0.3, fill: true,
          spanGaps: true
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: tickClr(), font: { size: 10 } }, grid: { color: gridClr() } },
          y: { ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() }, beginAtZero: true }
        },
        plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE }
      }
    });
    _charts.push(c); return c;
  }

  // ── Drills ────────────────────────────────────────────────────────
  function drillDia(dayData) {
    var tasks = dayData.tasks || [];
    if (!tasks.length) { U.toast('Sem detalhe de tasks disponível para este dia.', 'info'); return; }
    var content = h('div', { style: { maxHeight: '65vh', overflowY: 'auto' } });
    content.appendChild(U.taskTable(tasks, { modoResultado: true }));
    U.openModal('Encerramentos em ' + dayData.label + ' (' + dayData.dia + ')', content, {
      onCopy: function () { return U.taskTableCopyText(tasks, 'Encerramentos ' + dayData.dia); }
    });
  }

  function drillReinci(dayData) {
    var items = dayData.reinciItems || [];
    if (!items.length) { U.toast('Sem detalhe de reincidentes para este dia.', 'info'); return; }
    var content = h('div', { style: { maxHeight: '65vh', overflowY: 'auto' } });
    items.forEach(function (it) {
      content.appendChild(h('div', {
        class: 'trj-card p-3 mb-2',
        style: { borderLeft: '3px solid #ff8c00' }
      }, [
        h('div', { class: 'flex items-center gap-3 mb-1' }, [
          h('span', { class: 'font-bold text-sm', text: 'END_ID: ' + it.eid }),
          it.task.prioridade ? h('span', { class: 'trj-badge', style: { background: 'rgba(231,76,60,.18)', color: '#e74c3c', fontSize: '11px' }, text: it.task.prioridade }) : null
        ]),
        h('div', { style: { fontSize: '12px', color: 'var(--trj-muted)', lineHeight: '1.7' } }, [
          h('div', { text: 'Encerrado: ' + fmtDia(it.prevTask ? toIsoDay(it.prevTask.fimCalc) : '?') + '  (OS: ' + (it.prevTask && it.prevTask.osNumero || '—') + ')' }),
          h('div', { text: 'Reincidência: ' + fmtDia(toIsoDay(it.task.fimCalc)) + '  (OS: ' + (it.task.osNumero || '—') + ')  — gap: ' + it.gap + ' dia(s)' })
        ])
      ]));
    });
    U.openModal('Reincidentes em ' + dayData.label, content);
  }

  // ── Processar arquivos da pasta "Produtividade" ────────────────────
  async function processarHistoricoFolder(ctx, progressEl) {
    function log(msg) { if (progressEl) progressEl.textContent = msg; }

    if (!FS || !FS.scanProdutividadeFolder) {
      throw new Error('Função scanProdutividadeFolder não disponível. Verifique que files.js está atualizado.');
    }

    log('Verificando pasta conectada...');
    var files = await FS.scanProdutividadeFolder();
    if (!files.length) throw new Error('Nenhum arquivo .xlsx encontrado na subpasta "Produtividade".');

    log('Encontrado(s) ' + files.length + ' arquivo(s). Lendo...');

    // Ler e parsear todos os arquivos
    var allRaw = [];
    for (var i = 0; i < files.length; i++) {
      log('Lendo arquivo ' + (i + 1) + '/' + files.length + ': ' + files[i].name + '...');
      try {
        var buf = await files[i].file.arrayBuffer();
        var rows = FS.parseArrayBuffer(buf);
        allRaw = allRaw.concat(rows);
      } catch (e) {
        log('Aviso: erro ao ler "' + files[i].name + '" — pulando.');
      }
    }

    if (!allRaw.length) throw new Error('Nenhuma tarefa encontrada nos arquivos.');
    log('Total bruto: ' + allRaw.length + ' linhas. Deduplicando...');

    // Deduplica pelo critério padrão (maior sequenciaId por TSK)
    var deduped = D.dedupPorTsk ? D.dedupPorTsk(allRaw) : allRaw;
    log('Após dedup: ' + deduped.length + ' tarefas. Enriquecendo...');

    var validMap = (ctx.data && ctx.data.validMap) || {};
    var prazoMap = (ctx.data && ctx.data.prazoMap) || {};
    var enriched = Comp.enrichTasks(deduped, validMap, prazoMap);
    log('Calculando métricas por dia...');

    var result = computarMetricas(enriched);
    var hist = metricsToHistRows(result.byDay, result.reinciByDay);

    // Guardar no localStorage, mesclando com o que já existe
    var existing = loadHist();
    var merged   = Object.assign({}, existing, hist);
    saveHist(merged);

    // Tentar sincronizar com o GAS se disponível
    if (TRJ.api && TRJ.api.saveProdutividadeHist) {
      try {
        log('Sincronizando com o banco de dados...');
        var gasRows = Object.keys(hist).map(function (d) {
          return Object.assign({ data: d }, hist[d]);
        });
        await TRJ.api.saveProdutividadeHist(gasRows);
      } catch (e) { /* GAS indisponível: dados ficam no localStorage */ }
    }

    return Object.keys(hist).length;
  }

  // ── Render ────────────────────────────────────────────────────────
  TRJ.pages.produtividade = function (container, ctx) {
    var data = ctx && ctx.data;
    destroyLocalCharts();

    if (!data || !(data.tasksEnriched || []).length) {
      container.appendChild(h('div', { class: 'trj-card p-8 text-center' }, [
        h('div', { style: { fontSize: '2.4rem', marginBottom: '12px' }, text: '📭' }),
        h('div', { class: 'font-bold mb-2 text-base', text: 'Nenhum dado carregado' }),
        h('div', { style: { color: 'var(--trj-muted)', fontSize: '13px' },
          text: 'Importe a planilha de tarefas pela aba "Importar dados" para visualizar a produtividade.' })
      ]));
      return;
    }

    var tasks = data.tasksEnriched;

    // Cabeçalho
    container.appendChild(U.pageHeader
      ? U.pageHeader('Produtividade Operacional', 'Encerramentos e reincidências por período')
      : h('div', { class: 'mb-4' }, [h('h1', { class: 'trj-heading text-xl font-bold', text: 'Produtividade Operacional' })])
    );

    var areaEl = h('div', {});
    container.appendChild(areaEl);

    // Hoje ao vivo (sempre)
    var hoje = computarHoje(tasks);

    function render() {
      destroyLocalCharts();
      areaEl.innerHTML = '';

      var hist = loadHist();
      var hasHist = Object.keys(hist).length > 0;

      // ── Barra de ações/filtros ────────────────────────────────────
      var periodos = [{ l: '7d', v: 7 }, { l: '15d', v: 15 }, { l: '30d', v: 30 }, { l: 'Todos', v: 0 }];
      var btnsPeriodo = periodos.map(function (p) {
        return h('button', {
          class: 'trj-btn ' + (_state.periodo === p.v ? 'trj-btn-primary' : 'trj-btn-ghost'),
          style: { fontSize: '12px', padding: '4px 12px' },
          text: p.l,
          onclick: function () { _state.periodo = p.v; render(); }
        });
      });

      // Botão processar histórico
      var btnProcessar = h('button', {
        class: 'trj-btn trj-btn-ghost',
        style: { fontSize: '12px', padding: '4px 14px', color: '#ff8c00', borderColor: 'rgba(255,140,0,0.5)' },
        text: hasHist ? '🔄 Reprocessar Histórico' : '📁 Processar Histórico',
        onclick: function () { abrirModalProcessar(ctx, render); }
      });

      var btnLimpar = hasHist ? h('button', {
        class: 'trj-btn trj-btn-ghost',
        style: { fontSize: '11px', padding: '3px 10px', color: 'var(--trj-muted)' },
        text: '🗑 Limpar Histórico',
        onclick: function () { clearHist(); render(); }
      }) : null;

      areaEl.appendChild(h('div', {
        class: 'trj-card p-3 mb-5 flex items-center gap-3 flex-wrap',
        style: { borderColor: 'rgba(255,140,0,0.2)' }
      }, [
        h('span', { style: { color: 'var(--trj-muted)', fontSize: '12px', fontWeight: '600' }, text: 'PERÍODO:' }),
        h('div', { class: 'flex gap-2' }, btnsPeriodo),
        h('span', { style: { color: 'rgba(255,255,255,.12)', margin: '0 4px' }, text: '|' }),
        btnProcessar,
        btnLimpar
      ]));

      var diasData = montarDiasData(hist, hoje, _state.periodo, _state.regiao);

      // ── Se não há histórico: painel de boas-vindas ────────────────
      if (!hasHist) {
        areaEl.appendChild(renderOnboarding(hoje, ctx, render));
        return;
      }

      // ── KPIs gerais do período ────────────────────────────────────
      var totTotal  = 0, totDentro = 0, totFora = 0, totCci = 0, totCampo = 0, totReinci = 0;
      diasData.forEach(function (d) {
        totTotal  += d.total; totDentro += d.dentro; totFora += d.fora;
        totCci    += d.cci;   totCampo  += d.campo;  totReinci += d.reinci;
      });
      var pctDentro = pct(totDentro, totTotal);

      // Seção encerramentos
      areaEl.appendChild(secTitle('ENCERRAMENTOS', '#2ecc71'));
      areaEl.appendChild(h('div', { class: 'grid gap-3 mb-4', style: { gridTemplateColumns: 'repeat(4,1fr)' } }, [
        U.kpiCard({ label: 'Total Encerrado', value: totTotal, cor: '#ff8c00', sub: 'no período' }),
        U.kpiCard({ label: 'Dentro do SLA', value: pctDentro + '%',
          cor: pctDentro >= 70 ? '#2ecc71' : '#e74c3c',
          sub: totDentro + ' tickets (' + totFora + ' fora)' }),
        U.kpiCard({ label: 'Via CCI',  value: totCci,   cor: '#3498db', sub: pct(totCci, totTotal) + '% do total' }),
        U.kpiCard({ label: 'Via Campo', value: totCampo, cor: '#ff8c00', sub: pct(totCampo, totTotal) + '% do total' })
      ]));

      // Gráficos encerramentos: stacked + donut
      var rowEnc = h('div', { class: 'grid gap-4 mb-4', style: { gridTemplateColumns: '1fr 260px' } });
      var ccEnc  = U.chartCard('ENCERRAMENTOS POR DIA — Dentro × Fora SLA', { hint: diasData.length + ' dias (★ = hoje, parcial)' });
      ccEnc.card.style.minHeight = '300px';
      var ccDon  = U.chartCard('RESULTADO GERAL', { small: true });
      rowEnc.appendChild(ccEnc.card);
      rowEnc.appendChild(ccDon.card);
      areaEl.appendChild(rowEnc);

      var rowCci = h('div', { class: 'grid gap-4 mb-5', style: { gridTemplateColumns: '1fr 260px' } });
      var ccCci  = U.chartCard('ENCERRAMENTOS POR DIA — CCI × Campo', { hint: 'canal de execução' });
      ccCci.card.style.minHeight = '260px';
      var ccDonCci = U.chartCard('CANAL', { small: true });
      rowCci.appendChild(ccCci.card);
      rowCci.appendChild(ccDonCci.card);
      areaEl.appendChild(rowCci);

      // Seção hoje (destaque)
      areaEl.appendChild(secTitle('HOJE (PARCIAL — ' + hoje.label + ')', '#3498db'));
      areaEl.appendChild(h('div', { class: 'grid gap-3 mb-5', style: { gridTemplateColumns: 'repeat(4,1fr)' } }, [
        U.kpiCard({ label: 'Encerrados Hoje', value: hoje.total, cor: '#2ecc71', sub: pct(hoje.dentro, hoje.total) + '% dentro SLA' }),
        U.kpiCard({ label: 'Backlog Ativo',  value: hoje.backlog, cor: '#3498db', sub: 'tarefas abertas agora' }),
        U.kpiCard({ label: 'Vencendo em breve', value: hoje.backlogVencendo, cor: '#ff8c00', sub: 'próximas 6h30' }),
        U.kpiCard({ label: 'CCI / Campo',
          value: hoje.cci + ' / ' + hoje.campo, cor: '#ff8c00', sub: 'encerramentos do dia' })
      ]));

      // Backlog ao longo do tempo (se tiver histórico com backlog)
      var diasComBacklog = diasData.filter(function (d) { return d.backlog > 0; });
      if (diasComBacklog.length >= 2) {
        var rowBl = h('div', { class: 'mb-5' });
        var ccBl  = U.chartCard('EVOLUÇÃO DO BACKLOG ABERTO', { hint: 'capturado por dia' });
        ccBl.card.style.minHeight = '220px';
        rowBl.appendChild(ccBl.card);
        areaEl.appendChild(rowBl);
        setTimeout(function () { chartBacklog(ccBl.canvas, diasData, hist); }, 0);
      }

      // Seção reincidentes
      areaEl.appendChild(secTitle('REINCIDENTES', '#ff8c00'));
      var diasComReinci   = diasData.filter(function (d) { return d.reinci > 0; }).length;
      var taxaReinci      = (totTotal > 0 ? totReinci / totTotal * 100 : 0).toFixed(1);
      var mediaDia        = diasComReinci > 0 ? (totReinci / diasComReinci).toFixed(1) : '0';

      areaEl.appendChild(h('div', { class: 'grid gap-3 mb-4', style: { gridTemplateColumns: 'repeat(4,1fr)' } }, [
        U.kpiCard({ label: 'Reincidentes', value: totReinci,
          cor: totReinci > 0 ? '#e74c3c' : '#2ecc71', sub: 'END_IDs voltaram em ≤7d' }),
        U.kpiCard({ label: 'Taxa de Reincidência', value: taxaReinci + '%',
          cor: parseFloat(taxaReinci) > 15 ? '#e74c3c' : '#ff8c00', sub: 'sobre o total encerrado' }),
        U.kpiCard({ label: 'Dias c/ Reincid.', value: diasComReinci, cor: '#3498db', sub: 'dias com ocorrência' }),
        U.kpiCard({ label: 'Média por Dia',  value: mediaDia, cor: '#ff8c00', sub: 'reincid./dia ativo' })
      ]));

      var rowRei = h('div', { class: 'grid gap-4 mb-4', style: { gridTemplateColumns: '1fr 260px' } });
      var ccRei  = U.chartCard('REINCIDENTES POR DIA', { hint: 'END_ID normalizado → retornou em até 7 dias' });
      ccRei.card.style.minHeight = '260px';

      // Calcular top END_IDs e prioridades
      var eidMap = {}, prioAgg = {};
      var PRIO_COR = { P1: '#e74c3c', P2: '#ff8c00', P3: '#f1c40f', P4: '#3498db', P5: '#9aa5b1' };
      diasData.forEach(function (d) {
        (d.reinciItems || []).forEach(function (it) {
          eidMap[it.eid] = (eidMap[it.eid] || 0) + 1;
          var p = it.task.prioridade || 'S/PRIO';
          prioAgg[p] = (prioAgg[p] || 0) + 1;
        });
      });
      var ccPrio = U.chartCard('REINCID. POR PRIORIDADE', { small: true });
      rowRei.appendChild(ccRei.card);
      rowRei.appendChild(ccPrio.card);
      areaEl.appendChild(rowRei);

      var topEids = Object.keys(eidMap).map(function (e) { return { eid: e, count: eidMap[e] }; })
        .sort(function (a, b) { return b.count - a.count; }).slice(0, 10);

      if (topEids.length) {
        var rowTop = h('div', { class: 'grid gap-4 mb-4', style: { gridTemplateColumns: '1fr 1fr' } });
        var ccTop  = U.chartCard('TOP END_IDs MAIS REINCIDENTES', { hint: '🔴 ≥3x · 🟠 2x · 🟡 1x' });
        ccTop.card.style.minHeight = '260px';
        var ccTx   = U.chartCard('TAXA DE REINCIDÊNCIA % / DIA', {});
        ccTx.card.style.minHeight = '260px';
        rowTop.appendChild(ccTop.card);
        rowTop.appendChild(ccTx.card);
        areaEl.appendChild(rowTop);
        setTimeout(function () {
          chartTopEids(ccTop.canvas, topEids);
          chartTaxaReinci(ccTx.canvas, diasData);
        }, 0);
      }

      var prioDonutData = Object.keys(prioAgg).sort().map(function (p) {
        return { label: p, value: prioAgg[p], cor: PRIO_COR[p] || '#9aa5b1' };
      });

      setTimeout(function () {
        chartEnc(ccEnc.canvas, diasData, drillDia);
        U.donutChart(ccDon.canvas, [
          { label: 'Dentro SLA', value: totDentro, cor: '#2ecc71' },
          { label: 'Fora SLA',   value: totFora,   cor: '#e74c3c' }
        ]);
        chartCciCampo(ccCci.canvas, diasData);
        U.donutChart(ccDonCci.canvas, [
          { label: 'CCI',   value: totCci,   cor: '#3498db' },
          { label: 'Campo', value: totCampo, cor: '#ff8c00' }
        ]);
        chartReinci(ccRei.canvas, diasData, drillReinci);
        if (prioDonutData.length) U.donutChart(ccPrio.canvas, prioDonutData);
      }, 0);
    }

    render();
  };

  // ── Painel de boas-vindas (sem histórico) ─────────────────────────
  function renderOnboarding(hoje, ctx, onDone) {
    var panel = h('div', {});

    panel.appendChild(h('div', { class: 'grid gap-3 mb-5', style: { gridTemplateColumns: 'repeat(3,1fr)' } }, [
      U.kpiCard({ label: 'Encerrados Hoje', value: hoje.total, cor: '#2ecc71', sub: pct(hoje.dentro, hoje.total) + '% dentro SLA' }),
      U.kpiCard({ label: 'Backlog Ativo', value: hoje.backlog, cor: '#3498db', sub: 'tarefas abertas agora' }),
      U.kpiCard({ label: 'Vencendo em breve', value: hoje.backlogVencendo, cor: '#ff8c00', sub: 'próximas 6h30' })
    ]));

    panel.appendChild(h('div', {
      class: 'trj-card p-6 text-center',
      style: { borderColor: 'rgba(255,140,0,0.3)', borderStyle: 'dashed' }
    }, [
      h('div', { style: { fontSize: '2.5rem', marginBottom: '12px' }, text: '📂' }),
      h('div', { class: 'font-bold text-base mb-2', text: 'Sem histórico de produtividade' }),
      h('div', { style: { color: 'var(--trj-muted)', fontSize: '13px', maxWidth: '480px', margin: '0 auto 20px' },
        text: 'Para gerar os gráficos históricos, coloque os arquivos "Atividades-TRJ_FMMT" anteriores ' +
              'na subpasta "Produtividade" dentro da pasta conectada e clique em processar.' }),
      h('div', { class: 'trj-card p-3 mb-5 text-left', style: { maxWidth: '420px', margin: '0 auto 20px', fontSize: '12px', color: 'var(--trj-muted)' } }, [
        h('div', { class: 'font-bold mb-2', style: { color: 'var(--trj-fg)' }, text: '📁 Estrutura esperada:' }),
        h('div', { text: 'Pasta conectada/' }),
        h('div', { style: { paddingLeft: '16px' }, text: '├ Atividades-TRJ_FMMT_hoje.xlsx' }),
        h('div', { style: { paddingLeft: '16px' }, text: '└ Produtividade/' }),
        h('div', { style: { paddingLeft: '32px' }, text: '├ Atividades-TRJ_FMMT_2026-07-01.xlsx' }),
        h('div', { style: { paddingLeft: '32px' }, text: '├ Atividades-TRJ_FMMT_2026-07-02.xlsx' }),
        h('div', { style: { paddingLeft: '32px' }, text: '└ ...' })
      ]),
      h('button', {
        class: 'trj-btn trj-btn-primary',
        style: { padding: '10px 28px', fontSize: '14px' },
        text: '📁 Processar Histórico da pasta "Produtividade"',
        onclick: function () { abrirModalProcessar(ctx, onDone); }
      })
    ]));
    return panel;
  }

  // ── Modal: processamento de histórico ──────────────────────────────
  function abrirModalProcessar(ctx, onDone) {
    var progressEl = h('div', { style: { color: 'var(--trj-muted)', fontSize: '13px', minHeight: '24px' }, text: 'Aguardando...' });
    var btnStart = h('button', {
      class: 'trj-btn trj-btn-primary',
      style: { padding: '8px 24px' },
      text: 'Iniciar Processamento'
    });
    var errEl   = h('div', { style: { color: '#e74c3c', fontSize: '13px', marginTop: '8px' } });
    var okEl    = h('div', { style: { color: '#2ecc71', fontSize: '13px', marginTop: '8px' } });

    var content = h('div', {}, [
      h('div', { style: { color: 'var(--trj-muted)', fontSize: '13px', marginBottom: '16px' },
        text: 'Todos os arquivos .xlsx dentro da subpasta "Produtividade" da pasta conectada ' +
              'serão lidos, processados e as métricas salvas para análise histórica.' }),
      progressEl, errEl, okEl,
      h('div', { class: 'flex gap-3 mt-4' }, [btnStart])
    ]);

    U.openModal('Processar Histórico de Produtividade', content);

    btnStart.addEventListener('click', async function () {
      btnStart.disabled = true;
      btnStart.textContent = 'Processando...';
      errEl.textContent = '';
      okEl.textContent = '';
      try {
        var n = await processarHistoricoFolder(ctx, progressEl);
        progressEl.textContent = '';
        okEl.textContent = '✅ ' + n + ' dia(s) processado(s) e salvos com sucesso!';
        btnStart.textContent = '✅ Concluído';
        setTimeout(function () {
          // Fechar modal e re-renderizar
          document.querySelector('.trj-modal-overlay') && document.querySelector('.trj-modal-overlay').click();
          if (onDone) onDone();
        }, 1200);
      } catch (e) {
        progressEl.textContent = '';
        errEl.textContent = '❌ ' + (e.message || 'Erro desconhecido.');
        btnStart.disabled = false;
        btnStart.textContent = 'Tentar Novamente';
      }
    });
  }

  // ── Helpers de UI ─────────────────────────────────────────────────
  function secTitle(texto, cor) {
    return h('div', { class: 'flex items-center gap-2 mb-3 mt-2', style: { borderBottom: '1px solid rgba(255,140,0,0.15)', paddingBottom: '8px' } }, [
      h('span', { style: { width: '4px', height: '16px', borderRadius: '2px', background: cor, display: 'inline-block' } }),
      h('span', { class: 'text-xs font-bold uppercase tracking-widest', style: { color: cor }, text: texto })
    ]);
  }

})(window.TRJ = window.TRJ || {});
