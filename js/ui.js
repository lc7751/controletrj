/* =====================================================================
 * ui.js  —  COMPONENTES DE INTERFACE (helpers reutilizáveis)
 * ---------------------------------------------------------------------
 * Funções para montar a tela: sidebar, cartões de KPI, gráficos
 * (Chart.js), modal de detalhamento (drill), avisos (toast), etc.
 * Tudo gera elementos no DOM — sem frameworks.
 * ===================================================================== */
(function (TRJ) {
  var U = {};
  var C = TRJ.constants;
  var D = TRJ.domain;

  // ---------- hyperscript: cria elemento DOM ----------
  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { e.dataset[d] = v[d]; });
        else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v);
      });
    }
    if (children !== null && children !== undefined) appendChildren(e, children);
    return e;
  }
  function appendChildren(e, children) {
    if (Array.isArray(children)) children.forEach(function (c) { appendChildren(e, c); });
    else if (children instanceof Node) e.appendChild(children);
    else if (children !== null && children !== undefined && children !== false) e.appendChild(document.createTextNode(String(children)));
  }
  U.h = h;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  U.esc = esc;

  function fmtNum(n) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString('pt-BR');
  }
  U.fmtNum = fmtNum;
  U.fmtPct = function (n) { return (n == null || isNaN(n) ? 0 : n) + '%'; };

  // hex (#rgb ou #rrggbb) -> "r,g,b" para usar em rgba(...)
  function hexToRgb(hex) {
    hex = String(hex || '').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '255,140,0';
    return r + ',' + g + ',' + b;
  }
  function hexToRgba(hex, a) { return 'rgba(' + hexToRgb(hex) + ',' + a + ')'; }
  U.hexToRgba = hexToRgba;

  // ---------- toast ----------
  function ensureToasts() {
    var t = document.getElementById('trj-toasts');
    if (!t) { t = h('div', { id: 'trj-toasts' }); document.body.appendChild(t); }
    return t;
  }
  U.toast = function (msg, type) {
    var box = ensureToasts();
    var el = h('div', { class: 'trj-toast ' + (type || 'info'), text: msg });
    box.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 320); }, 3600);
  };

  // ---------- loading (com mensagem opcional de etapa) ----------
  function ensureLoading() {
    var l = document.getElementById('trj-loading');
    if (!l) {
      l = h('div', { id: 'trj-loading' }, [
        h('div', { class: 'trj-spin' }),
        h('div', { id: 'trj-loading-msg', style: { color: 'var(--trj-muted)' } })
      ]);
      document.body.appendChild(l);
    }
    return l;
  }
  U.loading = function (show, msg) {
    ensureLoading().classList.toggle('show', !!show);
    var m = document.getElementById('trj-loading-msg');
    if (m) m.textContent = msg || '';
  };

  // ---------- modal ----------
  U.closeModal = function () {
    var m = document.getElementById('trj-modal-host');
    if (m) m.remove();
  };
  U.openModal = function (title, contentEl, opts) {
    U.closeModal();
    opts = opts || {};
    var body = h('div', { class: 'overflow-auto p-4', style: { flex: '1' } }, contentEl);
    var head = h('div', { class: 'flex items-center justify-between px-5 py-3', style: { borderBottom: '1px solid var(--trj-border)' } }, [
      h('h3', { class: 'text-base font-bold', style: { color: 'var(--trj-primary)' }, text: title }),
      h('button', { class: 'trj-btn trj-btn-ghost', text: '✕ Fechar', onclick: U.closeModal })
    ]);
    var modal = h('div', { class: 'trj-modal' }, [head, body]);
    if (opts.footer) modal.appendChild(h('div', { class: 'px-5 py-3', style: { borderTop: '1px solid var(--trj-border)' } }, opts.footer));
    var bg = h('div', { class: 'trj-modal-bg', id: 'trj-modal-host', onclick: function (ev) { if (ev.target === bg) U.closeModal(); } }, modal);
    document.body.appendChild(bg);
  };

  // ---------- KPI card ----------
  // Mesma assinatura de sempre: { label, value, sub?, cor?, onClick? }
  // Visual: barra de destaque no topo + brilho no canto + glow no valor,
  // tudo na cor "cor" (ou laranja padrão), com elevação no hover (via CSS .trj-kpi).
  U.kpiCard = function (o) {
    var corHex = /^#/.test(o.cor || '') ? o.cor : '#ff8c00';
    var accent = h('div', { style: { position: 'absolute', top: '0', left: '0', right: '0', height: '3px', background: corHex } });
    var glow = h('div', { style: {
      position: 'absolute', bottom: '-22px', right: '-22px', width: '90px', height: '90px', borderRadius: '50%',
      background: 'radial-gradient(circle, ' + hexToRgba(corHex, .16) + ', transparent)', pointerEvents: 'none'
    } });
    var card = h('div', { class: 'trj-card trj-kpi p-4 flex flex-col gap-1', style: { position: 'relative' } }, [
      accent, glow,
      h('div', { class: 'text-xs font-semibold uppercase tracking-wide', style: { color: 'var(--trj-muted)', letterSpacing: '1px' }, text: o.label }),
      h('div', { class: 'text-3xl font-extrabold', style: { color: o.cor || 'var(--trj-fg)', textShadow: '0 0 18px ' + hexToRgba(corHex, .3) }, text: o.value }),
      o.sub ? h('div', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: o.sub }) : null
    ]);
    if (o.onClick) card.addEventListener('click', o.onClick);
    else card.style.cursor = 'default';
    return card;
  };

  // ---------- Barra de resumo (total em destaque + lista lateral) ----------
  // items: [{ nome, valor, pct? }]
  U.resumoBar = function (totalLabel, totalValor, items) {
    return h('div', { class: 'trj-resumo-bar' }, [
      h('div', { class: 'trj-resumo-total' }, [
        h('span', { class: 'trj-resumo-total-label', text: totalLabel }),
        h('span', { class: 'trj-resumo-total-valor', text: String(totalValor) })
      ]),
      h('div', { class: 'trj-resumo-grid' }, (items || []).map(function (it) {
        return h('div', { class: 'trj-resumo-item' }, [
          h('span', { class: 'trj-resumo-nome', text: it.nome }),
          h('span', { class: 'trj-resumo-val', text: String(it.valor) }),
          it.pct != null ? h('span', { class: 'trj-resumo-pct', text: it.pct }) : null
        ]);
      }))
    ]);
  };

  // ---------- Caixa de busca (debounce simples) ----------
  U.searchInput = function (placeholder, onChange, opts) {
    opts = opts || {};
    var inp = h('input', { type: 'text', class: 'trj-input', placeholder: placeholder, value: opts.value || '' });
    var t = null;
    inp.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { onChange(inp.value); }, 140);
    });
    return inp;
  };

  // ---------- Dropzone reutilizável (clique ou arraste-e-solte) ----------
  // opts: { icon, title, sub, accept, multiple, statusText, statusOk, onFile(fileOrFileList) }
  U.dropzone = function (opts) {
    opts = opts || {};
    var fileInput = h('input', {
      type: 'file', style: { display: 'none' },
      accept: opts.accept || '', multiple: opts.multiple || false,
      onchange: function () {
        if (!this.files || !this.files.length) return;
        opts.onFile(opts.multiple ? this.files : this.files[0]);
      }
    });
    var statusPill = h('div', {
      class: 'trj-badge', style: {
        background: opts.statusOk ? 'rgba(46,204,113,.12)' : 'rgba(255,255,255,.05)',
        color: opts.statusOk ? 'var(--trj-green)' : 'var(--trj-muted)',
        fontFamily: 'ui-monospace, monospace', padding: '6px 12px', marginTop: '4px'
      }, text: opts.statusText || 'Aguardando arquivo...'
    });
    var dz = h('div', { class: 'trj-dropzone' }, [
      h('div', { class: 'trj-dropzone-icon', text: opts.icon || '📁' }),
      h('div', { class: 'trj-dropzone-title', text: opts.title || 'Arraste o arquivo aqui' }),
      h('div', { class: 'trj-dropzone-sub', html: opts.sub || 'ou clique para selecionar' }),
      statusPill,
      fileInput
    ]);
    dz.addEventListener('click', function (e) { if (e.target !== fileInput) fileInput.click(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('dragover'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.classList.remove('dragover');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      opts.onFile(opts.multiple ? files : files[0]);
    });
    return dz;
  };

  // ---------- Chart card (titulo + canvas) ----------
  U.chartCard = function (title, opts) {
    opts = opts || {};
    var canvas = h('canvas');
    var wrap = h('div', { class: 'chart-wrap' + (opts.small ? ' sm' : '') }, canvas);
    var head = h('div', { class: 'flex items-center justify-between mb-3' }, [
      h('h3', { class: 'text-sm font-bold flex items-center gap-2' }, [
        h('span', { class: 'trj-chart-dot' }),
        h('span', { text: title })
      ]),
      opts.hint ? h('span', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: opts.hint }) : null
    ]);
    var card = h('div', { class: 'trj-card trj-chart-card p-4' }, [head, wrap]);
    return { card: card, canvas: canvas };
  };

  // ---------- Chart.js: tema escuro ----------
  var charts = [];
  U.destroyCharts = function () { charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = []; };

  var gridColor = 'rgba(255,255,255,0.06)';
  var tickColor = '#9a9aa3';
  var tooltipCfg = {
    backgroundColor: '#1a1a24', titleColor: '#ff8c00', bodyColor: '#f0f0f0',
    borderColor: 'rgba(255,140,0,0.4)', borderWidth: 1, padding: 10, cornerRadius: 8
  };

  function register(c) { charts.push(c); return c; }

  // bar vertical. data = [{label,total,cor?}], onBar(index)
  U.barChart = function (canvas, data, opts) {
    opts = opts || {};
    return register(new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(function (d) { return d.label; }),
        datasets: [{ data: data.map(function (d) { return d.total; }),
          backgroundColor: data.map(function (d) { return d.cor || C.CORES_TRJ.orange; }),
          borderRadius: 6, maxBarThickness: 46 }]
      },
      options: baseOpts({ onClick: opts.onBar, horizontal: false })
    }));
  };

  // bar horizontal
  U.hbarChart = function (canvas, data, opts) {
    opts = opts || {};
    return register(new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(function (d) { return d.label; }),
        datasets: [{ data: data.map(function (d) { return d.total; }),
          backgroundColor: data.map(function (d) { return d.cor || C.CORES_TRJ.orange; }),
          borderRadius: 6, maxBarThickness: 34 }]
      },
      options: baseOpts({ onClick: opts.onBar, horizontal: true })
    }));
  };

  // stacked dentro/fora. data = [{label, dentro, fora}], onSeg(index, datasetIndex)
  U.stackedChart = function (canvas, data, opts) {
    opts = opts || {};
    var o = baseOpts({ horizontal: false });
    o.scales.x.stacked = true; o.scales.y.stacked = true;
    o.plugins.legend.display = true;
    if (opts.onSeg) o.onClick = function (ev, els) { if (els && els.length) opts.onSeg(els[0].index, els[0].datasetIndex); };
    return register(new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(function (d) { return d.label; }),
        datasets: [
          { label: opts.l1 || 'Dentro', data: data.map(function (d) { return d.dentro; }), backgroundColor: C.CORES_TRJ.green, borderRadius: 4, maxBarThickness: 46 },
          { label: opts.l2 || 'Fora', data: data.map(function (d) { return d.fora; }), backgroundColor: C.CORES_TRJ.red, borderRadius: 4, maxBarThickness: 46 }
        ]
      },
      options: o
    }));
  };

  // donut. data = [{name,value}], onSlice(index)
  U.donutChart = function (canvas, data, opts) {
    opts = opts || {};
    var cores = opts.cores || C.CHART_CORES;
    return register(new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.map(function (d) { return d.name; }),
        datasets: [{ data: data.map(function (d) { return d.value; }),
          backgroundColor: data.map(function (d, i) { return cores[i % cores.length]; }),
          borderColor: '#13131a', borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: { legend: { position: 'right', labels: { color: tickColor, font: { size: 11 }, boxWidth: 12 } }, tooltip: tooltipCfg },
        onClick: opts.onSlice ? function (ev, els) { if (els && els.length) opts.onSlice(els[0].index); } : undefined
      }
    }));
  };

  function baseOpts(cfg) {
    cfg = cfg || {};
    var o = {
      indexAxis: cfg.horizontal ? 'y' : 'x',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false, labels: { color: tickColor } },
        tooltip: tooltipCfg
      },
      scales: {
        x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
        y: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor }, beginAtZero: true }
      }
    };
    if (cfg.onClick) o.onClick = function (ev, els) { if (els && els.length) cfg.onClick(els[0].index); };
    return o;
  }

  // ---------- Badges de status ----------
  U.slaBadge = function (statusSla) {
    var s = (statusSla || '').toUpperCase();
    var cor = '#9aa5b1', bg = 'rgba(154,165,177,.15)';
    if (s === 'FORA DO SLA') { cor = '#e74c3c'; bg = 'rgba(231,76,60,.15)'; }
    else if (s === 'DENTRO DO SLA') { cor = '#2ecc71'; bg = 'rgba(46,204,113,.15)'; }
    else if (s === 'PREDITIVA') { cor = '#ff8c00'; bg = 'rgba(255,140,0,.15)'; }
    else if (s === 'CONCLUIDO') { cor = '#3498db'; bg = 'rgba(52,152,219,.15)'; }
    return h('span', { class: 'trj-badge', style: { color: cor, background: bg }, text: statusSla || '—' });
  };
  U.tratBadge = function (st) {
    var s = (st || 'ATIVO').toUpperCase();
    var cor = '#e74c3c', bg = 'rgba(231,76,60,.15)';
    if (s === 'RESOLVIDO') { cor = '#2ecc71'; bg = 'rgba(46,204,113,.15)'; }
    else if (s === 'EM TRATAMENTO') { cor = '#ff8c00'; bg = 'rgba(255,140,0,.15)'; }
    return h('span', { class: 'trj-badge', style: { color: cor, background: bg }, text: st || 'ATIVO' });
  };

  // ---------- TSK aberta (cruza END_ID do incidente GENESIS com a fila de tarefas/TOA) ----------
  var STATUS_FECHADO_TSK = ['CONCLUÍDA', 'CONCLUIDA', 'CANCELADA', 'CANCELADO'];
  function tskAberta(incident, tasksEnriched) {
    if (!incident || !tasksEnriched || !tasksEnriched.length) return null;
    var key = (incident.enderecoId || incident.endId || '').toString().trim().toUpperCase();
    if (!key) return null;
    var candidatos = tasksEnriched.filter(function (t) {
      var k2 = (t.enderecoId || '').toString().trim().toUpperCase();
      if (k2 !== key) return false;
      var st = (t.status || '').toString().trim().toUpperCase();
      return STATUS_FECHADO_TSK.indexOf(st) < 0; // ignora tarefas já fechadas
    });
    if (!candidatos.length) return null;
    // prioriza "Iniciado" sobre os demais; entre iguais, a mais recente
    candidatos.sort(function (a, b) {
      var pa = (a.status || '').toUpperCase() === 'INICIADO' ? 0 : 1;
      var pb = (b.status || '').toUpperCase() === 'INICIADO' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      var da = a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0;
      var db = b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0;
      return db - da;
    });
    return { osNumero: candidatos[0].osNumero, status: candidatos[0].status || null, total: candidatos.length };
  }
  U.tskAberta = tskAberta;

  // Badge "TSK <num>" colorido por status (Iniciado=verde, Não iniciado=amarelo bem visível), ou "SEM TSK".
  U.tskCell = function (incident, tasksEnriched) {
    var m = tskAberta(incident, tasksEnriched);
    if (!m) {
      return h('span', { class: 'trj-badge', style: { background: 'rgba(231,76,60,.16)', color: '#ff6b6b', fontWeight: '700' } }, [
        h('span', { class: 'trj-pulse-dot', style: { marginRight: '5px', verticalAlign: 'middle' } }),
        h('span', { text: 'SEM TSK' })
      ]);
    }
    var st = (m.status || '').toUpperCase();
    var cor = '#9aa5b1', bg = 'rgba(154,165,177,.15)';
    if (st === 'INICIADO') { cor = '#1fae5e'; bg = 'rgba(46,204,113,.22)'; }
    else if (st === 'NÃO INICIADO' || st === 'NAO INICIADO') { cor = '#9a7d00'; bg = 'rgba(241,196,15,.35)'; }
    var texto = (m.osNumero || '—') + (m.total > 1 ? ' (+' + (m.total - 1) + ')' : '');
    return h('span', { class: 'trj-badge', style: { background: bg, color: cor, fontWeight: '700' }, title: m.status || '' }, texto);
  };

  // ---------- Correlação entre incidentes (mesmo horário ±4min + ANF/cidade) ----------
  function parseHorarioMin(horario) {
    if (!horario) return null;
    var m = String(horario).match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (!m) return null;
    var dia = parseInt(m[1], 10), mes = parseInt(m[2], 10), hh = parseInt(m[3], 10), mi = parseInt(m[4], 10);
    return ((mes * 31) + dia) * 1440 + hh * 60 + mi; // só serve para medir diferenças pequenas
  }
  // Retorna { idx: {forte, fraca} } — forte = mesma ANF e cidade; fraca = só mesma ANF.
  U.computeCorrelacoes = function (rows) {
    function cidadeNorm(r) {
      var c = (r.cidadeUf || r.cidade || '').toString().toUpperCase().trim();
      return c.split('/')[0].trim(); // "VILA VELHA / ES" e "VILA VELHA" devem bater
    }
    var pts = rows.map(function (r, i) {
      return { i: i, t: parseHorarioMin(r.horario), anf: (r.anf || '').toString().trim(), cidade: cidadeNorm(r) };
    }).filter(function (x) { return x.t != null && x.anf; });
    var result = {};
    for (var a = 0; a < pts.length; a++) {
      for (var b = a + 1; b < pts.length; b++) {
        var x = pts[a], y = pts[b];
        if (x.anf !== y.anf || Math.abs(x.t - y.t) > 4) continue;
        var forte = !!(x.cidade && y.cidade && x.cidade === y.cidade);
        result[x.i] = result[x.i] || { forte: 0, fraca: 0 };
        result[y.i] = result[y.i] || { forte: 0, fraca: 0 };
        if (forte) { result[x.i].forte++; result[y.i].forte++; }
        else { result[x.i].fraca++; result[y.i].fraca++; }
      }
    }
    return result;
  };

  // ---------- Tabela de tasks (drill) — mesmas colunas da BASE_METRICAS original ----------
  U.taskTable = function (rows) {
    var thead = h('thead', null, h('tr', null, ['Região', 'TSK', 'Site', 'Cidade', 'Falha', 'P', 'Criação', 'Vencimento'].map(function (t) { return h('th', { text: t }); })));
    var body = rows.slice(0, 1000).map(function (t) {
      return h('tr', null, [
        h('td', { text: C.REGIAO_LABELS[t.regiao] || t.regiao || '—' }),
        h('td', { text: t.osNumero || '—' }),
        h('td', { text: t.siteId || t.enderecoId || '—' }),
        h('td', { text: t.cidade || '—' }),
        h('td', { text: t.tipoFalha || '—' }),
        h('td', { text: t.prioridade || '—' }),
        h('td', { text: t.dataCriacao ? D.formatarDataBR(t.dataCriacao) : '—' }),
        h('td', { text: t.vencimentoCalc ? D.formatarDataBR(t.vencimentoCalc) : '—' })
      ]);
    });
    var tbl = h('table', { class: 'trj-table' }, [thead, h('tbody', null, body)]);
    return wrapTable(tbl, rows.length);
  };

  // ---------- Tabela de incidentes G.E.N.E.S.I.S (Sites Fora + drills) ----------
  // Colunas iguais ao painel de origem (Horário/Duração/Tec/Site/END_ID/ANF/Cidade-UF),
  // troca a coluna "Status" do GENESIS pela TSK aberta na fila (tasksEnriched),
  // e sinaliza com ⚡ incidentes prováveis de mesma causa raiz (mesma ANF, horário próximo).
  U.incidentTable = function (rows, tasksEnriched) {
    var corr = U.computeCorrelacoes(rows);
    var thead = h('thead', null, h('tr', null,
      ['Horário', 'Duração', 'Tec', 'Site', 'END_ID', 'ANF', 'Cidade/UF', 'TSK', 'Previsão', 'Causa', 'Detalhe']
        .map(function (t) { return h('th', { text: t }); })));
    var body = rows.slice(0, 1000).map(function (r, idx) {
      var c = corr[idx];
      var rowStyle = {}, corrIcon = null;
      if (c && c.forte > 0) {
        rowStyle.borderLeft = '3px solid #e74c3c';
        corrIcon = h('span', { style: { marginRight: '5px' }, title: 'Correlacionado com ' + c.forte + ' outro(s) incidente(s) — mesma ANF e cidade, horário a até 4min de diferença', text: '⚡' });
      } else if (c && c.fraca > 0) {
        rowStyle.borderLeft = '3px solid #f1c40f';
        corrIcon = h('span', { style: { marginRight: '5px' }, title: 'Correlacionado com ' + c.fraca + ' outro(s) incidente(s) — mesma ANF, horário a até 4min de diferença', text: '⚡' });
      }
      return h('tr', { style: rowStyle }, [
        h('td', { text: r.horario || '—' }),
        h('td', { text: r.downtime || r.duracao || '—' }),
        h('td', { text: r.tecnologia || '—' }),
        h('td', null, [corrIcon, h('span', { text: r.site || '—' })]),
        h('td', { text: r.enderecoId || '—' }),
        h('td', { text: r.anf || '—' }),
        h('td', { text: r.cidadeUf || r.cidade || '—' }),
        h('td', null, U.tskCell(r, tasksEnriched)),
        h('td', { text: r.previsao || '/' }),
        h('td', { text: r.causa || '/' }),
        h('td', { text: r.detalhe || '#', style: { maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } })
      ]);
    });
    var tbl = h('table', { class: 'trj-table' }, [thead, h('tbody', null, body)]);
    return wrapTable(tbl, rows.length);
  };

  function wrapTable(tbl, n) {
    return h('div', null, [
      h('div', { class: 'text-xs mb-2', style: { color: 'var(--trj-muted)' }, text: fmtNum(n) + ' registro(s)' + (n > 1000 ? ' (exibindo 1000)' : '') }),
      h('div', { style: { maxHeight: '64vh', overflow: 'auto' } }, tbl)
    ]);
  }

  // ---------- Section helper ----------
  U.pageHeader = function (title, subtitle, right) {
    return h('div', { class: 'flex items-end justify-between flex-wrap gap-3 mb-5' }, [
      h('div', null, [
        h('h1', { class: 'text-2xl font-extrabold', text: title }),
        subtitle ? h('p', { class: 'text-sm mt-1', style: { color: 'var(--trj-muted)' }, text: subtitle }) : null
      ]),
      right || null
    ]);
  };

  TRJ.ui = U;
})(window.TRJ = window.TRJ || {});
