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

  // ---------- Helper: executar pipeline de compute e forçar refresh ----------
  // Suporta enrichTasks síncrono ou async (Promise). Faz setTasks via FS.setTasks / TRJ.files.setTasks
  function triggerComputeAndRefresh(tasks) {
    try {
      var resolved = tasks || [];
      if (TRJ && TRJ.compute && typeof TRJ.compute.enrichTasks === 'function') {
        try {
          var r = TRJ.compute.enrichTasks(tasks);
          if (r && typeof r.then === 'function') {
            // async
            r.then(function (enriched) {
              resolved = enriched || tasks || [];
              try {
                if (FS && typeof FS.setTasks === 'function') FS.setTasks(resolved);
                else if (TRJ.files && typeof TRJ.files.setTasks === 'function') TRJ.files.setTasks(resolved);
                console.log('triggerComputeAndRefresh: enrichTasks resolved, tasks set:', (resolved && resolved.length) || 0);
              } catch (setErr) { console.warn('triggerComputeAndRefresh setTasks failed', setErr); }
              try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (refreshErr) { console.warn('triggerComputeAndRefresh refresh failed', refreshErr); }
            }).catch(function (err) {
              console.warn('triggerComputeAndRefresh: enrichTasks promise failed', err);
              // fallback: still set original tasks and refresh
              try {
                if (FS && typeof FS.setTasks === 'function') FS.setTasks(tasks);
                else if (TRJ.files && typeof TRJ.files.setTasks === 'function') TRJ.files.setTasks(tasks);
              } catch (setErr) { console.warn('triggerComputeAndRefresh fallback setTasks failed', setErr); }
              try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (refreshErr) { console.warn('triggerComputeAndRefresh fallback refresh failed', refreshErr); }
            });
            return;
          } else {
            // sync
            resolved = r || tasks || [];
          }
        } catch (e) {
          console.warn('triggerComputeAndRefresh: error running enrichTasks', e);
        }
      }
      // setar tasks (fallback normal) e refresh
      try {
        if (FS && typeof FS.setTasks === 'function') FS.setTasks(resolved);
        else if (TRJ.files && typeof TRJ.files.setTasks === 'function') TRJ.files.setTasks(resolved);
        console.log('triggerComputeAndRefresh: tasks set (sync):', (resolved && resolved.length) || 0);
      } catch (setErr) { console.warn('triggerComputeAndRefresh setTasks failed', setErr); }
      try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (refreshErr) { console.warn('triggerComputeAndRefresh refresh failed', refreshErr); }
    } catch (e) {
      console.warn('triggerComputeAndRefresh erro inesperado', e);
      try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (_) {}
    }
  }

  // ---------- Novos helpers: parse / enrich ----------
  async function parseHandleToRows(handle) {
    if (!handle || typeof handle.getFile !== 'function') {
      throw new Error('Handle de arquivo inválido.');
    }
    const file = await handle.getFile();
    const name = (file && file.name) || '';
    const ext = name.split('.').pop().toLowerCase();

    // XLSX / XLS / XLSM (SheetJS)
    if (window.XLSX && ['xlsx', 'xls', 'xlsm'].includes(ext)) {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const sheetName = wb.SheetNames && wb.SheetNames[0];
      const sheet = sheetName ? wb.Sheets[sheetName] : null;
      const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false }) : [];
      // normalize: remove trailing empty rows
      const rowsFiltered = (rows || []).filter(function(r){ return Array.isArray(r) ? r.some(function(c){ return c !== null && c !== undefined && (''+c).trim() !== ''; }) : !!r; });
      return {
        name,
        sheetName: sheetName || '',
        rows: rowsFiltered || [],
        rowCount: Math.max((rowsFiltered || []).length - 1, 0)
      };
    }

    // CSV / TXT fallback
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(function(l){ return l && l.trim() !== ''; });
    const rows = lines.map(function (line) {
      // try semicolon, then comma, then tab
      if (line.indexOf(';') >= 0) return line.split(';').map(function(c){ return c.trim(); });
      if (line.indexOf(',') >= 0) return line.split(',').map(function(c){ return c.trim(); });
      return line.split(/\t/).map(function(c){ return c.trim(); });
    });
    return {
      name,
      sheetName: '',
      rows,
      rowCount: Math.max(rows.length - 1, 0)
    };
  }

  async function enrichScannedItems(items) {
    var out = [];
    for (var i = 0; i < (items || []).length; i++) {
      var item = items[i];
      var handle = item && (item.handle || item.file || item);
      try {
        var parsed = await parseHandleToRows(handle);
        out.push({
          name: parsed.name,
          handle: handle,
          rows: parsed.rows,
          rowCount: parsed.rowCount,
          sheetName: parsed.sheetName,
          _source: item.name || parsed.name || 'arquivo'
        });
      } catch (e) {
        console.warn('Falha parseando arquivo:', item && item.name, e);
        // fallback: manter o item original sem rows
        out.push(Object.assign({}, item, { rows: item.rows || [], rowCount: (item.rows && item.rows.length) || 0, _source: item.name || 'arquivo' }));
      }
    }
    return out;
  }

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
      // rows may be arrays (sheet_to_json header:1) or objects (if parser returned objects)
      rows.forEach(function (r, ri) {
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

        // If row is an array (header row present), try map array to header object
        if (Array.isArray(r)) {
          // attempt to use the header if available (first row)
          var header = (it.rows && it.rows[0] && Array.isArray(it.rows[0])) ? it.rows[0] : null;
          if (header && ri > 0) {
            var obj = {};
            header.forEach(function (h, hi) { obj[h || ('c' + hi)] = r[hi]; });
            tasks.push(mapRowToTask(obj));
            return;
          } else if (!header) {
            // no header: map c0..cN
            var obj2 = {};
            r.forEach(function (c, ci) { obj2['c' + ci] = c; });
            tasks.push(mapRowToTask(obj2));
            return;
          } else {
            // header exists but this is header row -> skip
            return;
          }
        }

        if (typeof r === 'object' && r !== null) {
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
            FS.folderHandle = handle; // manter ambos
            if (typeof FS.persistFolderHandle === 'function') await FS.persistFolderHandle(handle);
          }
        } else {
          throw new Error('API de conexão de pasta não disponível. Atualize o navegador ou conecte a pasta manualmente.');
        }
        toast('Pasta conectada: ' + (FS._folderHandle && FS._folderHandle.name ? FS._folderHandle.name : 'Pasta'));
        // notificar globalmente que pasta foi conectada
        document.dispatchEvent(new CustomEvent('trj:folderConnected.importar', { detail: { handle: FS._folderHandle } }));
        // re-render page
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
        var itemsRaw = Array.isArray(scanResult) ? scanResult : (scanResult && scanResult.results ? scanResult.results : []);
        // enriquecer (ler conteúdo dos arquivos)
        var items = await enrichScannedItems(itemsRaw);

        // save last scanned items for UI
        if (FS) FS._lastScannedItems = items;
        if (F) F._lastScannedItems = items;

        // atualizar visual da lista detectada
        renderImportPage(containerEl);

        // convert and set tasks (já com rows)
        var tasks = convertParsedItemsToTasks(items);

        // notify raw items first (compat)
        document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: items }));

        // executa pipeline de compute / normalização e força refresh da app
        triggerComputeAndRefresh(tasks);

        // e disparamos também o evento tasksLoaded com as tasks originais (ouvidas por páginas que só escutam eventos)
        document.dispatchEvent(new CustomEvent('trj:tasksLoaded.importar', { detail: tasks }));
        document.dispatchEvent(new CustomEvent('trj:tasksLoaded', { detail: tasks }));

        toast('Pasta verificada. Itens lidos: ' + (items.length || 0) + '. Tasks: ' + tasks.length, 'ok');
        // prefer TRJ.app, fallback para window.App
        var appRef = (TRJ && TRJ.app) || window.App || null;
        if (appRef && typeof appRef.refresh === 'function') appRef.refresh();
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
          else if (FS._monitorTimer) { clearInterval(FS._monitorTimer); FS._monitorTimer = null; }
          btnToggleMonitor.textContent = 'Iniciar monitor';
          // notify
          document.dispatchEvent(new CustomEvent('trj:monitorStopped.importar', { detail: {} }));
          toast('Monitor pausado', 'info');
        } else {
          // start monitor with callback
          var cb = async function (itemsRaw) {
            try {
              var items = await enrichScannedItems(itemsRaw);
              // persist last scanned
              if (FS) FS._lastScannedItems = items;
              if (F) F._lastScannedItems = items;

              var tasks = convertParsedItemsToTasks(items);

              // notificar raw items primeiro
              document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: items }));

              // executar pipeline e refresh
              triggerComputeAndRefresh(tasks);

              // eventos adicionais (mantendo compatibilidade)
              document.dispatchEvent(new CustomEvent('trj:tasksLoaded.importar', { detail: tasks }));
              document.dispatchEvent(new CustomEvent('trj:tasksLoaded', { detail: tasks }));
              toast('Monitor: arquivos processados. Tasks: ' + tasks.length, 'ok');
              var appRef = (TRJ && TRJ.app) || window.App || null;
              if (appRef && typeof appRef.refresh === 'function') appRef.refresh();
            } catch (e) { console.warn(e); }
          };
          if (FS && typeof FS.startAutoMonitor === 'function') FS.startAutoMonitor(cb);
          else if (TRJ.files && typeof TRJ.files.startAutoMonitor === 'function') TRJ.files.startAutoMonitor(cb);
          else throw new Error('startAutoMonitor não implementado.');
          btnToggleMonitor.textContent = 'Parar monitor';
          document.dispatchEvent(new CustomEvent('trj:monitorStarted.importar', { detail: {} }));
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
          FS.folderHandle = null;
        }
        toast('Pasta desconectada', 'ok');
        document.dispatchEvent(new CustomEvent('trj:folderDisconnected.importar', { detail: {} }));
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
      // dispatch events so app/pages know incidents updated
      document.dispatchEvent(new CustomEvent('trj:incidentsLoaded.importar', { detail: incs }));
      document.dispatchEvent(new CustomEvent('trj:incidentsLoaded', { detail: incs }));
      toast('Incidentes importados: ' + incs.length, 'ok');
      var appRef = (TRJ && TRJ.app) || window.App || null;
      if (appRef && typeof appRef.reloadIncidents === 'function') appRef.reloadIncidents();
      else if (appRef && typeof appRef.refresh === 'function') appRef.refresh();
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

    // If items exist but have no rows, enrich them (read file contents)
    try {
      var needsEnrich = items && items.length && !items[0].rows;
      if (needsEnrich) {
        items = await enrichScannedItems(items);
      }
    } catch (err) { console.warn('Erro enriquecendo items no onFolderChanged', err); }

    // save last scanned items for UI
    if (FS) FS._lastScannedItems = items;
    if (F) F._lastScannedItems = items;

    // convert and set tasks automatically
    try {
      var tasks = convertParsedItemsToTasks(items);

      // notificar raw items
      document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: items }));

      // processa via compute e atualiza UI
      triggerComputeAndRefresh(tasks);

      // eventos compatíveis
      document.dispatchEvent(new CustomEvent('trj:tasksLoaded.importar', { detail: tasks }));
      document.dispatchEvent(new CustomEvent('trj:tasksLoaded', { detail: tasks }));

      toast('Arquivos processados automaticamente. Tasks: ' + tasks.length, 'ok');
      var appRef = (TRJ && TRJ.app) || window.App || null;
      if (appRef && typeof appRef.refresh === 'function') appRef.refresh();
    } catch (err) {
      console.warn('Erro processando items:', err);
    }
    // re-render page to show files list
    if (containerEl) renderImportPage(containerEl);
  }

  function onTasksLoaded(e) {
    // optional: reflect counts or enable navigation if app expects tasks
    // re-render to reflect persisted tasks if needed
    try { if (containerEl) renderImportPage(containerEl); } catch (_) {}
  }
  function onIncidentsLoaded(e) {
    try { if (containerEl) renderImportPage(containerEl); } catch (_) {}
  }

  // helper to re-render file list quickly
  function renderImportPage(container) {
    if (!container) return;
    TRJ.pages.importar(container, {});
  }

  // Expose helper for debug / manual scan
  TRJ.pages.importar_helpers = {
    convertParsedItemsToTasks: convertParsedItemsToTasks,
    mapRowToTask: mapRowToTask,
    enrichScannedItems: enrichScannedItems,
    parseHandleToRows: parseHandleToRows
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
