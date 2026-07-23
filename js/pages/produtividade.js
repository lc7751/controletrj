/* =====================================================================
 * produtividade.js — Aba de Produtividade Operacional
 * Encerramentos por dia (dentro/fora SLA, CCI vs Campo) + Reincidentes
 * ===================================================================== */
(function (TRJ) {
  'use strict';
  TRJ.pages = TRJ.pages || {};
  var U  = TRJ.ui;
  var D  = TRJ.domain;
  var C  = TRJ.constants;
  var h  = U.h;

  // Instâncias de Chart.js criadas localmente (destruídas a cada re-render)
  var _charts = [];
  var _state  = { periodo: 30, regiao: 'TODAS' };

  function destroyLocalCharts() {
    _charts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    _charts = [];
  }

  // ── Tema: replica constantes de ui.js ──────────────────────────────
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

  // ── Helpers ────────────────────────────────────────────────────────
  function fmtDia(isoDate) {
    var p = isoDate.split('-');
    return p[2] + '/' + p[1];
  }

  function isConcluida(t) {
    var s = (t.status || '').toUpperCase();
    return s === 'CONCLUÍDA' || s === 'CONCLUIDA';
  }

  function dentroSla(t) {
    if (!t.fimCalc || !t.vencimentoCalc) return false;
    return new Date(t.fimCalc).getTime() <= new Date(t.vencimentoCalc).getTime();
  }

  function pct(num, den) {
    return den > 0 ? Math.round(num / den * 100) : 0;
  }

  // ── Computar todos os dados do período ─────────────────────────────
  function computar(tasks, diasFiltro, regiao) {
    var limite = diasFiltro ? Date.now() - diasFiltro * 864e5 : 0;

    var concluidas = (tasks || []).filter(function (t) {
      if (!isConcluida(t) || !t.fimCalc) return false;
      if (diasFiltro && new Date(t.fimCalc).getTime() < limite) return false;
      if (regiao && regiao !== 'TODAS' && (t.regiao || 'OTHERS') !== regiao) return false;
      return true;
    });

    // ── Por dia ────────────────────────────────────────
    var byDay = {};
    concluidas.forEach(function (t) {
      var d = t.fimCalc.substring(0, 10);
      if (!byDay[d]) byDay[d] = { tasks: [], dentro: 0, fora: 0, cci: 0, campo: 0 };
      byDay[d].tasks.push(t);
      if (dentroSla(t)) byDay[d].dentro++; else byDay[d].fora++;
      if (D.classificarCciCampo(t.filaAtual) === 'CCI') byDay[d].cci++; else byDay[d].campo++;
    });

    var diasData = Object.keys(byDay).sort().map(function (d) {
      var b = byDay[d];
      return { dia: d, label: fmtDia(d), total: b.tasks.length,
               dentro: b.dentro, fora: b.fora, cci: b.cci, campo: b.campo, tasks: b.tasks };
    });

    var totDentro = 0, totFora = 0, totCci = 0, totCampo = 0;
    diasData.forEach(function (d) {
      totDentro += d.dentro; totFora += d.fora;
      totCci    += d.cci;    totCampo += d.campo;
    });

    // ── Reincidentes: END_IDs fechados em dia X que voltaram em até 7 dias ──
    var endClosures = {};
    concluidas.forEach(function (t) {
      if (!t.enderecoId) return;
      var eid = String(t.enderecoId).trim();
      if (!eid) return;
      if (!endClosures[eid]) endClosures[eid] = [];
      endClosures[eid].push(t);
    });

    var reinciByDay = {};
    Object.keys(endClosures).forEach(function (eid) {
      var list = endClosures[eid].slice().sort(function (a, b) {
        return a.fimCalc < b.fimCalc ? -1 : 1;
      });
      for (var i = 1; i < list.length; i++) {
        var prevMs = new Date(list[i - 1].fimCalc.substring(0, 10)).getTime();
        var currMs = new Date(list[i].fimCalc.substring(0, 10)).getTime();
        var gap = Math.round((currMs - prevMs) / 864e5);
        if (gap >= 1 && gap <= 7) {
          var d = list[i].fimCalc.substring(0, 10);
          if (!reinciByDay[d]) reinciByDay[d] = [];
          reinciByDay[d].push({ eid: eid, task: list[i], prevTask: list[i - 1], gap: gap });
        }
      }
    });

    var reinciData = Object.keys(reinciByDay).sort().map(function (d) {
      var items = reinciByDay[d];
      var prioMap = {};
      items.forEach(function (it) {
        var p = it.task.prioridade || 'S/PRIO';
        prioMap[p] = (prioMap[p] || 0) + 1;
      });
      return { dia: d, label: fmtDia(d), total: items.length, items: items, prioMap: prioMap };
    });

    var totReinci = reinciData.reduce(function (s, d) { return s + d.total; }, 0);

    return {
      total: totDentro + totFora,
      totDentro: totDentro, totFora: totFora,
      totCci: totCci, totCampo: totCampo,
      diasData: diasData,
      reinciData: reinciData,
      totReinci: totReinci,
      concluidas: concluidas
    };
  }

  // ── Gráfico: encerramentos por dia (stacked dentro/fora) ───────────
  function chartEncerramentos(canvas, diasData, onClickDia) {
    var c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: diasData.map(function (d) { return d.label; }),
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
          x: { stacked: true, ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() } },
          y: { stacked: true, ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() }, beginAtZero: true }
        },
        plugins: {
          legend: { display: true, labels: { color: tickClr(), font: { size: 11 }, boxWidth: 12, padding: 10 } },
          tooltip: Object.assign({}, TOOLTIP_STYLE, {
            callbacks: {
              afterBody: function (ctx) {
                var d = diasData[ctx[0].dataIndex];
                return [
                  '───────────────',
                  '🏢 CCI: ' + d.cci + '    🔧 Campo: ' + d.campo
                ];
              }
            }
          })
        },
        onClick: function (ev, els) {
          if (els && els.length && onClickDia) onClickDia(diasData[els[0].dataIndex]);
        }
      }
    });
    _charts.push(c);
    return c;
  }

  // ── Gráfico: encerramentos CCI vs Campo por dia ────────────────────
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
          x: { stacked: true, ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() } },
          y: { stacked: true, ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() }, beginAtZero: true }
        },
        plugins: {
          legend: { display: true, labels: { color: tickClr(), font: { size: 11 }, boxWidth: 12, padding: 10 } },
          tooltip: Object.assign({}, TOOLTIP_STYLE, {
            callbacks: {
              afterBody: function (ctx) {
                var d = diasData[ctx[0].dataIndex];
                var totDia = d.total;
                return [
                  '───────────────',
                  '✔ Dentro SLA: ' + d.dentro + '    ✖ Fora SLA: ' + d.fora,
                  'Total dia: ' + totDia
                ];
              }
            }
          })
        }
      }
    });
    _charts.push(c);
    return c;
  }

  // ── Gráfico: reincidentes por dia ──────────────────────────────────
  function chartReinci(canvas, reinciData, onClickDia) {
    var c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: reinciData.map(function (d) { return d.label; }),
        datasets: [{
          label: 'Reincidentes', data: reinciData.map(function (d) { return d.total; }),
          backgroundColor: '#ff8c00', borderRadius: 4, maxBarThickness: 46
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() } },
          y: { ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() }, beginAtZero: true }
        },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign({}, TOOLTIP_STYLE, {
            callbacks: {
              afterBody: function (ctx) {
                var d = reinciData[ctx[0].dataIndex];
                var lines = ['───────────────'];
                Object.keys(d.prioMap).sort().forEach(function (p) {
                  lines.push(p + ': ' + d.prioMap[p]);
                });
                return lines;
              }
            }
          })
        },
        onClick: function (ev, els) {
          if (els && els.length && onClickDia) onClickDia(reinciData[els[0].dataIndex]);
        }
      }
    });
    _charts.push(c);
    return c;
  }

  // ── Modal de drill: dia de encerramentos ───────────────────────────
  function abrirDrillDia(dayData) {
    var content = h('div', { style: { maxHeight: '65vh', overflowY: 'auto' } });
    content.appendChild(U.taskTable(dayData.tasks, { modoResultado: true }));
    U.openModal('Encerramentos em ' + dayData.label + ' (' + dayData.dia + ')', content, {
      onCopy: function () { return U.taskTableCopyText(dayData.tasks, 'Encerramentos ' + dayData.dia); }
    });
  }

  // ── Modal de drill: dia de reincidentes ───────────────────────────
  function abrirDrillReinci(dayData) {
    var content = h('div', { style: { maxHeight: '65vh', overflowY: 'auto' } });
    dayData.items.forEach(function (it) {
      var prevDia  = (it.prevTask.fimCalc || '').substring(0, 10);
      var currDia  = it.task.fimCalc.substring(0, 10);
      var osAntes  = it.prevTask.osNumero || '—';
      var osDepois = it.task.osNumero  || '—';
      var row = h('div', {
        class: 'trj-card p-3 mb-2',
        style: { borderLeft: '3px solid #ff8c00' }
      }, [
        h('div', { class: 'flex items-center gap-3 mb-1' }, [
          h('span', { class: 'font-bold text-sm', text: 'END_ID: ' + it.eid }),
          h('span', { class: 'trj-badge', style: { background: 'rgba(231,76,60,.18)', color: '#e74c3c', fontSize: '11px' },
            text: it.task.prioridade || '—' })
        ]),
        h('div', { style: { fontSize: '12px', color: 'var(--trj-muted)', lineHeight: '1.7' } }, [
          h('div', { text: '📅 Encerrado: ' + fmtDia(prevDia) + '  (OS: ' + osAntes + ')' }),
          h('div', { text: '🔁 Reincidência: ' + fmtDia(currDia) + '  (OS: ' + osDepois + ')  — gap: ' + it.gap + ' dia(s)' })
        ])
      ]);
      content.appendChild(row);
    });
    U.openModal('Reincidentes em ' + dayData.label, content);
  }

  // ── Render principal da página ─────────────────────────────────────
  TRJ.pages.produtividade = function (container, ctx) {
    var data = ctx && ctx.data;
    destroyLocalCharts();

    if (!data || !(data.tasksEnriched || []).length) {
      container.appendChild(h('div', { class: 'trj-card p-8 text-center' }, [
        h('div', { style: { fontSize: '2.4rem', marginBottom: '12px' }, text: '📭' }),
        h('div', { class: 'font-bold mb-2 text-base', text: 'Nenhum dado carregado' }),
        h('div', { style: { color: 'var(--trj-muted)', fontSize: '13px' },
          text: 'Importe as planilhas de tarefas para visualizar a produtividade.' })
      ]));
      return;
    }

    var tasks = data.tasksEnriched;

    // Detectar regiões disponíveis
    var regiaoSet = { 'TODAS': true };
    tasks.forEach(function (t) { if (t.regiao) regiaoSet[t.regiao] = true; });
    var regioes = Object.keys(regiaoSet);

    // Área dinâmica (re-renderiza nos filtros)
    var areaEl = h('div', {});

    container.appendChild(U.pageHeader
      ? U.pageHeader('Produtividade Operacional', 'Encerramentos e reincidências por período')
      : h('div', { class: 'mb-4' }, [h('h1', { class: 'trj-heading text-xl font-bold', text: 'Produtividade Operacional' })])
    );
    container.appendChild(areaEl);

    function render() {
      destroyLocalCharts();
      areaEl.innerHTML = '';

      var d = computar(tasks, _state.periodo, _state.regiao);

      // ── Barra de filtros ──────────────────────────────────────────
      var periodos = [
        { label: '7 dias', v: 7 }, { label: '15 dias', v: 15 },
        { label: '30 dias', v: 30 }, { label: 'Todos', v: 0 }
      ];

      var btnsPeriodo = periodos.map(function (p) {
        var ativo = _state.periodo === p.v;
        return h('button', {
          class: 'trj-btn ' + (ativo ? 'trj-btn-primary' : 'trj-btn-ghost'),
          style: { fontSize: '12px', padding: '4px 13px' },
          text: p.label,
          onclick: function () { _state.periodo = p.v; render(); }
        });
      });

      var selRegiao = h('select', { class: 'trj-select', style: { fontSize: '12px', padding: '4px 10px' } });
      regioes.forEach(function (r) {
        var opt = h('option', { value: r, text: r === 'TODAS' ? 'Todas as regiões' : (C.REGIAO_LABELS && C.REGIAO_LABELS[r] ? C.REGIAO_LABELS[r] : r) });
        if (r === _state.regiao) opt.selected = true;
        selRegiao.appendChild(opt);
      });
      selRegiao.addEventListener('change', function () { _state.regiao = this.value; render(); });

      areaEl.appendChild(h('div', {
        class: 'trj-card p-3 mb-5 flex items-center gap-3 flex-wrap',
        style: { borderColor: 'rgba(255,140,0,0.2)' }
      }, [
        h('span', { style: { color: 'var(--trj-muted)', fontSize: '12px', fontWeight: '600' }, text: 'PERÍODO:' }),
        h('div', { class: 'flex gap-2' }, btnsPeriodo),
        h('span', { style: { color: 'rgba(255,255,255,.15)', margin: '0 4px' }, text: '|' }),
        h('span', { style: { color: 'var(--trj-muted)', fontSize: '12px', fontWeight: '600' }, text: 'REGIÃO:' }),
        selRegiao,
        h('span', { style: { color: 'var(--trj-muted)', fontSize: '12px', marginLeft: 'auto' },
          text: d.total + ' encerramentos encontrados' })
      ]));

      // ════════════════════════════════════════════════════
      // SEÇÃO 1 — ENCERRAMENTOS
      // ════════════════════════════════════════════════════
      areaEl.appendChild(secTitle('ENCERRAMENTOS', '#2ecc71'));

      // KPIs
      var pctDentro = pct(d.totDentro, d.total);
      areaEl.appendChild(h('div', {
        class: 'grid gap-3 mb-4',
        style: { gridTemplateColumns: 'repeat(4, 1fr)' }
      }, [
        U.kpiCard({ label: 'Total Encerrado',  value: U.fmtNum ? U.fmtNum(d.total) : d.total,
          cor: '#ff8c00', sub: 'no período selecionado' }),
        U.kpiCard({ label: 'Dentro do SLA',    value: pctDentro + '%',
          cor: pctDentro >= 70 ? '#2ecc71' : '#e74c3c',
          sub: d.totDentro + ' tickets (' + d.totFora + ' fora)' }),
        U.kpiCard({ label: 'Via CCI',          value: d.totCci,
          cor: '#3498db', sub: pct(d.totCci, d.total) + '% dos encerramentos' }),
        U.kpiCard({ label: 'Via Campo',        value: d.totCampo,
          cor: '#ff8c00', sub: pct(d.totCampo, d.total) + '% dos encerramentos' })
      ]));

      // Gráficos: stacked por dia + donut resultado
      if (d.diasData.length === 0) {
        areaEl.appendChild(emptyCard('Nenhum encerramento no período selecionado.'));
      } else {
        // Linha 1: encerramentos dentro/fora por dia + donut resultado
        var rowEnc = h('div', { class: 'grid gap-4 mb-4', style: { gridTemplateColumns: '1fr 280px' } });

        var ccEnc = U.chartCard('ENCERRAMENTOS POR DIA — Dentro × Fora do SLA', {
          hint: d.diasData.length + ' dias',
          onCopy: function () {
            return d.diasData.map(function (x) {
              return x.label + ': ' + x.total + ' enc. | Dentro: ' + x.dentro + ' | Fora: ' + x.fora +
                     ' | CCI: ' + x.cci + ' | Campo: ' + x.campo;
            }).join('\n');
          }
        });
        ccEnc.card.style.minHeight = '320px';
        rowEnc.appendChild(ccEnc.card);

        var ccDonut = U.chartCard('RESULTADO GERAL', { small: true });
        rowEnc.appendChild(ccDonut.card);
        areaEl.appendChild(rowEnc);

        // Linha 2: CCI vs Campo por dia + donut canal
        var rowCci = h('div', { class: 'grid gap-4 mb-5', style: { gridTemplateColumns: '1fr 280px' } });

        var ccCci = U.chartCard('ENCERRAMENTOS POR DIA — CCI × Campo', { hint: 'canal de execução' });
        ccCci.card.style.minHeight = '280px';
        rowCci.appendChild(ccCci.card);

        var ccDonutCci = U.chartCard('CANAL DE ENCERRAMENTO', { small: true });
        rowCci.appendChild(ccDonutCci.card);
        areaEl.appendChild(rowCci);

        setTimeout(function () {
          chartEncerramentos(ccEnc.canvas, d.diasData, abrirDrillDia);

          U.donutChart(ccDonut.canvas, [
            { label: 'Dentro SLA', value: d.totDentro, cor: '#2ecc71' },
            { label: 'Fora SLA',   value: d.totFora,   cor: '#e74c3c' }
          ]);

          chartCciCampo(ccCci.canvas, d.diasData);

          U.donutChart(ccDonutCci.canvas, [
            { label: 'CCI',   value: d.totCci,   cor: '#3498db' },
            { label: 'Campo', value: d.totCampo, cor: '#ff8c00' }
          ]);
        }, 0);
      }

      // ════════════════════════════════════════════════════
      // SEÇÃO 2 — REINCIDENTES
      // ════════════════════════════════════════════════════
      areaEl.appendChild(secTitle('REINCIDENTES', '#ff8c00'));

      var taxaReinci = d.total > 0 ? (d.totReinci / d.total * 100).toFixed(1) : '0.0';
      var mediaDia   = d.reinciData.length > 0
        ? (d.totReinci / d.reinciData.length).toFixed(1) : '0';
      var diasComReinci = d.reinciData.length;

      areaEl.appendChild(h('div', {
        class: 'grid gap-3 mb-4',
        style: { gridTemplateColumns: 'repeat(4, 1fr)' }
      }, [
        U.kpiCard({ label: 'Reincidentes',      value: d.totReinci,
          cor: d.totReinci > 0 ? '#e74c3c' : '#2ecc71',
          sub: 'END_IDs voltaram em ≤1 semana' }),
        U.kpiCard({ label: 'Taxa de Reincidência', value: taxaReinci + '%',
          cor: parseFloat(taxaReinci) > 15 ? '#e74c3c' : '#ff8c00',
          sub: 'sobre o total encerrado' }),
        U.kpiCard({ label: 'Dias c/ Reincidência', value: diasComReinci,
          cor: '#3498db', sub: 'dias onde houve retorno' }),
        U.kpiCard({ label: 'Média por Dia',     value: mediaDia,
          cor: '#ff8c00', sub: 'reincidentes/dia (dias ativos)' })
      ]));

      if (d.reinciData.length === 0) {
        areaEl.appendChild(emptyCard('✅ Nenhuma reincidência detectada no período selecionado.'));
      } else {
        // Linha 1: bar reincidentes por dia + donut por prioridade
        var rowRei = h('div', { class: 'grid gap-4 mb-4', style: { gridTemplateColumns: '1fr 280px' } });

        var ccRei = U.chartCard('REINCIDENTES POR DIA', {
          hint: 'END_ID normalizado → nova TSK em até 7 dias'
        });
        ccRei.card.style.minHeight = '280px';
        rowRei.appendChild(ccRei.card);

        var ccPrio = U.chartCard('REINCID. POR PRIORIDADE', { small: true });
        rowRei.appendChild(ccPrio.card);
        areaEl.appendChild(rowRei);

        // Linha 2: top END_IDs mais reincidentes
        var topEids = computarTopEids(d.reinciData);
        if (topEids.length) {
          var rowTop = h('div', { class: 'grid gap-4 mb-4', style: { gridTemplateColumns: '1fr 1fr' } });

          var ccTopEids = U.chartCard('TOP END_IDs MAIS REINCIDENTES', { hint: 'maior freqüência de retorno' });
          ccTopEids.card.style.minHeight = '280px';
          rowTop.appendChild(ccTopEids.card);

          var ccTaxaDia = U.chartCard('TAXA DE REINCIDÊNCIA POR DIA (%)', { hint: 'reincidentes / encerramentos' });
          ccTaxaDia.card.style.minHeight = '280px';
          rowTop.appendChild(ccTaxaDia.card);
          areaEl.appendChild(rowTop);

          setTimeout(function () {
            chartTopEids(ccTopEids.canvas, topEids);
            chartTaxaDia(ccTaxaDia.canvas, d.diasData, d.reinciData);
          }, 0);
        }

        // Calcular prioridade agregada dos reincidentes
        var prioAgg = {};
        d.reinciData.forEach(function (rd) {
          Object.keys(rd.prioMap).forEach(function (p) {
            prioAgg[p] = (prioAgg[p] || 0) + rd.prioMap[p];
          });
        });
        var PRIO_COR = { P1: '#e74c3c', P2: '#ff8c00', P3: '#f1c40f', P4: '#3498db', P5: '#9aa5b1' };
        var prioDonutData = Object.keys(prioAgg).sort().map(function (p) {
          return { label: p, value: prioAgg[p], cor: PRIO_COR[p] || '#9aa5b1' };
        });

        setTimeout(function () {
          chartReinci(ccRei.canvas, d.reinciData, abrirDrillReinci);
          U.donutChart(ccPrio.canvas, prioDonutData);
        }, 0);
      }
    }

    render();
  };

  // ── Gráfico: top END_IDs mais reincidentes (horizontal bar) ────────
  function computarTopEids(reinciData) {
    var eidCount = {};
    reinciData.forEach(function (rd) {
      rd.items.forEach(function (it) {
        eidCount[it.eid] = (eidCount[it.eid] || 0) + 1;
      });
    });
    return Object.keys(eidCount).map(function (eid) {
      return { eid: eid, count: eidCount[eid] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
  }

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
          borderRadius: 4, maxBarThickness: 30
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
            callbacks: {
              label: function (ctx) { return ' ' + ctx.parsed.x + ' ocorrência(s)'; }
            }
          })
        }
      }
    });
    _charts.push(c);
    return c;
  }

  // ── Gráfico: taxa de reincidência % por dia ─────────────────────
  function chartTaxaDia(canvas, diasData, reinciData) {
    var reinciByDia = {};
    reinciData.forEach(function (rd) { reinciByDia[rd.dia] = rd.total; });

    var labels = diasData.map(function (d) { return d.label; });
    var taxas  = diasData.map(function (d) {
      var r = reinciByDia[d.dia] || 0;
      return d.total > 0 ? parseFloat((r / d.total * 100).toFixed(1)) : 0;
    });

    var c = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Taxa %',
          data: taxas,
          borderColor: '#ff8c00',
          backgroundColor: 'rgba(255,140,0,0.12)',
          borderWidth: 2,
          pointBackgroundColor: taxas.map(function (v) { return v > 15 ? '#e74c3c' : '#ff8c00'; }),
          pointRadius: 4,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: tickClr(), font: { size: 11 } }, grid: { color: gridClr() } },
          y: { ticks: { color: tickClr(), font: { size: 11 }, callback: function (v) { return v + '%'; } },
               grid: { color: gridClr() }, beginAtZero: true }
        },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign({}, TOOLTIP_STYLE, {
            callbacks: {
              label: function (ctx) { return ' Taxa: ' + ctx.parsed.y + '%'; }
            }
          })
        }
      }
    });
    _charts.push(c);
    return c;
  }

  // ── Helpers de UI ──────────────────────────────────────────────────
  function secTitle(texto, cor) {
    return h('div', {
      class: 'flex items-center gap-2 mb-3 mt-2',
      style: { borderBottom: '1px solid rgba(255,140,0,0.15)', paddingBottom: '8px' }
    }, [
      h('span', { style: { width: '4px', height: '16px', borderRadius: '2px', background: cor, display: 'inline-block' } }),
      h('span', { class: 'text-xs font-bold uppercase tracking-widest', style: { color: cor }, text: texto })
    ]);
  }

  function emptyCard(msg) {
    return h('div', {
      class: 'trj-card p-5 text-center mb-5',
      style: { color: 'var(--trj-muted)', fontSize: '13px' }
    }, [h('span', { text: msg })]);
  }

})(window.TRJ = window.TRJ || {});
