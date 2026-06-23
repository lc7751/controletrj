// sites-fora.js - módulo atualizado: fallback import (arquivo) + import por texto (incidentes)
// Mantém compatibilidade com import helpers e TRJ.compute para pipeline de tasks,
// e adiciona importFromText para incidents (integração com TRJ.files.setIncidents / TRJ.api.importIncidentes)
(function () {
  window.TRJ = window.TRJ || {};
  window.TRJ.sitesFora = window.TRJ.sitesFora || {};
  var S = window.TRJ.sitesFora || {};
  var FS = window.TRJ.files || (window.TRJ.files = {});
  var IMPORT_HELPERS = (window.TRJ.pages && window.TRJ.pages.importar_helpers) || null;

  // --- Helpers básicos ---
  function log() { try { console.info.apply(console, ['[sites-fora]'].concat(Array.prototype.slice.call(arguments))); } catch (_) {} }
  function warn() { try { console.warn.apply(console, ['[sites-fora]'].concat(Array.prototype.slice.call(arguments))); } catch (_) {} }
  function err() { try { console.error.apply(console, ['[sites-fora]'].concat(Array.prototype.slice.call(arguments))); } catch (_) {} }
  function toast(msg, type) {
    if (window.TRJ && TRJ.ui && typeof TRJ.ui.toast === 'function') TRJ.ui.toast(msg, type || 'info');
    else console.info('[toast]', msg, type || '');
  }

  // --- parsers (reaproveitáveis) ---
  // parseTextToRows: aceita texto CSV/TSV/HTML e retorna { name, headers, rows }
  function parseTextToRows(name, text) {
    text = (text || '').toString();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    // HTML table
    if (text.trim().startsWith('<')) {
      try {
        var parser = new DOMParser();
        var doc = parser.parseFromString(text, 'text/html');
        var table = doc.querySelector('table');
        if (table) {
          var rows = Array.from(table.rows).map(function (r) { return Array.from(r.cells).map(function (c) { return (c.textContent || '').trim(); }); });
          var headers = rows.length && rows[0].length ? rows[0] : [];
          var data = headers.length ? rows.slice(1) : rows;
          return { name: name || 'text', headers: headers, rows: data };
        }
      } catch (e) { /* ignore html parse errors */ }
    }

    // simple delim detection: ; \t ,
    var lines = text.split(/\r?\n/).map(function (l) { return (l || '').trim(); }).filter(function (l) { return l !== ''; });
    if (!lines.length) return { name: name || 'text', headers: [], rows: [] };
    var sample = lines.slice(0, 5).join('\n');
    var delimiter = ',';
    if ((sample.match(/;/g) || []).length > (sample.match(/,/g) || []).length) delimiter = ';';
    else if ((sample.match(/\t/g) || []).length > 0) delimiter = '\t';
    var parsed = lines.map(function (l) { return l.split(delimiter).map(function (c) { return (c || '').trim(); }); });
    var headers = parsed[0] && parsed[0].length ? parsed[0] : [];
    var rows = parsed.slice(headers.length ? 1 : 0);
    return { name: name || 'text', headers: headers, rows: rows };
  }

  // parseHandleToRowsFallback: lê File/FileHandle (XLSX, CSV, text)
  async function parseHandleToRowsFallback(handle) {
    if (!handle) return { name: '', headers: [], rows: [] };
    if (handle.rows && Array.isArray(handle.rows)) return handle;
    try {
      var file = (handle && typeof handle.getFile === 'function') ? await handle.getFile() : (handle instanceof File ? handle : null);
      var name = (file && file.name) ? file.name : (handle && handle.name) ? handle.name : 'input';
      var ext = (name.split('.').pop() || '').toLowerCase();
      if (window.XLSX && ['xlsx','xls','xlsm'].indexOf(ext) >= 0) {
        var ab = await file.arrayBuffer();
        var wb = XLSX.read(ab, { type: 'array' });
        var sheetName = wb.SheetNames && wb.SheetNames[0];
        var sheet = sheetName ? wb.Sheets[sheetName] : null;
        var arr = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false }) : [];
        var cleaned = (arr || []).map(function (r) { return Array.isArray(r) ? r.map(function (c) { return (c === null || c === undefined) ? '' : ('' + c).trim(); }) : [r]; });
        var headers = (cleaned[0] && Array.isArray(cleaned[0])) ? cleaned[0] : [];
        var rows = headers.length ? cleaned.slice(1) : cleaned;
        return { name: name, headers: headers, rows: rows, sheetName: sheetName || '' };
      } else {
        var text = await file.text();
        return parseTextToRows(name, text);
      }
    } catch (e) {
      warn('parseHandleToRowsFallback error', e);
      return { name: (handle && handle.name) || 'input', headers: [], rows: [] };
    }
  }

  // --- Converters ---

  // converte parsedItems (array de {name, headers, rows}) em "tasks" (fallback)
  function convertParsedItemsToTasksFallback(parsedItems) {
    var tasks = [];
    (parsedItems || []).forEach(function (it) {
      var rows = it.rows || [];
      // se houver header array, usa mapeamento por header
      var header = (it.headers && Array.isArray(it.headers) && it.headers.length) ? it.headers : null;
      rows.forEach(function (r, idx) {
        if (header && Array.isArray(r)) {
          var obj = {};
          header.forEach(function (h, hi) { obj[(h || ('c' + hi))] = r[hi]; });
          tasks.push({ _raw: obj, siteId: obj.site || obj.SITE || obj.Site || obj['END_ID'] || obj.End_ID || null });
        } else if (Array.isArray(r)) {
          var obj2 = {};
          r.forEach(function (c, ci) { obj2['c' + ci] = c; });
          tasks.push({ _raw: obj2 });
        } else if (typeof r === 'object') {
          tasks.push({ _raw: r, siteId: r.site || r.SITE || r.ne || r.NE || null });
        } else {
          tasks.push({ _raw: { raw: r } });
        }
      });
    });
    return tasks;
  }

  // converte parsedItems para incidents (fallback) - mapeia campos comuns
  function convertParsedItemsToIncidentsFallback(parsedItems) {
    var incidents = [];
    (parsedItems || []).forEach(function (it) {
      var header = (it.headers && Array.isArray(it.headers) && it.headers.length) ? it.headers.map(function(h){ return (''+h).trim(); }) : null;
      (it.rows || []).forEach(function (r, idx) {
        if (header && Array.isArray(r)) {
          var obj = {};
          header.forEach(function (h, hi) { obj[h] = r[hi]; });
          incidents.push(mapRowObjToIncident(obj));
        } else if (Array.isArray(r)) {
          // guess columns: [site, motivo, inicio, fim] common pattern
          incidents.push(mapRowArrayToIncident(r));
        } else if (typeof r === 'object' && r !== null) {
          incidents.push(mapRowObjToIncident(r));
        } else {
          incidents.push({ _raw: r, importedAt: (new Date()).toISOString() });
        }
      });
    });
    return incidents;
  }

  function mapRowObjToIncident(o) {
    o = o || {};
    var lowerKeys = {};
    Object.keys(o).forEach(function(k){ lowerKeys[k.toString().toLowerCase()] = o[k]; });
    var inc = {
      _raw: o,
      site: o.SITE || o.site || o['Site'] || o['END_ID'] || o.end_id || o.endereco || lowerKeys['site'] || lowerKeys['end_id'] || lowerKeys['end id'] || null,
      motivo: o.MOTIVO || o.motivo || o.REASON || o.reason || lowerKeys['motivo'] || lowerKeys['reason'] || null,
      inicio: o.INICIO || o.inicio || o.DATA || o.data || lowerKeys['inicio'] || lowerKeys['data'] || null,
      fim: o.FIM || o.fim || o['end time'] || lowerKeys['fim'] || null,
      importedAt: (new Date()).toISOString()
    };
    return inc;
  }

  function mapRowArrayToIncident(arr) {
    // heurística: se arr[0] parece END_ID/site, arr[1] motivo, arr[2] inicio
    arr = arr || [];
    var inc = { _raw: arr, importedAt: (new Date()).toISOString() };
    if (arr.length >= 1) inc.site = arr[0];
    if (arr.length >= 2) inc.motivo = arr[1];
    if (arr.length >= 3) inc.inicio = arr[2];
    if (arr.length >= 4) inc.fim = arr[3];
    return inc;
  }

  // --- Compute trigger (mantém compatibilidade existente) ---
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
                log('enrichTasks resolved, tasks set:', (resolved && resolved.length) || 0);
              } catch (setErr) { warn('setTasks failed', setErr); }
              try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (_) {}
            }).catch(function (err) {
              warn('enrichTasks promise failed', err);
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
        } catch (e) { warn('error running enrichTasks', e); }
      }
      try {
        if (FS && typeof FS.setTasks === 'function') FS.setTasks(resolved);
        else if (TRJ.files && typeof TRJ.files.setTasks === 'function') TRJ.files.setTasks(resolved);
        log('tasks set (sync):', (resolved && resolved.length) || 0);
      } catch (setErr) { warn('setTasks failed', setErr); }
      try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (_) {}
    } catch (e) { warn('triggerComputeAndRefresh unexpected', e); try { if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh(); } catch (_) {} }
  }

  // --- Public: importFromFile (keeps legacy behavior) ---
  // accepts array of handles or single handle or tasks array
  async function importFromFile(fallbackJsonOrHandles) {
    try {
      // if it's already tasks array
      if (Array.isArray(fallbackJsonOrHandles) && fallbackJsonOrHandles.length && typeof fallbackJsonOrHandles[0] === 'object' && (fallbackJsonOrHandles[0].site || fallbackJsonOrHandles[0].siteId || fallbackJsonOrHandles[0]._raw)) {
        triggerComputeAndRefresh(fallbackJsonOrHandles);
        document.dispatchEvent(new CustomEvent('trj:tasksLoaded.sitesFora', { detail: fallbackJsonOrHandles }));
        return;
      }

      var inputs = [];
      if (!fallbackJsonOrHandles) {
        warn('importFromFile called with no input.');
        toast('Nenhum arquivo/entrada fornecida.', 'warning');
        return;
      } else if (Array.isArray(fallbackJsonOrHandles)) {
        inputs = fallbackJsonOrHandles.slice();
      } else {
        inputs = [fallbackJsonOrHandles];
      }

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
          warn('parse failed for input', h, e);
          parsed = await parseHandleToRowsFallback(h);
        }
        parsedItems.push(parsed);
      }

      // convert parsed -> tasks (fallback)
      var tasks = [];
      try {
        if (IMPORT_HELPERS && typeof IMPORT_HELPERS.convertParsedItemsToTasks === 'function') {
          tasks = IMPORT_HELPERS.convertParsedItemsToTasks(parsedItems);
        } else {
          tasks = convertParsedItemsToTasksFallback(parsedItems);
        }
      } catch (e) {
        warn('convertParsedItemsToTasks failed', e);
        tasks = convertParsedItemsToTasksFallback(parsedItems);
      }

      // dispatch compatibility events (not triggerScan)
      try { document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { items: parsedItems } })); } catch (_) {}
      try { document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: parsedItems })); } catch (_) {}

      // use compute pipeline then persist tasks
      triggerComputeAndRefresh(tasks);

      // dispatch tasks events
      try { document.dispatchEvent(new CustomEvent('trj:tasksLoaded', { detail: tasks })); } catch (_) {}
      try { document.dispatchEvent(new CustomEvent('trj:tasksLoaded.sitesFora', { detail: tasks })); } catch (_) {}

      toast('Import (sites-fora) concluído. Tasks: ' + (tasks && tasks.length ? tasks.length : 0), 'success');
    } catch (err) {
      err('importFromFile erro', err);
      toast('Erro ao importar (ver console).', 'error');
    }
  }

  // --- New: importFromText (for incidents) ---
  // Accepts raw text (string) or parsed-like object; maps to incidents and persists
  async function importFromText(rawOrParsed, opts) {
    opts = opts || {};
    try {
      var parsed;
      if (!rawOrParsed) {
        toast('Nenhum texto fornecido para import de incidentes.', 'warning');
        return;
      }
      if (typeof rawOrParsed === 'string') {
        // try import helper parseTextToRows
        if (IMPORT_HELPERS && typeof IMPORT_HELPERS.parseTextToRows === 'function') {
          parsed = IMPORT_HELPERS.parseTextToRows('incidentes_text', rawOrParsed);
        } else {
          parsed = parseTextToRows('incidentes_text', rawOrParsed);
        }
      } else if (rawOrParsed && rawOrParsed.headers && Array.isArray(rawOrParsed.rows)) {
        parsed = rawOrParsed;
      } else {
        // unknown format -> try JSON (maybe user pasted JSON)
        try {
          var maybe = JSON.parse(rawOrParsed);
          if (Array.isArray(maybe)) {
            // convert array -> parsedItems structure
            parsed = { name: 'pasted_json', headers: [], rows: maybe.map(function(r){ return (typeof r === 'object') ? r : [r]; }) };
          } else {
            parsed = { name: 'pasted_json', headers: [], rows: [maybe] };
          }
        } catch (e) {
          parsed = parseTextToRows('incidentes_text', (''+rawOrParsed));
        }
      }

      // convert parsed -> incidents (use helper if available)
      var incidents = [];
      try {
        if (IMPORT_HELPERS && typeof IMPORT_HELPERS.convertParsedItemsToIncidents === 'function') {
          incidents = IMPORT_HELPERS.convertParsedItemsToIncidents([parsed]);
        } else {
          incidents = convertParsedItemsToIncidentsFallback([parsed]);
        }
      } catch (e) {
        warn('convertParsedItemsToIncidents failed', e);
        incidents = convertParsedItemsToIncidentsFallback([parsed]);
      }

      if (!incidents || !incidents.length) {
        toast('Nenhum incidente reconhecido no texto.', 'warning');
        return;
      }

      // persist incidents via TRJ.files.setIncidents or TRJ.api.importIncidentes
      try {
        if (TRJ && TRJ.files && typeof TRJ.files.setIncidents === 'function') {
          TRJ.files.setIncidents(incidents);
          log('TRJ.files.setIncidents chamado com', incidents.length, 'incidents');
          toast('Incidentes importados: ' + incidents.length, 'success');
        } else if (TRJ && TRJ.api && typeof TRJ.api.importIncidentes === 'function') {
          // attempt API call, but don't block UI
          try {
            await TRJ.api.importIncidentes(incidents);
            toast('Incidentes enviados via API: ' + incidents.length, 'success');
          } catch (apiErr) {
            warn('TRJ.api.importIncidentes failed', apiErr);
            // fallback to local
            localStorage.setItem('trj_incidentes', JSON.stringify(incidents));
            toast('Incidentes salvos localmente (fallback).', 'info');
          }
        } else {
          // fallback local
          localStorage.setItem('trj_incidentes', JSON.stringify(incidents));
          toast('Incidentes salvos localmente (fallback).', 'info');
        }
      } catch (persistErr) {
        warn('Falha ao persistir incidents', persistErr);
        toast('Erro ao salvar incidentes (ver console).', 'error');
      }

      // emit events for other modules
      try { document.dispatchEvent(new CustomEvent('trj:incidentsLoaded', { detail: incidents })); } catch (_) {}
      try { document.dispatchEvent(new CustomEvent('trj:incidentsImported', { detail: incidents })); } catch (_) {}

      log('importFromText finalizado. incidents:', incidents.length);
      return incidents;
    } catch (e) {
      err('importFromText erro', e);
      toast('Erro ao importar texto de incidentes (ver console).', 'error');
    }
  }

  // Expose public API
  S.importFromFile = importFromFile;
  S.importFromText = importFromText;
  S.parseHandleToRowsFallback = parseHandleToRowsFallback;
  S.parseTextToRows = parseTextToRows;
  S.convertParsedItemsToIncidentsFallback = convertParsedItemsToIncidentsFallback;
  S.convertParsedItemsToTasksFallback = convertParsedItemsToTasksFallback;

  // keep reference
  window.TRJ = window.TRJ || {};
  window.TRJ.sitesFora = S;

})();
