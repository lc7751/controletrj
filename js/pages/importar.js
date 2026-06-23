// js/pages/importar.js - Importador e integração com TRJ.files (ajustado)
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
  let containerEl = null;

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
    const p = name.split('.');
    if (p.length < 2) return '';
    return p[p.length - 1].toLowerCase();
  }

  // Parser de um FileSystemHandle ou File para { name, headers, rows }
  async function parseFileHandle(handle) {
    try {
      // Aceita tanto FileSystemFileHandle (com getFile) quanto File objetos
      const file = (handle && typeof handle.getFile === 'function') ? await handle.getFile() : (handle instanceof File ? handle : null);
      const name = (file && file.name) ? file.name : (handle && handle.name) ? handle.name : ('untitled_' + Date.now());
      const ext = extFromName(name);

      // XLSX / XLS / XLSM usando XLSX global se disponível
      if (window.XLSX && ['xlsx', 'xls', 'xlsm'].includes(ext)) {
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

      // CSV handled by XLSX if XLSX present and ext === 'csv'
      if (ext === 'csv') {
        const text = await (file ? file.text() : '');
        return parseTextToRows(name, text, 'csv');
      }

      // Text formats (txt, tsv, html) or unknown -> try parse as text
      if (['txt', 'tsv', 'html', 'htm'].includes(ext) || !ext) {
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
    const incidentKeywords = ['fora', 'incident', 'incidente', 'site fora', 'sites fora', 'outage', 'fora de', 'down', 'ocorr', 'motivo'];
    const taskKeywords = ['prazo','prioridade','sla','duração','duracao','endereço','endereco','end_id','site','ne','cidade','estado','atividade'];

    let scoreInc = incidentKeywords.reduce((s, k) => s + (name.indexOf(k) >= 0 ? 2 : 0) + (headerStr.indexOf(k) >= 0 ? 2 : 0), 0);
    let scoreTask = taskKeywords.reduce((s, k) => s + (name.indexOf(k) >= 0 ? 1 : 0) + (headerStr.indexOf(k) >= 0 ? 1 : 0), 0);

    // if ambiguous, use header presence
    if (scoreInc === 0 && scoreTask === 0) {
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
      const norm = {};
      norm._raw = o;
      // tenta diversos nomes comuns (case-sensitive keys as provided by parser)
      norm.end_id = o['END_ID'] || o.end_id || o['End_Id'] || o['End ID'] || o['Endereco ID'] || o['ENDERECO'] || o.endereco || o['endereço'] || o['ENDEREÇO'] || null;
      norm.site = o['SITE'] || o.site || o['Site'] || null;
      norm.prioridade = o['PRIORIDADE'] || o.prioridade || o['Prioridade'] || null;
      norm.prazo_h = o['Prazo (h)'] || o.prazo || o.prazo_h || null;
      norm.status = o['STATUS'] || o.status || null;
      norm.cidade = o['CIDADE'] || o.cidade || null;
      norm.bairro = o['Bairro'] || o.bairro || null;
      norm.cm = o['CM'] || o.cm || null;
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
      norm.end_id = o['END_ID'] || o.end_id || o['End_Id'] || o['End ID'] || o.endereco || o['endereço'] || null;
      norm.site = o['SITE'] || o.site || o['Site'] || null;
      norm.motivo = o['motivo'] || o.MOTIVO || o['Motivo'] || o['reason'] || null;
      norm.inicio = o['inicio'] || o.INICIO || o['data'] || o['DATA'] || null;
      norm.fim = o['fim'] || o.FIM || o['end time'] || null;
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
        const handle = (it && it.handle) ? it.handle : it;
        try {
          const parsed = await parseFileHandle(handle);
          if (!parsed || !parsed.rows || parsed.rows.length === 0) {
            log('arquivo vazio ou não legível:', parsed ? parsed.name : handle && handle.name);
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
        } catch (e) {
          warn('Falha ao processar arquivo (continua com próximos):', (it && it.name) || (it && it.handle && it.handle.name), e);
          continue;
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

  // --- Novas funções: importação de texto e UI render ---

  // Importa incidents a partir de texto colado no textarea
  function importIncidentsFromText() {
    try {
      const ta = containerEl && containerEl.querySelector('[data-action="incidentes-text"]');
      if (!ta) { toast('Campo de incidentes não encontrado.', 'error'); return; }
      const raw = ta.value;
      if (!raw || !raw.trim()) { toast('Cole os dados dos incidentes antes de importar.', 'warning'); return; }

      const parsed = parseTextToRows('incidentes_text', raw);
      const objs = convertRowsToObjects(parsed);
      const incidents = mapObjectsToIncidents(objs);

      if (!incidents.length) {
        toast('Nenhum incidente detectado no texto.', 'warning');
        return;
      }

      if (TRJ && TRJ.files && typeof TRJ.files.setIncidents === 'function') {
        TRJ.files.setIncidents(incidents);
        toast('Incidentes importados: ' + incidents.length, 'success');
        log('Importados incidents via TRJ.files.setIncidents', incidents.length);
      } else if (TRJ && TRJ.api && typeof TRJ.api.importIncidentes === 'function') {
        TRJ.api.importIncidentes(incidents).then(() => {
          toast('Incidentes enviados via TRJ.api.importIncidentes', 'success');
        }).catch(e => {
          warn('Falha importIncidentes API', e);
          localStorage.setItem('trj_incidentes', JSON.stringify(incidents));
          toast('Incidentes salvos localmente (fallback).', 'info');
        });
      } else {
        localStorage.setItem('trj_incidentes', JSON.stringify(incidents));
        toast('Incidentes salvos localmente (fallback).', 'info');
      }

    } catch (e) {
      err('importIncidentsFromText erro', e);
      toast('Erro ao importar incidents do texto (veja console).', 'error');
    }
  }

  // Render HTML da página (injetável)
  function renderHtml() {
    let hasTasks = false;
    try {
      hasTasks = (TRJ && TRJ.files && typeof TRJ.files.getTasks === 'function') ? (TRJ.files.getTasks() || []).length > 0 : !!localStorage.getItem('trj_tasks');
    } catch (_) { hasTasks = !!localStorage.getItem('trj_tasks'); }
    const statusText = hasTasks ? 'Dados carregados' : 'Sem dados';

    return `
      <section data-page="importar" id="importar" class="page page-importar" style="padding:20px; max-width:1100px; margin:0 auto;">
        <div style="display:flex; gap:18px; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div>
            <h2 style="margin:0 0 6px 0;">Importar dados</h2>
            <p style="margin:0; color:var(--trj-muted); font-size:13px;">Faça upload de arquivos, conecte uma pasta para monitoramento ou cole incidents no campo abaixo.</p>
          </div>
          <div style="text-align:right;">
            <small style="color:var(--trj-muted);">Status: <span id="importar-status" style="font-weight:700;">${statusText}</span></small>
          </div>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div style="flex:1 1 420px; background:var(--trj-card, #111); padding:12px; border-radius:8px;">
            <h3 style="margin:0 0 8px 0;">Arquivo / Pasta</h3>
            <p style="margin:0 0 10px 0; color:var(--trj-muted); font-size:13px;">Você pode carregar XLSX/CSV ou conectar uma pasta para monitoramento automático.</p>
            <div style="display:flex; gap:8px; align-items:center;">
              <button class="trj-btn" data-action="choose-file">Escolher arquivo</button>
              <input type="file" accept=".csv,.xlsx,.xls,.ods,.txt,.html" data-action="file-input" style="display:none;" />
              <button class="trj-btn" data-action="connect-folder">Conectar pasta</button>
              <button class="trj-btn" data-action="verify-now">Verificar agora</button>
            </div>
            <div style="margin-top:10px; font-size:13px; color:var(--trj-muted);">
              <em>Arquivos detectados e processados serão mostrados nas abas após o carregamento.</em>
            </div>
          </div>

          <div style="flex:1 1 420px; background:var(--trj-card, #111); padding:12px; border-radius:8px;">
            <h3 style="margin:0 0 8px 0;">Incidentes (texto)</h3>
            <p style="margin:0 0 8px 0; color:var(--trj-muted); font-size:13px;">Cole aqui os dados do painel G.E.N.E.S.I.S (CSV/colunas separadas por ; , ou tab). A primeira linha deve conter cabeçalhos.</p>
            <textarea data-action="incidentes-text" rows="8" style="width:100%; background:transparent; border:1px dashed rgba(255,140,0,0.15); padding:8px; color:var(--trj-fg, #fff);"></textarea>
            <div style="margin-top:8px; display:flex; gap:8px;">
              <button class="trj-btn trj-btn-primary" data-action="import-incidentes-text">Importar Incidentes do Texto</button>
            </div>
          </div>
        </div>

        <div id="importar-log" style="margin-top:14px; color:var(--trj-muted); font-size:13px;"></div>
      </section>
    `;
  }

  // --- Funções de UI / binding ---
  function attachUiHandlers() {
    if (!containerEl) return;
    // Delegated click handler para actions
    containerEl.removeEventListener('click', delegatedClickHandler);
    containerEl.addEventListener('click', delegatedClickHandler);

    // file input
    const fileInput = containerEl.querySelector('input[type="file"][data-action="file-input"]');
    if (fileInput) {
      fileInput.removeEventListener('change', fileInputChangeHandler);
      fileInput.addEventListener('change', fileInputChangeHandler);
    }
  }

  function delegatedClickHandler(ev) {
    // procura no target e em ancestrais até encontrar data-action
    let el = ev.target;
    while (el && el !== containerEl && !el.getAttribute) el = el.parentNode;
    if (!el) return;
    let action = el.getAttribute && el.getAttribute('data-action');
    // Se não achar no elemento, verifica target direto
    if (!action && ev.target && ev.target.getAttribute) action = ev.target.getAttribute('data-action');
    if (!action) return;
    ev.preventDefault();
    if (action === 'connect-folder') {
      handleConnectClick(ev);
    } else if (action === 'verify-now') {
      handleVerifyClick(ev);
    } else if (action === 'choose-file') {
      const input = containerEl.querySelector('input[type="file"][data-action="file-input"]');
      if (input) input.click();
    } else if (action === 'import-incidentes-text') {
      importIncidentsFromText();
    }
  }

  function fileInputChangeHandler(ev) {
    const f = ev.target.files && ev.target.files[0];
    if (f) {
      // processa diretamente (processFolderItems aceita File)
      processFolderItems([f]);
    }
    // permitir re-seleção do mesmo arquivo
    try { ev.target.value = ''; } catch (e) { /* ignore */ }
  }

  // Inicialização: registra listeners e conecta botões (caso existam no DOM)
  function initImportPage() {
    if (_registered) return;
    _registered = true;

    // define containerEl se ainda não tiver sido definido (quando init for chamada isoladamente)
    if (!containerEl) {
      containerEl = document.querySelector('[data-page="importar"]') || document.querySelector('#importar') || document.querySelector('#page') || document.body;
    }
    if (!containerEl) {
      warn('container importar não encontrado no init');
      return;
    }

    // Registra listener global (evita duplicatas)
    document.removeEventListener('trj:folderChanged', onFolderChangedHandler);
    document.addEventListener('trj:folderChanged', onFolderChangedHandler);

    // Compatibilidade adicional
    document.removeEventListener('trj:folderChanged.importar', onFolderChangedHandler);
    document.addEventListener('trj:folderChanged.importar', onFolderChangedHandler);

    // Attach UI handlers (buttons/input dentro do container)
    attachUiHandlers();

    // Atualiza status
    const statusEl = containerEl.querySelector && containerEl.querySelector('#importar-status');
    if (statusEl) {
      const has = (TRJ && TRJ.files && typeof TRJ.files.getTasks === 'function') ? (TRJ.files.getTasks() || []).length > 0 : !!localStorage.getItem('trj_tasks');
      statusEl.textContent = has ? 'Dados carregados' : 'Sem dados';
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
        // disparar verificação inicial via triggerScan (processFolderItems consome items e não re-dispara trigger)
        try {
          if (typeof TRJ.files.triggerScan === 'function') {
            const res = await TRJ.files.triggerScan();
            if (res && Array.isArray(res.items) && res.items.length) {
              processFolderItems(res.items);
            }
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

  // --- Render API que o roteador chama ---
  P.importar.render = function (root) {
    try {
      const mount = root || document.querySelector('#page') || document.body;
      if (!mount) {
        warn('mount não encontrado para render');
        return;
      }
      // injetar HTML da página (substitui o conteúdo do container recebido pelo roteador)
      mount.innerHTML = renderHtml();
      // apontar containerEl para a seção injetada
      containerEl = mount.querySelector('[data-page="importar"]') || mount;
      // inicializar bindings
      initImportPage();
    } catch (e) {
      err('render erro', e);
    }
  };

  // Auto-init (se a página for carregada e TRJ estiver pronto)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initImportPage();
    });
  } else {
    setTimeout(initImportPage, 0);
  }

  // Tenta carregar pasta salva e processar arquivos uma vez (startup)
  (async function tryLoadSavedFolderAndScan() {
    try {
      if (TRJ && TRJ.files && typeof TRJ.files.loadSavedFolder === 'function') {
        await TRJ.files.loadSavedFolder();
        if (typeof TRJ.files.triggerScan === 'function') {
          try {
            const res = await TRJ.files.triggerScan();
            if (res && res.items && res.items.length) {
              // process once at startup
              processFolderItems(res.items);
            }
          } catch (e) { /* ignore scan errors at startup */ }
        }
      }
    } catch (e) { /* ignore */ }
  })();

})();
