/* js/pages/importar.js
   Página Importar: conecta pasta, verifica arquivos, importa tasks e incidents (genérico)
*/
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui || (TRJ.ui = {});
  var FS = TRJ.files || (TRJ.files = {});
  // Garantir compatibilidade retroativa com F
  if (!window.F) {
    if (TRJ.files && Object.keys(TRJ.files).length) {
      window.F = TRJ.files;
    } else {
      window.F = {};
    }
  }
  var F = window.F; // alias seguro
  // Sincroniza FS e F referências se possível
  if (!FS || !Object.keys(FS).length) {
    FS = TRJ.files = TRJ.files || F || {};
  } else {
    // se FS existe, garantir que window.F aponte para ela
    window.F = window.F || FS;
  }

  var G = TRJ.genesis || {};
  var Comp = TRJ.compute || {};

  // Util helpers
  function el(tag, props, children) {
    var e = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      if (k === 'class') e.className = props[k];
      else if (k === 'html') e.innerHTML = props[k];
      else if (k === 'text') e.textContent = props[k];
      else if (k.startsWith('on') && typeof props[k] === 'function') e.addEventListener(k.slice(2), props[k]);
      else e.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c); });
    return e;
  }
  function toast(msg, type) { if (U && typeof U.toast === 'function') U.toast(msg, type || 'info'); else console.info('toast:', msg); }
  function fmtName(h) { try { return h && (h.name || h.handleName || 'Pasta'); } catch (e) { return 'Pasta'; } }

  // Generic row -> task mapper (heurística)
  function mapRowToTask(row) {
    if (!row) return {};
    if (typeof row === 'string') return { descricao: row, _raw: row };

    function normalizeKey(k) {
      return (k || '').toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // remove acentos
        .replace(/\s+/g,' ')
        .replace(/[:\-\/\\]+/g,' ')
        .toLowerCase().trim();
    }

    var norm = {};
    Object.keys(row).forEach(function (k) { norm[normalizeKey(k)] = row[k]; });

    var t = {};
    t.enderecoId = norm['end_id'] || norm['end id'] || norm['endereco'] || norm['endereco end_id'] || norm['endereco id'] || null;
    t.siteId = norm['ne id'] || norm['neid'] || norm['ne'] || norm['site'] || norm['site id'] || null;
    t.status = norm['status'] || norm['situacao'] || norm['estado'] || null;
    t.cidade = norm['cidade'] || norm['cidade/uf'] || norm['cidade uf'] || null;
    t.prioridade = norm['prioridade'] || norm['priorizacao'] || norm['priorizacao'] || norm['priorizaçao'] || null;

    var possibleDateKeys = ['data de criacao','data criacao','criacao','data','data/hora','data hora','data de abertura','abertura'];
    var possibleVencKeys = ['data de vencimento','vencimento','prazo','data vencimento'];
    var findFirst = function (keys) { return keys.reduce(function (acc,k){ return acc || norm[k] || null; }, null); };
    var dc = findFirst(possibleDateKeys);
    var dv = findFirst(possibleVencKeys);
    try { t.dataCriacao = dc ? (new Date(dc)).toISOString() : null; } catch(e){ t.dataCriacao = dc || null; }
    try { t.dataVencimento = dv ? (new Date(dv)).toISOString() : null; } catch(e){ t.dataVencimento = dv || null; }

    t.observacao = norm['observacao'] || norm['observacao / motivo'] || norm['motivo'] || norm['titulo'] || norm['descricao'] || null;
    t._raw = row;
    return t;
  }

  // Convert parsed items => tasks array (generic)
  function convertParsedItemsToTasks(parsedItems) {
    var tasks = [];
    (parsedItems || []).forEach(function (it) {
      var rows = it.rows || [];
      rows.forEach(function (r) {
        // If genesis HTML parser exists and item looks like genesis html, use it
        try {
          if (typeof r === 'string' && G && typeof G.parseGenesisHtml === 'function' && G.ehGenesisHtml && G.ehGenesisHtml(r)) {
            var parsed = G.parseGenesisHtml(r);
            if (parsed && parsed.rows) {
              parsed.rows.forEach(function (rr) { tasks.push(mapRowToTask(rr)); });
              return;
            }
          }
        } catch (ex) { /* ignore and fallback */ }

        if (typeof r === 'object') {
          tasks.push(mapRowToTask(r));
        } else if (typeof r === 'string') {
          // if line looks like CSV with semicolon or comma, try splitting
          if (/[;,\t]/.test(r)) {
            var cols = r.split(/[;,\t]/).map(function (c) { return c.trim(); }).filter(Boolean);
            if (cols.length === 1) tasks.push({ enderecoId: cols[0], _raw: r });
            else {
              var obj = {};
              cols.forEach(function (c, i) { obj['c' + i] = c; });
              tasks.push(mapRowToTask(obj));
            }
          } else {
            tasks.push({ descricao: r, _raw: r });
          }
        }
      });
    });
    return tasks;
  }

  // Render helpers for the page
  function buildHeader() {
    return el('div', { class: 'page-header' }, [
      el('h2', { text: 'Importar dados' }),
      el('p', { class: 'muted', text: 'Conecte a pasta de arquivos para o monitor automático e cole os Sites Fora abaixo.' })
    ]);
  }

  function buildFolderCard(state) {
    var card = el('div', { class: 'trj-card p-4 mb-4' });
    var title = el('div', { html: '<b>Pasta de verificação</b><div class="text-xs" style="color:var(--trj-muted)">Conecte a pasta que contém os arquivos a serem processados.</div>' });
    var btnConnect = el('button', { class: 'trj-btn trj-btn-primary', text: state.connected ? 'Re-conectar pasta' : 'Conectar pasta' });
    btnConnect.addEventListener('click', async function () {
      try {
        // prefere FS.connectFolder se existir (encapsula showDirectoryPicker), senão tenta fallback global
        if (FS && typeof FS.connectFolder === 'function') {
          await FS.connectFolder();
        } else if (window.TRJ && TRJ.importModule && typeof TRJ.importModule.connectFolderByUserGesture === 'function') {
          await TRJ.importModule.connectFolderByUserGesture();
        } else if (typeof window.showDirectoryPicker === 'function') {
          // minimal fallback: showDirectoryPicker diretamente (exige user gesture)
          var handle = await window.showDirectoryPicker();
          if (handle) {
            // algumas implementações podem permitir persistência, chamar requestPermission se disponível
            try { if (handle.requestPermission) await handle.requestPermission({ mode: 'read' }); } catch (e) { /* ignore */ }
            // tentar atribuir ao FS
            if (!FS) FS = TRJ.files = TRJ.files || {};
            FS._folderHandle = handle;
            if (typeof FS.persistFolderHandle === 'function') await FS.persistFolderHandle(handle);
          }
        } else {
          throw new Error('API de conexão de pasta não disponível. Atualize o navegador ou conecte a pasta manualmente.');
        }
        toast('Pasta conectada: ' + (FS._folderHandle && FS._folderHandle.name ? FS._folderHandle.name : 'Pasta'));
        renderImportPage(containerEl);
      } catch (e) {
        toast(e && e.message ? e.message : 'Erro ao conectar pasta', 'err');
        console.warn(e);
      }
    });

    var btnVerify = el('button', { class: 'trj-btn', text: 'Verificar agora' });
    btnVerify.addEventListener('click', async function () {
      try {
        var scanResult;
        if (FS && typeof FS.scanFolderOnce === 'function') {
          scanResult = await FS.scanFolderOnce();
        } else if (TRJ.importModule && typeof TRJ.importModule.scanFolderOnce === 'function') {
          scanResult = await TRJ.importModule.scanFolderOnce();
        } else {
          throw new Error('scanFolderOnce não disponível (implementação de arquivos ausente).');
        }
        // scanResult pode ser um array (compat) ou { results, signature }
        var items = Array.isArray(scanResult) ? scanResult : (scanResult && scanResult.results ? scanResult.results : []);
        // convert and set tasks
        var tasks = convertParsedItemsToTasks(items);
        if (FS && typeof FS.setTasks === 'function') FS.setTasks(tasks);
        else if (TRJ.files && typeof TRJ.files.setTasks === 'function') TRJ.files.setTasks(tasks);
        toast('Pasta verificada. Itens lidos: ' + (items.length || 0) + '. Tasks: ' + tasks.length, 'ok');
        if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh();
      } catch (e) {
        toast(e && e.message ? e.message : 'Erro ao escanear pasta', 'err');
        console.warn(e);
      }
    });

    var btnToggleMonitor = el('button', { class: 'trj-btn', text: FS && FS._monitorTimer ? 'Parar monitor' : 'Iniciar monitor' });
    btnToggleMonitor.addEventListener('click', function () {
      try {
        if (FS && FS._monitorTimer) {
          if (typeof FS.stopAutoMonitor === 'function') FS.stopAutoMonitor();
          else if (typeof FS._stopAutoMonitor === 'function') FS._stopAutoMonitor();
          btnToggleMonitor.textContent = 'Iniciar monitor';
          toast('Monitor pausado', 'info');
        } else {
          // start monitor with callback
          var cb = function (items) {
            try {
              var tasks = convertParsedItemsToTasks(items);
              if (FS && typeof FS.setTasks === 'function') FS.setTasks(tasks);
              toast('Monitor: arquivos processados. Tasks: ' + tasks.length, 'ok');
              if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh();
            } catch (e) { console.warn(e); }
          };
          if (FS && typeof FS.startAutoMonitor === 'function') FS.startAutoMonitor(cb);
          else if (TRJ.files && typeof TRJ.files.startAutoMonitor === 'function') TRJ.files.startAutoMonitor(cb);
          else throw new Error('startAutoMonitor não implementado.');
          btnToggleMonitor.textContent = 'Parar monitor';
          toast('Monitor iniciado', 'ok');
        }
      } catch (e) {
        toast('Erro ao alternar monitor: ' + (e && e.message ? e.message : e), 'err');
        console.warn(e);
      }
    });

    var disconnect = el('button', { class: 'trj-btn trj-btn-ghost', text: 'Desconectar' });
    disconnect.addEventListener('click', async function () {
      try {
        if (FS && typeof FS.disconnectFolder === 'function') await FS.disconnectFolder();
        else {
          // fallback: remove handle if persisted
          if (FS && typeof FS.removeSavedFolderHandle === 'function') await FS.removeSavedFolderHandle();
          FS._folderHandle = null;
        }
        toast('Pasta desconectada', 'ok');
        renderImportPage(containerEl);
      } catch (e) { toast('Erro ao desconectar', 'err'); console.warn(e); }
    });

    var nameEl = el('div', { class: 'mt-3' }, [
      el('div', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: state.connected ? ('Conectada: ' + (FS._folderHandle && (FS._folderHandle.name || FS._folderHandle.handleName) ? (FS._folderHandle.name || FS._folderHandle.handleName) : 'Pasta')) : 'Nenhuma pasta conectada' })
    ]);

    var actions = el('div', { class: 'flex items-center gap-2' }, [btnConnect, btnVerify, btnToggleMonitor, disconnect]);

    card.appendChild(title);
    card.appendChild(actions);
    card.appendChild(nameEl);
    return card;
  }

  function buildDetectedFilesBox(files) {
    var box = el('div', { class: 'trj-card p-4 mb-4' });
    box.appendChild(el('h3', { class: 'font-semibold mb-2', text: 'Arquivos detectados' }));
    if (!files || files.length === 0) {
      box.appendChild(el('div', { class: 'text-sm', style: { color: 'var(--trj-muted)' }, text: 'Nenhum arquivo lido ainda.' }));
      return box;
    }
    var list = el('ul', {});
    files.forEach(function (f) {
      list.appendChild(el('li', { text: (f._source || f.name || 'arquivo') + ' — rows: ' + (Array.isArray(f.rows) ? f.rows.length : 0) }));
    });
    box.appendChild(list);
    return box;
  }

  // Incidents area
  function buildIncidentsBox() {
    var card = el('div', { class: 'trj-card p-4' });
    card.appendChild(el('h3', { class: 'font-semibold mb-2', text: 'Sites Fora — NE IDs' }));
    card.appendChild(el('p', { class: 'text-sm mb-2', style: { color: 'var(--trj-muted)' }, text: 'Cole o texto do painel ou a lista de NE IDs. Clique em Detectar NE IDs.' }));
    var ta = el('textarea', { id: 'trj-inc-text', style: { width: '100%', height: '160px', fontFamily: 'monospace' } });
    card.appendChild(ta);
    var btnDetect = el('button', { class: 'trj-btn trj-btn-primary', text: 'Detectar NE IDs' });
    var btnClear = el('button', { class: 'trj-btn', text: 'Limpar' });
    var containerIds = el('div', { id: 'trj-detected-ids', class: 'mt-4' });
    btnDetect.addEventListener('click', function () {
      var txt = ta.value || '';
      var ids = detectNeIdsFromText(txt);
      renderDetectedIds(ids, containerIds);
    });
    btnClear.addEventListener('click', function () { ta.value = ''; renderDetectedIds([], containerIds); });
    card.appendChild(el('div', { class: 'flex items-center gap-2 mt-3' }, [btnDetect, btnClear]));
    card.appendChild(containerIds);
    return card;
  }

  function detectNeIdsFromText(text) {
    if (!text) return [];
    var tokens = text.split(/[^A-Za-z0-9_\-]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var set = {};
    tokens.forEach(function (t) {
      var v = t.toUpperCase();
      if (v.length >= 3) set[v] = true;
    });
    return Object.keys(set);
  }

  function renderDetectedIds(arr, host) {
    host.innerHTML = '';
    if (!arr || !arr.length) {
      host.appendChild(el('div', { class: 'text-sm', style: { color: 'var(--trj-muted)' }, text: 'NE IDs detectados: (nenhum)' }));
      return;
    }
    var wrap = el('div', { class: 'flex flex-wrap gap-2' });
    arr.forEach(function (id) {
      var badge = el('span', { class: 'tag', text: id });
      wrap.appendChild(badge);
    });
    var importBtn = el('button', { class: 'trj-btn trj-btn-primary mt-3', text: 'Importar incidentes detectados' });
    importBtn.addEventListener('click', function () {
      var incs = arr.map(function (id) { return { site: id, enderecoId: null, statusTrat: 'FORA', fila: null, inicio: null, observacao: 'Importado via texto' }; });
      if (FS && typeof FS.setIncidents === 'function') FS.setIncidents(incs);
      else if (TRJ && TRJ.api && typeof TRJ.api.importIncidentes === 'function') TRJ.api.importIncidentes(incs);
      else {
        // fallback: localStorage
        var key = 'trj_import_incidentes_' + Date.now();
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), rows: incs }));
      }
      toast('Incidentes importados: ' + incs.length, 'ok');
      if (TRJ.app && typeof TRJ.app.reloadIncidents === 'function') TRJ.app.reloadIncidents();
    });
    host.appendChild(wrap);
    host.appendChild(importBtn);
  }

  // main render
  var containerEl = null;
  TRJ.pages.importar = function (container, ctx) {
    containerEl = container;
    container.innerHTML = '';
    container.appendChild(buildHeader());

    var connected = !!(FS && (FS._folderHandle || FS.folderHandle));
    container.appendChild(buildFolderCard({ connected: connected }));

    // show previously scanned items if any (from FS._lastScannedItems or F._lastScannedItems)
    var prev = (FS && FS._lastScannedItems) || (F && F._lastScannedItems) || [];
    var filesBox = buildDetectedFilesBox(prev);
    container.appendChild(filesBox);

    container.appendChild(buildIncidentsBox());

    // Listen to folderChanged to update UI and process automatically
    document.removeEventListener('trj:folderChanged.importar', onFolderChanged);
    document.addEventListener('trj:folderChanged.importar', onFolderChanged);

    // Also update when tasks/incidents loaded
    document.removeEventListener('trj:tasksLoaded.importar', onTasksLoaded);
    document.addEventListener('trj:tasksLoaded.importar', onTasksLoaded);
    document.removeEventListener('trj:incidentsLoaded.importar', onIncidentsLoaded);
    document.addEventListener('trj:incidentsLoaded.importar', onIncidentsLoaded);
  };

  async function onFolderChanged(e) {
    var items = [];
    try {
      if (e && e.detail) {
        // support both array detail and {items}
        items = Array.isArray(e.detail) ? e.detail : (Array.isArray(e.detail.items) ? e.detail.items : (e.detail.results || []));
      }
    } catch (err) { items = []; }

    // save last scanned items for UI
    if (FS) FS._lastScannedItems = items;
    if (F) F._lastScannedItems = items;

    // convert and set tasks automatically
    try {
      var tasks = convertParsedItemsToTasks(items);
      if (FS && typeof FS.setTasks === 'function') FS.setTasks(tasks);
      else if (TRJ && TRJ.files && typeof TRJ.files.setTasks === 'function') TRJ.files.setTasks(tasks);
      toast('Arquivos processados automaticamente. Tasks: ' + tasks.length, 'ok');
      if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh();
    } catch (err) {
      console.warn('Erro processando items:', err);
    }
    // re-render page to show files list
    if (containerEl) renderImportPage(containerEl);
  }

  function onTasksLoaded(e) {
    // optional: reflect counts or enable navigation if app expects tasks
    // re-render to reflect persisted tasks if needed
  }
  function onIncidentsLoaded(e) {
    // optional
  }

  // helper to re-render file list quickly
  function renderImportPage(container) {
    if (!container) return;
    TRJ.pages.importar(container, {});
  }

  // Expose helper for debug / manual scan
  TRJ.pages.importar_helpers = {
    convertParsedItemsToTasks: convertParsedItemsToTasks,
    mapRowToTask: mapRowToTask
  };

  // Try to load saved folder handle so UI shows state quickly
  (async function initTryLoad() {
    try {
      if (FS && typeof FS.loadSavedFolderSafe === 'function') {
        await FS.loadSavedFolderSafe();
      } else if (FS && typeof FS.loadSavedFolder === 'function') {
        await FS.loadSavedFolder();
      } else if (TRJ.importModule && typeof TRJ.importModule.loadSavedFolderSafe === 'function') {
        await TRJ.importModule.loadSavedFolderSafe();
      }
    } catch (e) { console.warn('initTryLoad fail', e); }
    // render if this page is active
    if (containerEl) renderImportPage(containerEl);
  })();

})(window.TRJ = window.TRJ || {});
