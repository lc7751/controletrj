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
    var headRight = [];
    if (opts.onCopy) {
      headRight.push(h('button', {
        class: 'trj-btn trj-btn-ghost', text: '📋 Copiar', title: 'Copiar este detalhamento em texto (formato WhatsApp)',
        onclick: function () { U.copyText(opts.onCopy(), 'Detalhamento copiado!'); }
      }));
    }
    headRight.push(h('button', { class: 'trj-btn trj-btn-ghost', text: '✕ Fechar', onclick: U.closeModal }));
    var head = h('div', { class: 'flex items-center justify-between px-5 py-3 flex-wrap gap-2', style: { borderBottom: '1px solid var(--trj-border)' } }, [
      h('h3', { class: 'text-base font-bold', style: { color: 'var(--trj-primary)' }, text: title }),
      h('div', { class: 'flex items-center gap-2' }, headRight)
    ]);
    var modal = h('div', { class: 'trj-modal' }, [head, body]);
    if (opts.footer) modal.appendChild(h('div', { class: 'px-5 py-3', style: { borderTop: '1px solid var(--trj-border)' } }, opts.footer));
    var bg = h('div', { class: 'trj-modal-bg', id: 'trj-modal-host', onclick: function (ev) { if (ev.target === bg) U.closeModal(); } }, modal);
    document.body.appendChild(bg);
  };
  // fecha o modal com ESC, sem precisar clicar em "Fechar" (registrado uma única vez)
  if (!U._escWired) {
    U._escWired = true;
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && document.getElementById('trj-modal-host')) U.closeModal();
    });
  }

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

  // ---------- Switch (toggle bonito, com hover/glow) ----------
  // U.switch(checked, label, onChange) — onChange recebe o novo boolean.
  U.switch = function (checked, label, onChange) {
    var input = h('input', { type: 'checkbox', class: 'trj-switch-input', checked: checked ? 'checked' : null });
    input.checked = !!checked; // garante o estado real do DOM, não só o atributo inicial
    input.addEventListener('change', function () { onChange(input.checked); });
    return h('label', { class: 'trj-switch-wrap' }, [
      input,
      h('span', { class: 'trj-switch-track' }, h('span', { class: 'trj-switch-thumb' })),
      label ? h('span', { class: 'trj-switch-label', text: label }) : null
    ]);
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

  // ---------- Copiar texto (clipboard) ----------
  U.copyText = function (text, msg) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        function () { U.toast(msg || 'Copiado!', 'ok'); },
        function () { U.toast('Não foi possível copiar.', 'err'); }
      );
    } else {
      U.toast('Cópia não suportada neste navegador.', 'err');
    }
  };

  // ---------- Chart card (titulo + canvas) ----------
  // opts.onCopy(): se informado, mostra um botão "📋" que copia o texto retornado.
  U.chartCard = function (title, opts) {
    opts = opts || {};
    var canvas = h('canvas');
    var wrap = h('div', { class: 'chart-wrap' + (opts.small ? ' sm' : '') }, canvas);
    var rightBits = [];
    if (opts.hint) {
      // hint pode ser string ou elemento DOM (ex.: um U.switch)
      if (typeof opts.hint === 'string') {
        rightBits.push(h('span', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: opts.hint }));
      } else if (opts.hint && opts.hint.nodeType) {
        rightBits.push(opts.hint);
      }
    }
    if (opts.rightEl && opts.rightEl.nodeType) rightBits.push(opts.rightEl);
    if (opts.onCopy) {
      rightBits.push(h('button', {
        class: 'trj-btn trj-btn-ghost', title: 'Copiar dados em texto',
        style: { padding: '3px 9px', fontSize: '12px' }, text: '📋',
        onclick: function () { U.copyText(opts.onCopy(), 'Dados copiados!'); }
      }));
    }
    var head = h('div', { class: 'flex items-center justify-between mb-3' }, [
      h('h3', { class: 'text-sm font-bold flex items-center gap-2' }, [
        h('span', { class: 'trj-chart-dot' }),
        h('span', { text: title })
      ]),
      rightBits.length ? h('div', { class: 'flex items-center gap-2' }, rightBits) : null
    ]);
    var card = h('div', { class: 'trj-card trj-chart-card p-4' }, [head, wrap]);
    return { card: card, canvas: canvas };
  };

  // ---------- Chart.js: tema escuro ----------
  var charts = [];
  U.destroyCharts = function () { charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = []; };

  function isLightTheme() { return document.documentElement.getAttribute('data-theme') === 'light'; }
  function gridColor() { return isLightTheme() ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'; }
  function tickColor() { return isLightTheme() ? '#5a5d6b' : '#9a9aa3'; }
  var tooltipCfg = {
    backgroundColor: '#1a1a24', titleColor: '#ff8c00', bodyColor: '#f0f0f0',
    borderColor: 'rgba(255,140,0,0.4)', borderWidth: 1, padding: 10, cornerRadius: 8
  };

  function register(c) { charts.push(c); return c; }

  // Clareia uma cor hex pro efeito de hover — mistura apenas 30% de branco
  // pra dar destaque sutil sem perder a cor original de referência.
  function clarearCor(hex) {
    hex = (hex || '#ff8c00').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    r = Math.min(255, Math.round(r + (255 - r) * 0.30));
    g = Math.min(255, Math.round(g + (255 - g) * 0.30));
    b = Math.min(255, Math.round(b + (255 - b) * 0.30));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // Enriquece datasets com hoverBackgroundColor mais clara + borda branca sutil
  function hoverDatasets(datasets) {
    return datasets.map(function (ds) {
      var bgArr = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : [ds.backgroundColor];
      var hoverBg = bgArr.map(function (c) {
        var cs = c && c.toString ? c.toString() : '';
        return cs.startsWith('#') ? clarearCor(cs) : cs;
      });
      return Object.assign({}, ds, {
        hoverBackgroundColor: hoverBg,
        hoverBorderColor: bgArr.map(function () { return 'rgba(255,255,255,0.55)'; }),
        hoverBorderWidth: 1.5
      });
    });
  }

  // bar vertical. data = [{label,total,cor?}], onBar(index)
  U.barChart = function (canvas, data, opts) {
    opts = opts || {};
    var datasets = [{ data: data.map(function (d) { return d.total; }),
      backgroundColor: data.map(function (d) { return d.cor || C.CORES_TRJ.orange; }),
      borderRadius: 6, maxBarThickness: 46 }];
    return register(new Chart(canvas, {
      type: 'bar',
      data: { labels: data.map(function (d) { return d.label; }), datasets: hoverDatasets(datasets) },
      options: baseOpts({ onClick: opts.onBar, horizontal: false })
    }));
  };

  // bar horizontal
  U.hbarChart = function (canvas, data, opts) {
    opts = opts || {};
    var datasets = [{ data: data.map(function (d) { return d.total; }),
      backgroundColor: data.map(function (d) { return d.cor || C.CORES_TRJ.orange; }),
      borderRadius: 6, maxBarThickness: 34 }];
    return register(new Chart(canvas, {
      type: 'bar',
      data: { labels: data.map(function (d) { return d.label; }), datasets: hoverDatasets(datasets) },
      options: baseOpts({ onClick: opts.onBar, horizontal: true })
    }));
  };

  // stacked dentro/fora (+ preditiva opcional). data = [{label, dentro, fora, preditiva?}], onSeg(index, datasetIndex)
  U.stackedChart = function (canvas, data, opts) {
    opts = opts || {};
    var o = baseOpts({ horizontal: false });
    o.scales.x.stacked = true; o.scales.y.stacked = true;
    o.plugins.legend.display = true;
    if (opts.onSeg) o.onClick = function (ev, els) { if (els && els.length) opts.onSeg(els[0].index, els[0].datasetIndex); };
    var temPreditiva = data.some(function (d) { return d.preditiva != null && d.preditiva > 0; });
    var datasets = [
      { label: opts.l1 || 'Dentro', data: data.map(function (d) { return d.dentro; }), backgroundColor: C.CORES_TRJ.green, borderRadius: 4, maxBarThickness: 46 },
      { label: opts.l2 || 'Fora', data: data.map(function (d) { return d.fora; }), backgroundColor: C.CORES_TRJ.red, borderRadius: 4, maxBarThickness: 46 }
    ];
    if (temPreditiva) datasets.push({ label: opts.l3 || 'Preditiva', data: data.map(function (d) { return d.preditiva || 0; }), backgroundColor: C.CORES_TRJ.orange, borderRadius: 4, maxBarThickness: 46 });
    return register(new Chart(canvas, {
      type: 'bar',
      data: { labels: data.map(function (d) { return d.label; }), datasets: hoverDatasets(datasets) },
      options: o
    }));
  };

  // donut. data = [{name,value}], onSlice(index) — com hover de cor mais clara + borda branca
  U.donutChart = function (canvas, data, opts) {
    opts = opts || {};
    var cores = opts.cores || C.CHART_CORES;
    var bgCores = data.map(function (d, i) { return cores[i % cores.length]; });
    var hoverCores = bgCores.map(function (c) { return c.startsWith('#') ? clarearCor(c) : c; });
    return register(new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.map(function (d) { return d.name; }),
        datasets: [{
          data: data.map(function (d) { return d.value; }),
          backgroundColor: bgCores,
          hoverBackgroundColor: hoverCores,
          hoverBorderColor: 'rgba(255,255,255,0.6)',
          hoverBorderWidth: 2,
          borderColor: isLightTheme() ? '#ffffff' : '#13131a', borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: { legend: { position: 'right', labels: { color: tickColor(), font: { size: 11 }, boxWidth: 12 } }, tooltip: tooltipCfg },
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
        legend: { display: false, labels: { color: tickColor() } },
        tooltip: tooltipCfg
      },
      scales: {
        x: { ticks: { color: tickColor(), font: { size: 11 } }, grid: { color: gridColor() } },
        y: { ticks: { color: tickColor(), font: { size: 11 } }, grid: { color: gridColor() }, beginAtZero: true }
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
      return STATUS_FECHADO_TSK.indexOf(st) < 0;
    });
    if (!candidatos.length) return null;
    // Maior sequenciaId = mais recente (regra da planilha: coluna C)
    candidatos.sort(function (a, b) {
      var sa = Number(a.sequenciaId) || 0;
      var sb = Number(b.sequenciaId) || 0;
      if (sb !== sa) return sb - sa;
      var pa = (a.status || '').toUpperCase() === 'INICIADO' ? 0 : 1;
      var pb = (b.status || '').toUpperCase() === 'INICIADO' ? 0 : 1;
      return pa - pb;
    });
    var melhor = candidatos[0];
    return {
      osNumero: melhor.osNumero,
      status: melhor.status || null,
      filaAtual: melhor.filaAtual || null,
      motivoCancelamento: melhor.motivoCancelamento || null,
      total: candidatos.length,
      sequenciaId: melhor.sequenciaId
    };
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
    var tooltip = (m.status || '') + (m.filaAtual ? '\n' + m.filaAtual : '');
    return h('span', { class: 'trj-badge', style: { background: bg, color: cor, fontWeight: '700', cursor: 'help' }, title: tooltip }, texto);
  };

  // Padrões de anotações automáticas do sistema (bot) — ignoradas ao extrair o último update manual.
  var BOT_PATTERNS = [/WFM\s*Agent/i, /MONITOR\s*CCI/i, /isoc_fixa/i, /Anotações de trabalho/i, /Sistema.*automático/i];
  function ehBot(bloco) { return BOT_PATTERNS.some(function (p) { return p.test(bloco); }); }
  function extrairUltimaAnotacao(bgTexto) {
    if (!bgTexto) return null;
    var blocos = bgTexto.toString().split(/(?=\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)|(?=[A-Z]{2,6}_\d{4}[\d\-]+)/);
    for (var i = 0; i < blocos.length; i++) {
      var b = blocos[i].trim();
      if (b.length < 20) continue;
      if (!ehBot(b)) return b;
    }
    return null;
  }

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

  // ---------- Badge visual de vencimento (backlog aberto: "VENCE EM / VENCIDO A") ----------
  U.vencimentoBadge = function (vencimentoCalc) {
    var venc = D.formatarVencimentoSimples(vencimentoCalc);
    if (!venc.cor) return h('span', { style: { color: 'var(--trj-muted)' }, text: '—' });
    var bg = venc.venceu ? 'rgba(231,76,60,.16)' : 'rgba(46,204,113,.16)';
    var icone = venc.venceu ? '⚠️' : '⏱';
    var bits = [h('span', { text: icone }), h('span', { text: venc.texto })];
    if (venc.venceu) bits.unshift(h('span', { class: 'trj-pulse-dot' }));
    return h('span', {
      class: 'trj-badge', style: { background: bg, color: venc.cor, fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }
    }, bits);
  };

  // ---------- Badge de tipo de cancelamento ----------
  // Para canceladas: mostra o MOTIVO (Associação ou Automação), sem medir SLA.
  // A medição de SLA não é confiável pra canceladas porque a data de
  // cancelamento fica em texto livre (campo BG), então usar o tipo é mais
  // seguro e mais útil operacionalmente.
  U.cancelamentoBadge = function (t) {
    var motivo = (t.motivoCancelamento || '').toString().toUpperCase();
    var ehAssoc = motivo.indexOf('ASSOCIA') >= 0;
    if (ehAssoc) {
      return h('span', { class: 'trj-badge', style: { background: 'rgba(52,152,219,.16)', color: '#3498db', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' } }, [
        h('span', { text: '🔗' }), h('span', { text: 'Associação' })
      ]);
    }
    return h('span', { class: 'trj-badge', style: { background: 'rgba(155,89,182,.16)', color: '#9b59b6', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' } }, [
      h('span', { text: '⚡' }), h('span', { text: 'Automação' })
    ]);
  };

  // ---------- Badge de Resultado SLA (somente para CONCLUÍDAS) ----------
  // Compara fimCalc (hora real de encerramento) com vencimentoCalc (prazo).
  U.resultadoSlaBadge = function (t) {
    if (!t.fimCalc || !t.vencimentoCalc) return h('span', { style: { color: 'var(--trj-muted)' }, text: '—' });
    var dentroSla = new Date(t.fimCalc).getTime() <= new Date(t.vencimentoCalc).getTime();
    if (dentroSla) {
      return h('span', { class: 'trj-badge', style: { background: 'rgba(46,204,113,.16)', color: '#2ecc71', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' } }, [
        h('span', { text: '✅' }), h('span', { text: 'Dentro SLA' })
      ]);
    }
    return h('span', { class: 'trj-badge', style: { background: 'rgba(231,76,60,.16)', color: '#e74c3c', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' } }, [
      h('span', { text: '❌' }), h('span', { text: 'Fora SLA' })
    ]);
  };

  // ---------- Tabela de tasks (drill) ----------
  // opts.modoResultado = true  → última coluna mostra "Dentro SLA / Fora SLA" (concluídas)
  // opts.modoCancelamento = true → última coluna mostra "Automação / Associação" (canceladas)
  // sem flag → mostra tempo restante (backlog aberto)
  U.taskTable = function (rows, opts) {
    opts = opts || {};
    var modoResultado = opts.modoResultado;
    var modoCancelamento = opts.modoCancelamento;
    var colLabel = modoCancelamento ? 'Tipo Cancelamento' : (modoResultado ? 'Resultado SLA' : 'Vencimento');
    var thead = h('thead', null, h('tr', null, ['Região', 'TSK', 'Site', 'Cidade', 'Falha', 'P', 'Criação', colLabel].map(function (t) { return h('th', { text: t }); })));
    var body = rows.slice(0, 1000).map(function (t) {
      var lastCell;
      if (modoCancelamento) lastCell = U.cancelamentoBadge(t);
      else if (modoResultado) lastCell = U.resultadoSlaBadge(t);
      else lastCell = U.vencimentoBadge(t.vencimentoCalc);
      return h('tr', null, [
        h('td', { text: C.REGIAO_LABELS[t.regiao] || t.regiao || '—' }),
        h('td', { text: t.osNumero || '—' }),
        h('td', { text: t.siteId || t.enderecoId || '—' }),
        h('td', { text: t.cidade || '—' }),
        h('td', { text: t.tipoFalha || '—' }),
        h('td', { text: t.prioridade || '—' }),
        h('td', { text: t.dataCriacao ? D.formatarDataCompacta(t.dataCriacao) : '—' }),
        h('td', null, lastCell)
      ]);
    });
    var tbl = h('table', { class: 'trj-table' }, [thead, h('tbody', null, body)]);
    return wrapTable(tbl, rows.length);
  };

  // ---------- Texto pra copiar (WhatsApp) — drill de tarefas ----------
  // Agrupa por Região e, dentro de cada região, por Prioridade (*P1*, *P2*...),
  // pra servir de cobrança direta com o time.
  U.taskTableCopyText = function (rows, titulo) {
    var porRegiao = {};
    (rows || []).forEach(function (t) {
      var reg = C.REGIAO_LABELS[t.regiao] || t.regiao || 'OTHERS';
      var p = (t.prioridade || 'SEM PRIORIDADE').toString().toUpperCase().trim() || 'SEM PRIORIDADE';
      porRegiao[reg] = porRegiao[reg] || {};
      porRegiao[reg][p] = porRegiao[reg][p] || [];
      porRegiao[reg][p].push(t);
    });
    var linhas = ['*' + (titulo || 'Detalhamento') + '*', 'Total: ' + (rows || []).length, ''];
    Object.keys(porRegiao).sort().forEach(function (reg) {
      linhas.push('*' + reg + '*');
      Object.keys(porRegiao[reg]).sort().forEach(function (p) {
        linhas.push('*' + p + '*');
        porRegiao[reg][p].forEach(function (t) {
          var venc = D.formatarVencimentoSimples(t.vencimentoCalc);
          linhas.push('• ' + (t.osNumero || '—') + ' · ' + (t.siteId || t.enderecoId || '—') + ' · ' + (t.cidade || '—') + ' · ' + (t.tipoFalha || '—') + ' · ' + venc.texto);
        });
      });
      linhas.push('');
    });
    return linhas.join('\n').trim();
  };

  // ---------- Tabela de incidentes G.E.N.E.S.I.S (Sites Fora + drills) ----------
  // Colunas iguais ao painel de origem (Horário/Duração/Tec/Site/END_ID/ANF/Cidade-UF),
  // troca a coluna "Status" do GENESIS pela TSK aberta na fila (tasksEnriched),
  // e sinaliza com ⚡ incidentes prováveis de mesma causa raiz (mesma ANF, horário próximo).
  U.incidentTable = function (rows, tasksEnriched) {
    var corr = U.computeCorrelacoes(rows);
    var thead = h('thead', null, h('tr', null,
      ['Horário', 'Duração', 'Site', 'END_ID', 'ANF', 'Cidade/UF', 'TSK', 'Último Update', 'Causa', 'Detalhe']
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
        h('td', null, [corrIcon, h('span', { text: r.site || '—' })]),
        h('td', { text: r.enderecoId || '—' }),
        h('td', { text: r.anf || '—' }),
        h('td', { text: r.cidadeUf || r.cidade || '—' }),
        h('td', null, U.tskCell(r, tasksEnriched)),
        h('td', null, U.ultimoUpdateCell(r, tasksEnriched)),
        h('td', { text: r.causa || '/' }),
        h('td', null, function(){
          var textoDetalhe = r.detalhe || '';
          if (!textoDetalhe || textoDetalhe === '#') return h('span', { style: { color: 'var(--trj-muted)' }, text: '#' });
          var resumo = textoDetalhe.slice(0, 35) + (textoDetalhe.length > 35 ? '…' : '');
          var cel = h('span', {
            style: { maxWidth: '220px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: textoDetalhe.length > 35 ? 'pointer' : 'default', textDecoration: textoDetalhe.length > 35 ? 'underline dotted' : 'none' },
            title: textoDetalhe, text: resumo
          });
          if (textoDetalhe.length > 35) {
            cel.addEventListener('click', function(ev) {
              ev.stopPropagation();
              var cid = h('div', { style: { whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.8', padding: '4px' }, text: textoDetalhe });
              U.openModal('Detalhe', cid);
            });
          }
          return cel;
        }())
      ]);
    });
    var tbl = h('table', { class: 'trj-table' }, [thead, h('tbody', null, body)]);
    return wrapTable(tbl, rows.length);
  };

  // ---------- Texto pra copiar (WhatsApp) — drill de incidentes ----------
  U.incidentTableCopyText = function (rows, titulo) {
    var porRegiao = {};
    (rows || []).forEach(function (r) {
      var reg = C.REGIAO_LABELS[r.regiao] || r.regiao || 'OTHERS';
      porRegiao[reg] = porRegiao[reg] || [];
      porRegiao[reg].push(r);
    });
    var linhas = ['*' + (titulo || 'Detalhamento') + '*', 'Total: ' + (rows || []).length, ''];
    Object.keys(porRegiao).sort().forEach(function (reg) {
      linhas.push('*' + reg + '*');
      porRegiao[reg].forEach(function (r) {
        linhas.push('• ' + (r.site || '—') + ' · ' + (r.enderecoId || '—') + ' · ' + (r.cidadeUf || r.cidade || '—') + ' · ANF ' + (r.anf || '—'));
      });
      linhas.push('');
    });
    return linhas.join('\n').trim();
  };

  function wrapTable(tbl, n) {
    return h('div', null, [
      h('div', { class: 'text-xs mb-2', style: { color: 'var(--trj-muted)' }, text: fmtNum(n) + ' registro(s)' + (n > 1000 ? ' (exibindo 1000)' : '') }),
      h('div', { style: { maxHeight: '64vh', overflow: 'auto' } }, tbl)
    ]);
  }

  // ---------- Section helper ----------
  // opts.compact: cabeçalho bem sutil/reduzido (ex.: página Sites Fora, onde o
  // que importa é o conteúdo da lista, não o topo).
  U.pageHeader = function (title, subtitle, right, opts) {
    opts = opts || {};
    var logoSize = opts.compact ? '30px' : '42px';
    var logo = h('img', { src: 'assets/logo-trj.png', alt: '', class: 'trj-logo-hover', style: { width: logoSize, height: logoSize, objectFit: 'contain', flexShrink: '0' } });
    var tituloEl = h('h1', { class: 'trj-heading font-extrabold flex items-center gap-2', style: { fontSize: opts.compact ? '17px' : '26px' } }, [logo, h('span', { text: title })]);
    return h('div', { class: 'flex items-end justify-between flex-wrap gap-3', style: { marginBottom: opts.compact ? '10px' : '20px' } }, [
      h('div', null, [
        tituloEl,
        subtitle ? h('p', { class: 'text-sm mt-1', style: { color: 'var(--trj-muted)' }, text: subtitle }) : null
      ]),
      right || null
    ]);
  };

  TRJ.ui = U;
  // ---------- Rodapé "Equipe de Desenvolvimento" ----------
  // Reaproveitado tanto no painel principal (app.js) quanto no dashboard
  // público (dashboard-publico.html), pra manter o crédito sempre visível.

// Ícone SVG de folha/documento (para o Último Update)
  var ICONE_FOLHA_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';

  // Classifica o primeiro bloco do BG (mais recente) para definir o estado do update:
  //   'acionamento' → último contato foi MONITOR CCI (ticket acionado, aguardando técnico)
  //   'sem'         → nenhuma entrada encontrada ou só bot puro (WFM Agent com form)
  //   'ok'          → tem texto de técnico no bloco
  function classificarUltimoBloco(bgTexto) {
    if (!bgTexto || bgTexto.toString().trim().length < 5) return { estado: 'sem', texto: null };
    var texto = bgTexto.toString();
    // Divide em blocos (mais recente primeiro)
    var blocos = texto.split(/(?=\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)|(?=[A-Z]{2,6}_\d{4}[\d\-]+)/);
    // Pega o primeiro bloco com conteúdo
    for (var i = 0; i < blocos.length; i++) {
      var b = blocos[i].trim();
      if (b.length < 10) continue;
      if (/MONITOR\s*CCI/i.test(b)) return { estado: 'acionamento', texto: b };
      if (/WFM\s*Agent/i.test(b) || /isoc_fixa/i.test(b)) {
        // WFM Agent pode conter texto humano no final (após o formulário)
        // Remove o cabeçalho do form e vê o que sobra
        var semForm = b.replace(/[\s\S]*?(Tramitação|Suspensão|Motivo da visita|Motivo:\s)/i, '').trim();
        // Se há texto relevante após o form, é um update de técnico via WFM
        if (semForm.length > 20 && !/^(Tramita|Suspens|Mostra|Visita)/i.test(semForm)) {
          return { estado: 'ok', texto: b };
        }
        return { estado: 'sem', texto: b };
      }
      // Qualquer outro bloco = anotação humana direta
      return { estado: 'ok', texto: b };
    }
    return { estado: 'sem', texto: null };
  }

  // Célula "Último Update" — substitui a coluna Previsão na tabela de incidentes.
  // Ícone de folha SVG: verde = tem update, laranja = verificando acionamento, vermelho = sem update.
  U.ultimoUpdateCell = function (incident, tasksEnriched) {
    var m = tskAberta(incident, tasksEnriched);
    if (!m) return h('span', { style: { color: 'var(--trj-muted)' }, text: '—' });

    var resultado = classificarUltimoBloco(m.motivoCancelamento);
    var estado = resultado.estado;
    var textoCompleto = resultado.texto;

    if (estado === 'sem') {
      // Folha com borda vermelha pulsante — sem update do técnico
      var el = h('span', {
        class: 'trj-badge',
        style: { background: 'rgba(231,76,60,.14)', color: '#e74c3c', fontWeight: '700', cursor: 'default', gap: '5px', display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(231,76,60,.35)' },
        title: 'Nenhuma atualização do técnico encontrada'
      }, [
        h('span', { html: ICONE_FOLHA_SVG }),
        h('span', { class: 'trj-pulse-dot' }),
        h('span', { text: 'Sem update' })
      ]);
      return el;
    }

    if (estado === 'acionamento') {
      // Folha com contorno laranja — ticket acionado, aguardando resposta
      var resumo = (textoCompleto || '').replace(/^\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s+-?\s*/,'').trim().slice(0, 28);
      if ((textoCompleto||'').length > 28) resumo += '…';
      var btnAc = h('button', {
        class: 'trj-btn',
        style: { fontSize: '11px', padding: '2px 7px', background: 'rgba(255,140,0,.12)', color: 'var(--trj-primary)', border: '1px solid rgba(255,140,0,.35)', display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        title: textoCompleto || 'Verificando acionamento',
        onclick: function(ev) {
          ev.stopPropagation();
          var cid = h('div', { style: { whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace,monospace', fontSize: '12px', maxHeight: '60vh', overflowY: 'auto', padding: '12px', lineHeight: '1.6', background: 'var(--trj-card2)', borderRadius: '8px' }, text: textoCompleto || '' });
          U.openModal('Verificando Acionamento — ' + (m.osNumero || ''), cid);
        }
      }, [h('span', { html: ICONE_FOLHA_SVG }), h('span', { text: 'Acionando' })]);
      return btnAc;
    }

    // Estado 'ok' — há texto de técnico, exibir com botão clicável
    var semPrefix = (textoCompleto || '').replace(/^\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s+-?\s*/,'').trim();
    var resumoOk = semPrefix.slice(0, 30) + (semPrefix.length > 30 ? '…' : '');
    return h('button', {
      class: 'trj-btn trj-btn-ghost',
      style: { fontSize: '11px', padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--trj-green)' },
      title: textoCompleto || '',
      onclick: function(ev) {
        ev.stopPropagation();
        var cid = h('div', { style: { whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace,monospace', fontSize: '12px', maxHeight: '60vh', overflowY: 'auto', padding: '12px', lineHeight: '1.6', background: 'var(--trj-card2)', borderRadius: '8px' }, text: textoCompleto || '' });
        U.openModal('Último Update — ' + (m.osNumero || ''), cid);
      }
    }, [h('span', { html: ICONE_FOLHA_SVG }), h('span', { text: resumoOk })]);
  };

  U.devFooter = function () {
    function card(initials, cor, role, name, email) {
      return h('div', { class: 'trj-dev-card' }, [
        h('div', { class: 'trj-dev-avatar', style: { background: cor }, text: initials }),
        h('div', null, [
          h('div', { class: 'trj-dev-role', style: { color: cor }, text: role }),
          h('div', { class: 'trj-dev-name', text: name }),
          h('a', { class: 'trj-dev-email', href: 'mailto:' + email, text: email })
        ])
      ]);
    }
    return h('div', { class: 'trj-dev-footer' }, [
      h('div', { class: 'trj-dev-footer-title', text: 'Equipe de Desenvolvimento' }),
      h('div', { class: 'trj-dev-cards' }, [
        card('LI', 'var(--trj-primary)', 'Desenvolvedor', 'Lucas Infante', 'lucas.esao7751@gmail.com'),
        card('BA', 'var(--trj-blue)', 'Idealizador', 'Bruno Augusto', 'bruno.augusto.bafs@gmail.com')
      ]),
      h('div', { class: 'trj-dev-footer-copy', text: 'Controle operacional TIM - TLP  ·  Todos os direitos reservados' })
    ]);
  };

})(window.TRJ = window.TRJ || {});
