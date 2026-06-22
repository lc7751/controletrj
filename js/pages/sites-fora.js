// sites-fora.js - módulo antigo mantido como fallback, agora com import + compute compatível
(function () {
  window.TRJ = window.TRJ || {};
  window.TRJ.sitesFora = window.TRJ.sitesFora || {};
  var S = window.TRJ.sitesFora;
  var FS = window.TRJ.files || (window.TRJ.files = {});
  var IMPORT_HELPERS = (window.TRJ.pages && window.TRJ.pages.importar_helpers) || null;

  // Helper: tenta executar pipeline de compute (TRJ.compute.enrichTasks) se existir
  function triggerComputeAndRefresh(tasks) {
    try {
      var resolved = tasks || [];
      if (window.TRJ && TRJ.compute && typeof TRJ.compute.enrichTasks === 'function') {
        try {
          var r = TRJ.compute.enrichTasks(tasks);
          if (r && typeof r.then === 'function') {
            r.then(function (enriched) {
              resolved = enriched || tasks || [];
              try {
                if (FS && typeof FS.setTasks === 'function') FS.setTasks(resolved);
                else if (TRJ.files && typeof TRJ.files.setTasks === 'function') TRJ.files.setTasks(resolved);
                console.log('sites-fora: enrichTasks resolved, tasks set:', (resolved && resolved.length) || 0);
              } catch (setErr) { console.warn('sites-fora setTasks failed', setErr); }
              try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (refreshErr) { console.warn('sites-fora refresh failed', refreshErr); }
            }).catch(function (err) {
              console.warn('sites-fora: enrichTasks promise failed', err);
              try {
                if (FS && typeof FS.setTasks === 'function') FS.setTasks(tasks);
                else if (TRJ.files && typeof TRJ.files.setTasks === 'function') TRJ.files.setTasks(tasks);
              } catch (_) {}
              try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (_) {}
            });
            return;
          } else {
            resolved = r || tasks || [];
          }
        } catch (e) { console.warn('sites-fora: error running enrichTasks', e); }
      }
      // fallback sync
      try {
        if (FS && typeof FS.setTasks === 'function') FS.setTasks(resolved);
        else if (TRJ.files && typeof TRJ.files.setTasks === 'function') TRJ.files.setTasks(resolved);
        console.log('sites-fora: tasks set (sync):', (resolved && resolved.length) || 0);
      } catch (setErr) { console.warn('sites-fora setTasks failed', setErr); }
      try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (refreshErr) { console.warn('sites-fora refresh failed', refreshErr); }
    } catch (e) { console.warn('sites-fora triggerComputeAndRefresh unexpected', e); try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (_) {} }
  }

  // Simple parser for FileSystemFileHandle (or file-like objects) if no IMPORT helpers present
  async function parseHandleToRowsFallback(handle) {
    if (!handle) return { name: '', rows: [] };
    // if it's already a parsed object
    if (handle.rows && Array.isArray(handle.rows)) return handle;
    // if it's a File object
    try {
      var file = (typeof handle.getFile === 'function') ? await handle.getFile() : (handle instanceof File ? handle : null);
      if (!file) return { name: handle.name || '', rows: [] };
      var name = file.name || '';
      var ext = (name.split('.').pop() || '').toLowerCase();
      if (window.XLSX && ['xlsx','xls','xlsm'].includes(ext)) {
        var ab = await file.arrayBuffer();
        var wb = XLSX.read(ab, { type: 'array' });
        var sheetName = wb.SheetNames && wb.SheetNames[0];
        var sheet = sheetName ? wb.Sheets[sheetName] : null;
        var rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false }) : [];
        var rowsFiltered = (rows || []).filter(function(r){ return Array.isArray(r) ? r.some(function(c){ return c !== null && c !== undefined && (''+c).trim() !== ''; }) : !!r; });
        return { name: name, rows: rowsFiltered || [], sheetName: sheetName || '' };
      } else {
        var text = await file.text();
        var lines = text.split(/\r?\n/).filter(function(l){ return l && l.trim() !== ''; });
        var rows = lines.map(function (line) {
          if (line.indexOf(';') >= 0) return line.split(';').map(function(c){ return c.trim(); });
          if (line.indexOf(',') >= 0) return line.split(',').map(function(c){ return c.trim(); });
          return line.split(/\t/).map(function(c){ return c.trim(); });
        });
        return { name: name, rows: rows };
      }
    } catch (e) {
      console.warn('sites-fora parse fallback failed', e);
      return { name: handle.name || '', rows: [] };
    }
  }

  // convert parsed items -> tasks using import helpers if available, else a simple mapping
  function convertParsedItemsToTasksFallback(parsedItems) {
    if (IMPORT_HELPERS && typeof IMPORT_HELPERS.convertParsedItemsToTasks === 'function') {
      return IMPORT_HELPERS.convertParsedItemsToTasks(parsedItems);
    }
    // simple mapping: each row => object with siteId or enderecoId
    var tasks = [];
    (parsedItems || []).forEach(function (it) {
      var rows = it.rows || [];
      rows.forEach(function (r, ri) {
        if (Array.isArray(r)) {
          // attempt header
          var header = (it.rows && it.rows[0] && Array.isArray(it.rows[0])) ? it.rows[0] : null;
          if (header && ri > 0) {
            var obj = {};
            header.forEach(function (h, hi) { obj[(h||'c'+hi)] = r[hi]; });
            tasks.push({ _raw: obj, siteId: obj.site || obj['SITE'] || obj.Site || null });
          } else {
            var obj2 = {};
            r.forEach(function (c, ci) { obj2['c' + ci] = c; });
            tasks.push({ _raw: obj2 });
          }
        } else if (typeof r === 'object' && r !== null) {
          tasks.push({ _raw: r, siteId: r.site || r.SITE || r.Site || r.ne || r.NE || null });
        } else if (typeof r === 'string') {
          // try extract token
          var token = (r.match(/[A-Za-z0-9\-_]{3,}/) || [null])[0];
          tasks.push({ _raw: r, siteId: token });
        }
      });
    });
    return tasks;
  }

  // Public import function: accepts
  // - fallbackJson: if array of tasks => directly set
  // - OR array of file handles (FileSystemFileHandle or File)
  // - OR a single handle
  async function importFromFile(fallbackJsonOrHandles) {
    try {
      // if it's already a tasks array (detected by objects with siteId/enderecoId or _raw)
      if (Array.isArray(fallbackJsonOrHandles) && fallbackJsonOrHandles.length && typeof fallbackJsonOrHandles[0] === 'object' && (fallbackJsonOrHandles[0].site || fallbackJsonOrHandles[0].siteId || fallbackJsonOrHandles[0]._raw)) {
        // assume tasks provided
        triggerComputeAndRefresh(fallbackJsonOrHandles);
        document.dispatchEvent(new CustomEvent('trj:tasksLoaded.sitesFora', { detail: fallbackJsonOrHandles }));
        return;
      }

      var inputs = [];
      if (!fallbackJsonOrHandles) {
        console.warn('sites-fora.importFromFile called with no input.');
        alert('Nenhum arquivo/entrada fornecida.');
        return;
      } else if (Array.isArray(fallbackJsonOrHandles)) {
        inputs = fallbackJsonOrHandles.slice();
      } else {
        inputs = [fallbackJsonOrHandles];
      }

      // Try using importer helpers to parse handles first if available
      var parsedItems = [];
      for (var i = 0; i < inputs.length; i++) {
        var h = inputs[i];
        var parsed = null;
        try {
          if (IMPORT_HELPERS && typeof IMPORT_HELPERS.parseHandleToRows === 'function' && h && typeof h.getFile === 'function') {
            parsed = await IMPORT_HELPERS.parseHandleToRows(h);
          } else {
            parsed = await parseHandleToRowsFallback(h);
          }
        } catch (e) {
          console.warn('sites-fora: parse failed for input', h, e);
          parsed = await parseHandleToRowsFallback(h);
        }
        parsedItems.push(parsed);
      }

      // convert parsed -> tasks
      var tasks = [];
      try {
        if (IMPORT_HELPERS && typeof IMPORT_HELPERS.convertParsedItemsToTasks === 'function') {
          tasks = IMPORT_HELPERS.convertParsedItemsToTasks(parsedItems);
        } else {
          tasks = convertParsedItemsToTasksFallback(parsedItems);
        }
      } catch (e) {
        console.warn('sites-fora: convertParsedItemsToTasks failed', e);
        tasks = convertParsedItemsToTasksFallback(parsedItems);
      }

      // dispatch raw folderChanged (compat)
      document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { items: parsedItems } }));
      document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: parsedItems }));

      // use compute pipeline if available, then persist tasks
      triggerComputeAndRefresh(tasks);

      // dispatch tasks events
      document.dispatchEvent(new CustomEvent('trj:tasksLoaded', { detail: tasks }));
      document.dispatchEvent(new CustomEvent('trj:tasksLoaded.sitesFora', { detail: tasks }));

      toast('Import (sites-fora) concluído. Tasks: ' + (tasks && tasks.length ? tasks.length : 0));
    } catch (err) {
      console.error('sites-fora.importFromFile erro', err);
      alert('Erro ao importar (ver console).');
    }
  }

  // small toast helper (uses TRJ.ui if present)
  function toast(msg, type) {
    if (window.TRJ && TRJ.ui && typeof TRJ.ui.toast === 'function') TRJ.ui.toast(msg, type || 'info');
    else console.info('toast:', msg);
  }

  // export
  S.importFromFile = importFromFile;

})();
