// importar.js - Importador e integração com TRJ.files (corrigido para evitar loop infinito)
(function () {
  'use strict';

  window.TRJ = window.TRJ || {};
  window.TRJ.pages = window.TRJ.pages || {};
  const P = window.TRJ.pages;
  P.importar = P.importar || {};

  // Configurações locais
  const DEBOUNCE_MS = 600; // agrupa eventos próximos
  const MAX_ROWS_PREVIEW = 5000;

  // Estado local da página
  let _debounceTimer = null;
  let _processing = false;
  let _registered = false; // evitar registrar listeners múltiplas vezes

  // Helpers de UI (assumem existência de funções TRJ.ui.* se houver)
  function log(...args) { console.info.apply(console, ['[importar]'].concat(args)); }
  function warn(...args) { console.warn.apply(console, ['[importar]'].concat(args)); }
  function err(...args) { console.error.apply(console, ['[importar]'].concat(args)); }
  function toast(msg, type = 'info') {
    if (window.TRJ && TRJ.ui && typeof TRJ.ui.toast === 'function') TRJ.ui.toast(msg, type);
    else console.info('[toast]', msg);
  }

  // Detecta extensão do nome
  function extFromName(name) {
    if (!name) return '';
    const p = name.split('.'); if (p.length < 2) return '';
    return p[p.length - 1].toLowerCase();
  }

  // Parser de um FileSystemHandle ou File para { name, headers, rows }
  async function parseFileHandle(handle) {
    try {
      // Aceita tanto FileSystemFileHandle (com getFile) quanto File objetos
      const file = (typeof handle.getFile === 'function') ? await handle.getFile() : (handle instanceof File ? handle : null);
      const name = (file && file.name) ? file.name : (handle && handle.name) ? handle.name : ('untitled_' + Date.now());
      const ext = extFromName(name);

      // XLSX / XLS / XLSM usando XLSX global se disponível
      if (window.XLSX && ['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)) {
        if (ext === 'csv') {
          // parse CSV text
          const text = await (file ? file.text() : '');
          return parseTextToRows(name, text);
        }
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const sheetName = wb.SheetNames && wb.SheetNames[0];
        const sheet = sheetName ? wb.Sheets[sheetName] : null;
        const arr = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false }) : [];
        const cleaned = (arr || []).slice(0, MAX_ROWS_PREVIEW).map(r => Array.isArray(r) ? r.map(c => (c === null || c === undefined) ? '' : ('' + c).trim()) : [r]);
        const headers = (cleaned[0] && Array.isArray(cleaned[0])) ? cleaned[0].map(h => (h||'').toString().trim()) : [];
        const rows = cleaned.slice(headers.length ? 1 : 0);
        return { name: name, headers: headers, rows: rows, sheetName: sheetName || '' };
      }

      // Text formats (csv, txt, tsv, html)
      if (['csv', 'txt', 'tsv', 'html', 'htm'].includes(ext) || !ext) {
        const text = await (file ? file.text() : '');
        return parseTextToRows(name, text, ext);
      }

      // Fallback: tratar como texto
      try {
        const text = file ? await file.text() : '';
        return parseTextToRows(name, text, ext);
      } catch (e) {
        warn('Não foi possível ler arquivo', name, e);
        return { name: name, headers: [], rows: [] };
      }
    } catch (e) {
      err('parseFileHandle falhou', e);
      return { name: (handle && handle.name) || 'unknown', headers: [], rows: [] };
    }
  }

  function parseTextToRows(name, text, ext) {
    ext = (ext || '').toLowerCase();
    text = text || '';
    // Remover BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    // HTML: extrair tabela se existir
    if (ext === 'html' || ext === 'htm' || text.trim().startsWith('<')) {
      // tenta extrair primeira <table>
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const table = doc.querySelector('table');
        if (table) {
          const rows = Array.from(table.rows).map(r => Array.from(r.cells).map(c => (c.textContent || '').trim()));
          const headers = rows.length && rows[0].length ? rows[0] : [];
          const data = headers.length ? rows.slice(1) : rows;
          return { name: name, headers: headers, rows: data.slice(0, MAX_ROWS_PREVIEW) };
        }
      } catch (e) { /* ignore html parse errors */ }
    }

    // Detectar delimitador: ; , \t
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (!lines.length) return { name: name, headers: [], rows: [] };
    const sample = lines.slice(0, 5).join('\n');
    let delimiter = null;
    if ((sample.match(/;/g) || []).length > (sample.match(/,/g) || []).length) delimiter = ';';
    else if ((sample.match(/\t/g) || []).length > 0) delimiter = '\t';
    else delimiter = ',';

    const parsed = lines.map(l => l.split(delimiter).map(c => (c || '').trim()));
    const headers = parsed[0] && parsed[0].length ? parsed[0] : [];
    const rows = parsed.slice(headers.length ? 1 : 0).slice(0, MAX_ROWS_PREVIEW);
    return { name: name, headers: headers, rows: rows };
  }

  // Heurística para classificar entre tasks e incidents
  function classifyParsed(parsed) {
    // parsed: { name, headers, rows }
    const name = (parsed.name || '').toLowerCase();
    const headers = (parsed.headers || []).map(h => ('' + (h || '')).toLowerCase());
    const headerStr = headers.join('|');

    // Palavras-chave que indicam incidentes/sites fora
    const incidentKeywords = ['fora', 'incident', 'incidente', 'site fora', 'sites fora', 'outage', 'fora de', 'down', 'fora'];
    const taskKeywords = ['prazo','prioridade','sla','duração','endereço','end_id','site','ne','cidade','estado'];

    let scoreInc = incidentKeywords.reduce((s, k) => s + (name.indexOf(k) >= 0 ? 2 : 0) + (headerStr.indexOf(k) >= 0 ? 2 : 0), 0);
    let scoreTask = taskKeywords.reduce((s, k) => s + (name.indexOf(k) >= 0 ? 1 : 0) + (headerStr.indexOf(k) >= 0 ? 1 : 0), 0);

    // if ambiguous, use header presence
    if (scoreInc === 0 && scoreTask === 0) {
      // se header contém 'incidente' ou 'motivo' ou 'inicio' => incident
      if (headerStr.match(/incid|motivo|motivos|ocorrido|ocorreu|inicio|fim|horario|hora/)) scoreInc += 2;
      if (headerStr.match(/priorid|sla|prazo|durac|dur.|enderec|end_id|cidade|estado/)) scoreTask += 2;
    }

    return (scoreInc > scoreTask) ? 'incident' : 'task';
  }

  // Converte linhas em objetos simples para tasks/incidents (heurístico)
  function convertRowsToObjects(parsed) {
    const headers = parsed.headers || [];
    const rows = parsed.rows || [];
    const objs = rows.map(r => {
      if (Array.isArray(r)) {
        const obj = {};
        for (let i = 0; i < r.length; i++) {
          const key = (headers[i] || ('c' + i)).toString().trim();
          obj[key] = r[i];
        }
        return obj;
      } else if (typeof r === 'object' && r !== null) {
        return r;
      } else {
        return { raw: r };
      }
    });
    return objs;
  }

  // Normaliza e cria estrutura de task mínima (ajuste conforme schema real)
  function mapObjectsToTasks(objs) {
    return objs.map(o => {
      // heurística: procurar campos conhecidos
      const norm = {};
      norm._raw = o;
      norm.site = o.site || o.SITE || o['Site'] || o['END_ID'] || o.end_id || o['END_ID'] || o.endereco || o.endereço || o['ENDERECO'] || null;
      norm.prioridade = o.prioridade || o.PRIORIDADE || o.PRI || null;
      norm.prazo_h = o.prazo || o.prazo_h || o['Prazo (h)'] || null;
      norm.status = o.status || o.Status || o.STATUS || null;
      norm.cidade = o.cidade || o.CIDADE || null;
      // adiciona timestamp de importação
      norm.importedAt = new Date().toISOString();
      return norm;
    });
  }

  // Normaliza para incidents
  function mapObjectsToIncidents(objs) {
    return objs.map(o => {
      const norm = {};
      norm._raw = o;
      norm.site = o.site || o.SITE || o['Site'] || o['END_ID'] || o.end_id || o.endereco || o.endereço || null;
      norm.motivo = o.motivo || o.MOTIVO || o.reason || null;
      norm.inicio = o.inicio || o.INICIO || o.data || o.DATA || null;
      norm.fim = o.fim || o.FIM || o['end time'] || null;
      norm.importedAt = new Date().toISOString();
      return norm;
    });
  }

  // Função principal: processa array de handles (items) retornados por scanFolderOnce / triggerScan
  async function processFolderItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      toast('Nenhum arquivo encontrado para importação.', 'warning');
      return;
    }
    if (_processing) {
      log('Já processando — ignorando nova requisição');
      return;
    }
    _processing = true;
    try {
      log('processFolderItems: arquivos detectados:', items.length);
      const allTasks = [];
      const allIncidents = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        // it pode ser { name, handle } ou um FileSystemHandle/ File
        const handle = it.handle || it;
        const parsed = await parseFileHandle(handle);
        if (!parsed || !parsed.rows || parsed.rows.length === 0) {
          log('arquivo vazio ou não legível:', parsed.name);
          continue;
        }
        // classificar
        const kind = classifyParsed(parsed);
        const objs = convertRowsToObjects(parsed);
        if (kind === 'incident') {
          const incs = mapObjectsToIncidents(objs);
          allIncidents.push.apply(allIncidents, incs);
          log('classificado como incidentes:', parsed.name, incs.length);
        } else {
          const tasks = mapObjectsToTasks(objs);
          allTasks.push.apply(allTasks, tasks);
          log('classificado como tasks:', parsed.name, tasks.length);
        }
      }

      // Persistir via TRJ.files API (essas funções disparam eventos de tasks/incidents)
      if (allTasks.length) {
        try {
          if (TRJ && TRJ.files && typeof TRJ.files.setTasks === 'function') {
            TRJ.files.setTasks(allTasks);
            log('TRJ.files.setTasks chamado com', allTasks.length, 'itens');
            toast('Tasks importadas: ' + allTasks.length, 'success');
          } else {
            // fallback local
            localStorage.setItem('trj_tasks', JSON.stringify(allTasks));
            log('Persistido localmente tasks', allTasks.length);
            toast('Tasks importadas (local): ' + allTasks.length, 'success');
          }
        } catch (e) { warn('Falha ao persistir tasks', e); toast('Erro ao salvar tasks (ver console)', 'error'); }
      }

      if (allIncidents.length) {
        try {
          if (TRJ && TRJ.files && typeof TRJ.files.setIncidents === 'function') {
            TRJ.files.setIncidents(allIncidents);
            log('TRJ.files.setIncidents chamado com', allIncidents.length, 'itens');
            toast('Incidentes importados: ' + allIncidents.length, 'success');
          } else {
            localStorage.setItem('trj_incidentes', JSON.stringify(allIncidents));
            log('Persistido localmente incidents', allIncidents.length);
            toast('Incidentes importados (local): ' + allIncidents.length, 'success');
          }
        } catch (e) { warn('Falha ao persistir incidents', e); toast('Erro ao salvar incidents (ver console)', 'error'); }
      }

      // Se não houve nada, avisar
      if (!allTasks.length && !allIncidents.length) {
        toast('Nenhum dado reconhecido nos arquivos.', 'warning');
      }

    } catch (e) {
      err('processFolderItems erro inesperado', e);
      toast('Erro ao processar arquivos (ver console)', 'error');
    } finally {
      _processing = false;
    }
  }

  // Handler para evento global trj:folderChanged — usa debounce e NÃO re-dispara triggerScan
  function onFolderChangedHandler(ev) {
    try {
      // ev.detail pode ser { items: [...] } ou array diretamente dependendo de quem disparou
      const payload = ev && ev.detail ? ev.detail : ev;
      let items = [];
      if (Array.isArray(payload)) items = payload;
      else if (payload && Array.isArray(payload.items)) items = payload.items;
      else if (payload && payload.items && Array.isArray(payload.items)) items = payload.items;
      else {
        // fallback: tentar ler TRJ.files.triggerScan() uma vez, mas NÃO dentro do handler (para evitar loop)
        warn('onFolderChanged: payload inesperado', payload);
      }

      // Debounce group
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(function () {
        _debounceTimer = null;
        // Processa sem causar recursão — processFolderItems não chama TRJ.files.triggerScan
        processFolderItems(items).catch(e => { err('processFolderItems falhou', e); });
      }, DEBOUNCE_MS);

    } catch (e) {
      err('onFolderChangedHandler erro', e);
    }
  }

  // Inicialização: registra listeners e conecta botões (caso existam no DOM)
  function initImportPage() {
    if (_registered) return;
    _registered = true;

    // Registra listener global (evita duplicatas)
    document.removeEventListener('trj:folderChanged', onFolderChangedHandler);
    document.addEventListener('trj:folderChanged', onFolderChangedHandler);

    // Se quiser um hook de compatibilidade adicional
    document.removeEventListener('trj:folderChanged.importar', onFolderChangedHandler);
    document.addEventListener('trj:folderChanged.importar', onFolderChangedHandler);

    // Se existir botão 'Conectar pasta' e 'Verificar agora' no DOM, ligar ações
    try {
      const btnConnect = document.querySelector('[data-action="connect-folder"]');
      const btnVerify = document.querySelector('[data-action="verify-now"]');
      if (btnConnect) {
        btnConnect.removeEventListener('click', handleConnectClick);
        btnConnect.addEventListener('click', handleConnectClick);
      }
      if (btnVerify) {
        btnVerify.removeEventListener('click', handleVerifyClick);
        btnVerify.addEventListener('click', handleVerifyClick);
      }
    } catch (e) {
      // ignorar ausência de botões — page pode gerenciar de outro jeito
    }

    log('Import page initialized. Listeners registered.');
  }

  // Botão: conectar pasta
  async function handleConnectClick(e) {
    e && e.preventDefault && e.preventDefault();
    try {
      if (!TRJ || !TRJ.files || typeof TRJ.files.connectFolder !== 'function') {
        toast('Funcionalidade de conectar pasta não disponível neste browser.', 'error');
        return;
      }
      const handle = await TRJ.files.connectFolder();
      if (handle) {
        toast('Pasta conectada: ' + (handle.name || 'Pasta'), 'success');
        // opcional: disparar verificação inicial (não o evento que cria recursão)
        // chamamos TRJ.files.triggerScan() aqui uma única vez (não dentro do handler) e processamos o retorno
        try {
          const res = await TRJ.files.triggerScan();
          if (res && Array.isArray(res.items) && res.items.length) {
            // processar retornos diretamente (sem re-disparar eventos)
            processFolderItems(res.items);
          }
        } catch (scanErr) {
          warn('triggerScan após connectFolder falhou', scanErr);
        }
      }
    } catch (e) {
      err('handleConnectClick erro', e);
      toast('Erro ao conectar pasta (ver console)', 'error');
    }
  }

  // Botão: verificar agora (força triggerScan)
  async function handleVerifyClick(e) {
    e && e.preventDefault && e.preventDefault();
    try {
      if (!TRJ || !TRJ.files || typeof TRJ.files.triggerScan !== 'function') {
        toast('triggerScan não disponível.', 'error');
        return;
      }
      const res = await TRJ.files.triggerScan();
      if (res && res.items) {
        // se triggerScan retornou changed=false mas items preenchidos, também processa (não causa loop)
        await processFolderItems(res.items);
      } else {
        toast('Nenhum arquivo encontrado na verificação.', 'info');
      }
    } catch (e) {
      err('handleVerifyClick erro', e);
      toast('Erro ao verificar pasta (ver console)', 'error');
    }
  }

  // Expor algumas funções para debug / chamadas manuais
  P.importar.init = initImportPage;
  P.importar.processFolderItems = processFolderItems;
  P.importar.parseFileHandle = parseFileHandle;
  P.importar.onFolderChangedHandler = onFolderChangedHandler;

  // Auto-init (se a página for carregada e TRJ estiver pronto)
  // Aguarda até que DOM esteja pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImportPage);
  } else {
    setTimeout(initImportPage, 0);
  }

  // Se TRJ.files já tem eventos pendentes (carregados antes), podemos também tentar carregar saved folder
  (async function tryLoadSavedFolderAndScan() {
    try {
      if (TRJ && TRJ.files && typeof TRJ.files.loadSavedFolder === 'function') {
        await TRJ.files.loadSavedFolder();
        // optional: trigger initial scan (but not mandatory)
        if (typeof TRJ.files.triggerScan === 'function') {
          try {
            const res = await TRJ.files.triggerScan();
            if (res && res.items && res.items.length) {
              // process once at startup
              processFolderItems(res.items);
            }
          } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }
  })();

})();
