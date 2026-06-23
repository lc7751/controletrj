/* =====================================================================
 * Página: Sites Fora — NE IDs
 * ---------------------------------------------------------------------
 * 1) Cole o texto com os sites fora -> o sistema detecta os NE IDs
 *    automaticamente (ex.: RJRJO_0263, ESCCB_0006).
 * 2) Envie a "Planilha de Filas" (.xlsx/.xls) -> o sistema cruza os
 *    NE IDs detectados com a planilha e mostra o que foi encontrado.
 *
 * Os NE IDs detectados ficam salvos no navegador (localStorage), então
 * sobrevivem a um F5. A planilha fica em memória durante a sessão.
 * ===================================================================== */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants;

  var LS_TEXT = 'trj_sf_text', LS_IDS = 'trj_sf_neids';
  // Padrão de NE ID: 2 a 6 letras + "_" + 2 a 6 dígitos (ex.: RJRJO_0263)
  var NE_RE = /\b[A-Z]{2,6}_\d{2,6}\b/g;

  // estado persiste entre re-renders (closure do módulo)
  var state = {
    text: lsGet(LS_TEXT, ''),
    neids: lsGetJSON(LS_IDS, []),
    planilha: null // { nome, rows, headers, idCol, filaCol }
  };

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsGetJSON(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function saveState() { lsSet(LS_TEXT, state.text || ''); lsSet(LS_IDS, JSON.stringify(state.neids || [])); }

  function detectNeIds(text) {
    var seen = {}, out = [];
    var up = (text || '').toUpperCase();
    var m; NE_RE.lastIndex = 0;
    while ((m = NE_RE.exec(up))) { if (!seen[m[0]]) { seen[m[0]] = 1; out.push(m[0]); } }
    return out.sort();
  }

  TRJ.pages.sitesFora = function (container, ctx) {
    var app = ctx.app;

    var grid = U.h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-4' }, [
      buildNeIdCard(app),
      buildPlanilhaCard(app)
    ]);
    container.appendChild(grid);

    // resultado do cruzamento (largura total)
    if (state.neids.length && state.planilha) {
      container.appendChild(buildCruzamento(app));
    }
  };

  // ---------------- Card 1: NE IDs ----------------
  function buildNeIdCard(app) {
    var head = cardHead('📄', 'Sites Fora — NE IDs', 'Cole o texto com os sites fora. O sistema detecta automaticamente os NE IDs.');

    var ta = U.h('textarea', {
      class: 'trj-input', spellcheck: 'false',
      placeholder: 'Cole aqui o texto com os sites fora...\nEx.: RJRJO_0263, ESCCB_0006 ...',
      style: { width: '100%', minHeight: '220px', resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '13px', lineHeight: '1.5' }
    });
    ta.value = state.text || '';

    var btnDetect = U.h('button', { class: 'trj-btn trj-btn-primary clickable', html: '⚡ Detectar NE IDs', onclick: function () {
      state.text = ta.value;
      state.neids = detectNeIds(state.text);
      saveState();
      if (!state.neids.length) U.toast('Nenhum NE ID encontrado no texto.', 'err');
      else U.toast(state.neids.length + ' NE ID(s) detectado(s).', 'ok');
      app.render();
    } });
    var btnClear = U.h('button', { class: 'trj-btn trj-btn-ghost clickable', html: '✕ Limpar', onclick: function () {
      state.text = ''; state.neids = []; saveState(); app.render();
    } });
    var pill = U.h('span', { class: 'trj-badge', style: { background: 'rgba(255,255,255,.06)', color: 'var(--trj-muted)', alignSelf: 'center' }, text: state.neids.length + ' END IDs' });
    var btnRow = U.h('div', { class: 'flex gap-2 flex-wrap mt-3 items-center' }, [btnDetect, btnClear, pill]);

    var card = U.h('div', { class: 'trj-card p-5 flex flex-col gap-1' }, [head, ta, btnRow]);

    // lista de NE IDs detectados (chips)
    if (state.neids.length) {
      card.appendChild(U.h('div', { class: 'text-sm font-bold mt-4 mb-2', style: { color: C.CORES_TRJ.green }, text: '✓ NE IDs detectados:' }));
      var chips = U.h('div', { class: 'grid gap-2', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', maxHeight: '180px', overflow: 'auto', paddingRight: '4px' } },
        state.neids.map(function (id) {
          return U.h('div', { class: 'flex items-center justify-between', style: { border: '1px solid rgba(231,76,60,.45)', color: '#ff8a80', background: 'rgba(231,76,60,.08)', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontFamily: 'ui-monospace, monospace' } }, [
            U.h('span', { text: id }),
            U.h('span', { class: 'clickable', title: 'Remover', style: { cursor: 'pointer', marginLeft: '6px', opacity: '.8' }, text: '✕', onclick: function () {
              state.neids = state.neids.filter(function (x) { return x !== id; }); saveState(); app.render();
            } })
          ]);
        }));
      card.appendChild(chips);
    }
    return card;
  }

  // ---------------- Card 2: Planilha de Filas ----------------
  function buildPlanilhaCard(app) {
    var head = cardHead('📁', 'Planilha de Filas', 'Arquivo Excel com os dados de filas para cruzamento com os NE IDs.');

    var fileInput = U.h('input', { type: 'file', accept: '.xlsx,.xls', style: { display: 'none' }, onchange: function () { lerPlanilha(this.files && this.files[0], app); } });

    var carregada = !!state.planilha;
    var statusTxt = carregada
      ? ('✓ ' + state.planilha.nome + ' — ' + U.fmtNum(state.planilha.rows.length) + ' linha(s)')
      : 'ⓘ Aguardando arquivo...';
    var statusPill = U.h('div', { class: 'trj-badge', style: { background: 'rgba(255,255,255,.05)', color: carregada ? C.CORES_TRJ.green : 'var(--trj-muted)', fontFamily: 'ui-monospace, monospace', padding: '6px 12px' }, text: statusTxt });

    var dz = U.h('div', { class: 'flex flex-col items-center justify-center gap-3 clickable', style: {
      border: '2px dashed ' + (carregada ? 'rgba(46,204,113,.5)' : 'var(--trj-border)'),
      borderRadius: '14px', padding: '36px 16px', textAlign: 'center', cursor: 'pointer', minHeight: '230px'
    } }, [
      U.h('div', { style: { fontSize: '40px' }, text: '📁' }),
      U.h('div', { class: 'font-bold', text: carregada ? 'Trocar arquivo' : 'Arraste o arquivo aqui' }),
      U.h('div', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, html: 'ou clique para selecionar — suporte a<br>.xlsx e .xls' }),
      statusPill
    ]);
    dz.addEventListener('click', function () { fileInput.click(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.style.borderColor = 'var(--trj-primary)'; dz.style.background = 'rgba(255,140,0,.06)'; });
    dz.addEventListener('dragleave', function () { dz.style.borderColor = carregada ? 'rgba(46,204,113,.5)' : 'var(--trj-border)'; dz.style.background = 'transparent'; });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.style.background = 'transparent';
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      lerPlanilha(f, app);
    });

    return U.h('div', { class: 'trj-card p-5 flex flex-col gap-1' }, [head, fileInput, dz]);
  }

  function lerPlanilha(file, app) {
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) { U.toast('Selecione um arquivo .xlsx ou .xls.', 'err'); return; }
    if (typeof XLSX === 'undefined') { U.toast('Biblioteca de Excel não carregou. Recarregue a página.', 'err'); return; }
    U.loading(true);
    file.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array', cellDates: true });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = ws ? XLSX.utils.sheet_to_json(ws, { defval: null }) : [];
      var headers = rows.length ? Object.keys(rows[0]) : [];
      var idCol = pickIdCol(rows, headers);
      var filaCol = pickCol(headers, /fila|queue/i) || pickCol(headers, /regi|área|area/i);
      state.planilha = { nome: file.name, rows: rows, headers: headers, idCol: idCol, filaCol: filaCol };
      U.toast(rows.length + ' linha(s) lida(s) da planilha.', 'ok');
      app.render();
    }).catch(function (e) {
      U.toast('Erro ao ler a planilha: ' + (e.message || e), 'err');
    }).finally(function () { U.loading(false); });
  }

  function normId(v) { return (v == null ? '' : String(v)).toUpperCase().trim(); }

  function pickIdCol(rows, headers) {
    var reFull = /^[A-Z]{2,6}_\d{2,6}$/;
    var best = null, bestScore = -1;
    headers.forEach(function (hd) {
      var score = 0;
      var sample = rows.slice(0, 300);
      sample.forEach(function (r) { if (reFull.test(normId(r[hd]))) score++; });
      var hn = String(hd).toLowerCase();
      if (/ne.?id|end.?id|elemento|^id$|site/.test(hn)) score += 8;
      if (score > bestScore) { bestScore = score; best = hd; }
    });
    return bestScore > 0 ? best : (headers[0] || null);
  }
  function pickCol(headers, re) {
    for (var i = 0; i < headers.length; i++) { if (re.test(String(headers[i]).toLowerCase())) return headers[i]; }
    return null;
  }

  // ---------------- Cruzamento NE IDs x Planilha ----------------
  function buildCruzamento(app) {
    var pl = state.planilha;
    var idMap = {};
    pl.rows.forEach(function (r) { var k = normId(r[pl.idCol]); if (k) idMap[k] = r; });

    var encontrados = [], naoEncontrados = [];
    state.neids.forEach(function (id) {
      if (idMap[id]) encontrados.push({ id: id, row: idMap[id] }); else naoEncontrados.push(id);
    });

    var kpis = U.h('div', { class: 'grid grid-cols-2 md:grid-cols-3 gap-3 mb-4' }, [
      U.kpiCard({ label: 'NE IDs detectados', value: U.fmtNum(state.neids.length), cor: C.CORES_TRJ.orange }),
      U.kpiCard({ label: 'Encontrados na planilha', value: U.fmtNum(encontrados.length), cor: C.CORES_TRJ.green }),
      U.kpiCard({ label: 'Não encontrados', value: U.fmtNum(naoEncontrados.length), cor: C.CORES_TRJ.red })
    ]);

    // tabela dos encontrados
    var extraCols = [];
    if (pl.filaCol && pl.filaCol !== pl.idCol) extraCols.push(pl.filaCol);
    pl.headers.forEach(function (hd) { if (hd !== pl.idCol && extraCols.indexOf(hd) < 0 && extraCols.length < 4) extraCols.push(hd); });

    var thead = U.h('thead', null, U.h('tr', null, ['NE ID'].concat(extraCols).map(function (t) { return U.h('th', { text: t }); })));
    var tbody = U.h('tbody', null, encontrados.slice(0, 800).map(function (e) {
      return U.h('tr', null, [U.h('td', { html: '<b>' + U.esc(e.id) + '</b>' })].concat(extraCols.map(function (c) {
        var v = e.row[c]; return U.h('td', { text: v == null || v === '' ? '—' : String(v) });
      })));
    }));

    var tabela = U.h('div', { class: 'trj-card p-4 mb-4' }, [
      U.h('h3', { class: 'text-sm font-bold mb-3', text: 'NE IDs encontrados na planilha de filas' }),
      encontrados.length
        ? U.h('div', { style: { maxHeight: '52vh', overflow: 'auto' } }, U.h('table', { class: 'trj-table' }, [thead, tbody]))
        : U.h('div', { class: 'text-sm', style: { color: 'var(--trj-muted)' }, text: 'Nenhum dos NE IDs detectados foi encontrado na planilha. Confira se a coluna de identificação está correta (detectada: ' + (pl.idCol || '—') + ').' })
    ]);

    var card = U.h('div', { class: 'mt-2' }, [
      U.pageHeader('Cruzamento NE IDs × Filas', 'Coluna de identificação detectada na planilha: ' + (pl.idCol || '—')),
      kpis, tabela
    ]);

    // não encontrados
    if (naoEncontrados.length) {
      card.appendChild(U.h('div', { class: 'trj-card p-4' }, [
        U.h('h3', { class: 'text-sm font-bold mb-3', style: { color: C.CORES_TRJ.red }, text: 'NE IDs não encontrados (' + naoEncontrados.length + ')' }),
        U.h('div', { class: 'flex flex-wrap gap-2' }, naoEncontrados.map(function (id) {
          return U.h('span', { class: 'trj-badge', style: { border: '1px solid rgba(231,76,60,.4)', color: '#ff8a80', background: 'rgba(231,76,60,.08)', fontFamily: 'ui-monospace, monospace' }, text: id });
        }))
      ]));
    }
    return card;
  }

  // ---------------- helper de cabeçalho dos cards ----------------
  function cardHead(emoji, title, sub) {
    return U.h('div', { class: 'flex items-start gap-3 mb-3' }, [
      U.h('div', { class: 'trj-card flex items-center justify-center', style: { width: '40px', height: '40px', minWidth: '40px', fontSize: '20px', borderRadius: '10px' }, text: emoji }),
      U.h('div', null, [
        U.h('h3', { class: 'text-base font-bold', text: title }),
        U.h('p', { class: 'text-xs mt-1', style: { color: 'var(--trj-muted)' }, text: sub })
      ])
    ]);
  }
})(window.TRJ = window.TRJ || {});
